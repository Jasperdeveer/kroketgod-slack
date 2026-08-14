// ── Het Grote Archief ──────────────────────────────────────────────────────────
// Blijvend geheugen van het genootschap, plus een BM25-ranker om er gericht in te zoeken.
//
// WAAROM DIT BESTAAT. Het kanaalgeheugen (geschiedenis.json) is een rollend venster van veertig
// berichten: alles ouder dan een paar uur bestond voor de Kroket God simpelweg niet. En het gratis
// Slack-plan bewaart zelf niets ouder dan negentig dagen, dus "we kunnen het altijd terugzoeken in
// Slack" is onwaar. Dit archief is daarom de enige plek waar de geschiedenis van dit genootschap op
// termijn nog bestaat — en het wordt NOOIT gesnoeid.
//
// WAAROM NDJSON EN NIET readJSON/writeJSON. writeJSON herschrijft het hele bestand bij elke
// wijziging. Bij tienduizenden regels is dat megabytes per kanaalbericht naar de SD-kaart van een
// Pi. Eén regel JSON per entry laat appenden één syscall zijn, en een half weggeschreven regel bij
// stroomuitval kost precies dat ene bericht in plaats van het hele archief.
//
// HET BESTAND IS HET ARCHIEF, DE INDEX IS EEN VENSTER. Op schijf groeit alles eeuwig door; in het
// geheugen indexeren we alleen de nieuwste INDEX_VENSTER entries, zodat het RAM-gebruik begrensd
// blijft ongeacht hoe oud het genootschap wordt. Wat buiten het venster valt is dus niet vergeten,
// alleen niet meer doorzoekbaar — het staat er nog, klaar voor wie het ooit wil uitlezen.

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');
const ARCHIEF_BESTAND = 'kroniek.ndjson';

// Hoeveel van de nieuwste entries doorzoekbaar zijn. 30.000 dekt bij normaal kanaalverkeer
// meerdere jaren; de teksten zijn al op 200 tekens afgekapt (zie stripSlackOpmaak), dus dit
// venster kost in de orde van enkele megabytes aan geheugen.
const INDEX_VENSTER = 30_000;

// BM25-parameters. k1 = hoe snel herhaling van een term ophoudt bij te dragen, b = hoe zwaar
// documentlengte meeweegt. Dit zijn de gangbare standaardwaarden en er is geen reden om ze voor
// een snackgenootschap te tunen.
const K1 = 1.2;
const B = 0.75;

// Nederlandse stopwoorden. Ruimer dan de lijst die de kennisbank gebruikte, want bij BM25 zijn
// hoogfrequente woorden niet alleen ruis in de score maar ook de duurste posting-lijsten.
const STOPWOORDEN = new Set([
  'aan', 'al', 'als', 'ander', 'anders', 'ben', 'bij', 'daar', 'dan', 'dat', 'de', 'der', 'deze',
  'die', 'dit', 'doen', 'dus', 'een', 'eens', 'en', 'er', 'ge', 'geen', 'gij', 'haar', 'had',
  'heb', 'hebben', 'heeft', 'hem', 'het', 'hij', 'hoe', 'hun', 'iemand', 'iets', 'ik', 'in',
  'is', 'ja', 'je', 'kan', 'kon', 'kunnen', 'maar', 'me', 'meer', 'men', 'met', 'mij', 'mijn',
  'moet', 'na', 'naar', 'niet', 'niets', 'nog', 'nu', 'of', 'om', 'omdat', 'ons', 'ook', 'op',
  'over', 'reeds', 'te', 'tegen', 'toch', 'toen', 'tot', 'uit', 'van', 'veel', 'voor', 'want',
  'waren', 'was', 'wat', 'we', 'wel', 'werd', 'wezen', 'wie', 'wij', 'wil', 'worden', 'wordt',
  'zal', 'ze', 'zei', 'zelf', 'zich', 'zij', 'zijn', 'zo', 'zonder', 'zou',
]);

// Tokeniseren: kleine letters, splitsen op alles wat geen letter of cijfer is (unicode-bewust,
// dus "smeuïg" en "soufflé" blijven één woord), stopwoorden en te korte woorden eruit.
// Twee letters is bewust de ondergrens: kortere tokens dragen niets bij en blazen de index op.
function tokeniseer(tekst) {
  if (!tekst || typeof tekst !== 'string') return [];
  return tekst
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length > 2 && !STOPWOORDEN.has(w));
}

// ── In-memory index ────────────────────────────────────────────────────────────
// docs        de geïndexeerde entries (het venster), oudste eerst
// postings    term → [{ d: docindex, tf: aantal voorkomens }]
// lengteSom   som van alle documentlengtes, voor de gemiddelde lengte in de BM25-noemer
let docs = [];
let postings = new Map();
let lengteSom = 0;
let geladen = false;

// Het pad staat vast bij het laden van de module. KROKET_ARCHIEF_PAD is er voor de tests (die
// naar een tijdelijke map moeten schrijven i.p.v. het echte archief) en voor een eventuele
// verhuizing naar een andere schijf zonder codewijziging.
const ARCHIEF_PAD = process.env.KROKET_ARCHIEF_PAD || path.join(PROJECT_DIR, ARCHIEF_BESTAND);

function archiefPad() {
  return ARCHIEF_PAD;
}

// Voegt één entry aan de in-memory index toe. Bewust gescheiden van het wegschrijven, zodat
// laadArchief() dezelfde weg loopt als een live bericht en er geen tweede indexeerpad bestaat.
function indexeer(entry) {
  const tokens = tokeniseer(entry.tekst);
  const d = docs.length;
  docs.push({ ...entry, lengte: tokens.length });
  lengteSom += tokens.length;
  const tellingen = new Map();
  for (const t of tokens) tellingen.set(t, (tellingen.get(t) || 0) + 1);
  for (const [term, tf] of tellingen) {
    let lijst = postings.get(term);
    if (!lijst) { lijst = []; postings.set(term, lijst); }
    lijst.push({ d, tf });
  }
}

// Herbouwt de index volledig uit het bestand. Alleen de laatste INDEX_VENSTER regels worden
// geïndexeerd; oudere regels blijven ongemoeid op schijf staan.
function laadArchief({ stil = false } = {}) {
  docs = [];
  postings = new Map();
  lengteSom = 0;
  geladen = true;
  let ruw;
  try {
    ruw = fs.readFileSync(archiefPad(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { regels: 0, overgeslagen: 0 }; // nog geen archief
    throw err;
  }
  const regels = ruw.split('\n').filter(r => r.trim());
  const venster = regels.slice(-INDEX_VENSTER);
  let overgeslagen = 0;
  for (const regel of venster) {
    let entry;
    try {
      entry = JSON.parse(regel);
    } catch (_) {
      // Half weggeschreven regel (stroomuitval tijdens append). Eén bericht kwijt, de rest van
      // het archief intact — precies waarom dit bestand regelgeoriënteerd is.
      overgeslagen++;
      continue;
    }
    if (!entry || typeof entry.tekst !== 'string') { overgeslagen++; continue; }
    indexeer(entry);
  }
  if (!stil) {
    const buiten = regels.length - venster.length;
    console.log(`📚 Archief geladen: ${docs.length} doorzoekbaar${buiten > 0 ? `, ${buiten} ouder dan het venster` : ''}` +
      `${overgeslagen ? `, ${overgeslagen} onleesbare regel(s) overgeslagen` : ''}.`);
  }
  return { regels: docs.length, overgeslagen };
}

// Schrijft één entry weg en indexeert hem direct. Faalt nooit hard: een archiefprobleem mag een
// kanaalbericht niet kunnen tegenhouden.
// soort: 'lid' | 'kroketgod' | 'persona' — waar de uitspraak vandaan komt.
function voegToeAanArchief({ soort = 'lid', spreker, sprekerId = null, tekst, ts = null }) {
  try {
    if (!tekst || !String(tekst).trim()) return false;
    const entry = {
      ts: ts || Date.now(),
      soort,
      spreker: String(spreker || 'onbekend').slice(0, 60),
      sprekerId: sprekerId || null,
      tekst: String(tekst).slice(0, 500),
    };
    fs.appendFileSync(archiefPad(), `${JSON.stringify(entry)}\n`);
    if (!geladen) laadArchief({ stil: true });
    indexeer(entry);
    // Groeit het venster over de rand, dan de index opnieuw opbouwen uit het bestand. Dat is
    // O(venster) en gebeurt hooguit één keer per INDEX_VENSTER berichten, dus in de praktijk
    // eens per paar jaar — niet het moeite waard om incrementeel te laten verwijderen.
    if (docs.length > INDEX_VENSTER * 1.1) laadArchief({ stil: true });
    return true;
  } catch (err) {
    console.warn('⚠️ Archief-append mislukt:', err.message);
    return false;
  }
}

// BM25-zoekopdracht over het venster.
//   vraag           vrije tekst; wordt getokeniseerd als losse termen
//   n               hoeveel resultaten
//   nieuwerDan/ouderDan  tijdsfilter in ms-epoch (ouderDan sluit het recente venster uit, zodat
//                   je geen fragmenten terugkrijgt die toch al in het kanaalgeheugen zitten)
//   soort           optioneel filter op herkomst
// Geeft entries mét score terug, hoogste eerst; bij gelijke score wint de nieuwste.
function zoekArchief(vraag, { n = 5, nieuwerDan = null, ouderDan = null, soort = null, minLengte = 0 } = {}) {
  if (!geladen) laadArchief({ stil: true });
  const termen = [...new Set(tokeniseer(vraag))];
  if (!termen.length || !docs.length) return [];
  const N = docs.length;
  const gemiddeldeLengte = lengteSom / N || 1;
  const scores = new Map();
  for (const term of termen) {
    const lijst = postings.get(term);
    if (!lijst) continue;
    // IDF met +0.5-correctie (Robertson/Sparck Jones): een term die in bijna elk document staat
    // levert nagenoeg niets op, een zeldzame term weegt zwaar.
    const idf = Math.log(1 + (N - lijst.length + 0.5) / (lijst.length + 0.5));
    for (const { d, tf } of lijst) {
      const doc = docs[d];
      const noemer = tf + K1 * (1 - B + B * (doc.lengte / gemiddeldeLengte));
      scores.set(d, (scores.get(d) || 0) + idf * (tf * (K1 + 1)) / noemer);
    }
  }
  const uit = [];
  for (const [d, score] of scores) {
    const doc = docs[d];
    if (nieuwerDan && doc.ts < nieuwerDan) continue;
    if (ouderDan && doc.ts > ouderDan) continue;
    if (soort && doc.soort !== soort) continue;
    if (doc.tekst.length < minLengte) continue;
    uit.push({ ...doc, score });
  }
  uit.sort((a, b) => b.score - a.score || b.ts - a.ts);
  return uit.slice(0, n);
}

// Cijfers over het archief, voor het dashboard en de opstartlog. `regelsTotaal` leest het bestand
// niet opnieuw uit: dat zou bij elke dashboard-refresh het hele archief van schijf halen.
function archiefOmvang() {
  if (!geladen) laadArchief({ stil: true });
  let bytes = 0;
  try { bytes = fs.statSync(archiefPad()).size; } catch (_) {}
  const sprekers = new Set(docs.map(d => d.spreker));
  return {
    doorzoekbaar: docs.length,
    bytes,
    sprekers: sprekers.size,
    oudste: docs.length ? docs[0].ts : null,
    nieuwste: docs.length ? docs[docs.length - 1].ts : null,
    termen: postings.size,
  };
}

module.exports = {
  ARCHIEF_BESTAND,
  INDEX_VENSTER,
  STOPWOORDEN,
  tokeniseer,
  laadArchief,
  voegToeAanArchief,
  zoekArchief,
  archiefOmvang,
};
