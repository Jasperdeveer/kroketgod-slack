// ── Het Gepanneerde Rijk, op maat gesneden ────────────────────────────────────
// Bij een rijksvraag ging gepanneerde_rijk.txt in z'n geheel de systeemprompt in: 13.000 tekens,
// ~3.700 tokens, bovenop een prompt die al tegen Groqs plafond van 8.000 zat. Dat verzoek kon
// Groq nooit aannemen (413), en Gemini betaalde er elke keer z'n quotum voor.
//
// Nu een samenvatting van ~1.000 tokens, rechtstreeks uit hetzelfde bestand gesneden — dus geen
// tweede lore-tekst om bij te houden. Altijd mee: de kopregels (de naam van het Derde Rijk valt
// nooit), de eerste alinea van "wat is het", de GRENZEN en hoe de Kroket God erover spreekt. Wat er
// dan nog in het budget past, gaat naar de secties die het meest over de vraag gaan.

const STOPWOORDEN = new Set([
  'over', 'deze', 'die', 'dat', 'wat', 'waren', 'was', 'zijn', 'heeft', 'hebben', 'wordt', 'werd',
  'voor', 'naar', 'met', 'een', 'het', 'van', 'hoe', 'waarom', 'wanneer', 'wie', 'welke', 'ooit',
  'kroket', 'kroketgod', 'god', 'eigenlijk', 'vertel', 'weet', 'jullie', 'onze', 'ons', 'mijn', 'uw',
]);

// Secties die altijd meegaan, op titel herkend (hoofdletterongevoelig, op een stuk van de titel).
const ALTIJD = [/^wat is/i, /^grenzen/i, /^hoe spreekt/i];

const alinea = (t) => t.split(/\n\s*\n/).map(a => a.trim()).filter(Boolean);

// Kleinste kiesbare stukken van een sectie: gewone alinea's, maar een lijst ("- De Groene Kroket —
// …") wordt per item gesplitst, inclusief zijn ingesprongen vervolgregels. De lijst sleutelfiguren
// is één alinea van 1.400 tekens; zonder deze splitsing paste hij nooit, ook niet als de vraag over
// één van die figuren ging.
function stukken(tekst) {
  const uit = [];
  alinea(tekst).forEach((a, j) => {
    let huidig = null;
    for (const regel of a.split('\n')) {
      const nieuwItem = /^\s*- /.test(regel);
      const vervolg = huidig?.lijst && /^\s+\S/.test(regel) && !nieuwItem;
      if (huidig && (vervolg || (!nieuwItem && !huidig.lijst))) {
        huidig.tekst += `\n${regel}`;
      } else {
        huidig = { tekst: regel, alinea: j, lijst: nieuwItem };
        uit.push(huidig);
      }
    }
  });
  return uit.map((x, k) => ({ ...x, k }));
}
const woorden = (t) => (String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .match(/[a-z]{4,}/g) || []).filter(w => !STOPWOORDEN.has(w));

// Splits het rijksbestand in kop (de //-regels bovenaan) en secties ({ titel, tekst }).
function parseRijk(tekst) {
  const delen = String(tekst).split(/━━━\s*(.+?)\s*━━━/);
  const kop = delen[0].split('\n').filter(r => r.trim()).map(r => r.replace(/^\/\/\s?/, '')).join('\n');
  const secties = [];
  for (let i = 1; i < delen.length; i += 2) secties.push({ titel: delen[i].trim(), tekst: delen[i + 1].trim() });
  return { kop, secties };
}

// Hoe sterk gaat een sectie over de vraag? Woorden die in elke sectie staan ("rijk", "frietopia")
// tellen nauwelijks; zeldzame woorden ("olympische", "john") des te meer. Een treffer in de titel
// telt dubbel.
function scoreSecties(secties, vraag) {
  const vraagWoorden = [...new Set(woorden(vraag))];
  const inSectie = secties.map(s => new Set(woorden(`${s.titel} ${s.tekst}`)));
  const inTitel = secties.map(s => new Set(woorden(s.titel)));
  const n = secties.length;
  return secties.map((s, i) => vraagWoorden.reduce((som, w) => {
    const raak = (set) => [...set].some(x => x.startsWith(w) || w.startsWith(x));
    if (!raak(inSectie[i])) return som;
    const df = inSectie.filter(raak).length;
    const gewicht = Math.log((n + 1) / df);
    return som + gewicht * (raak(inTitel[i]) ? 2 : 1);
  }, 0));
}

// De samenvatting. `maxTekens` ~3.500 ≈ 1.000 tokens.
function rijkDigest(volledig, vraag = '', { maxTekens = 3500 } = {}) {
  const { kop, secties } = parseRijk(volledig);
  const isAltijd = (s) => ALTIJD.some(re => re.test(s.titel));
  const blok = (titel, tekst) => `── ${titel} ──\n${tekst}`;

  const kern = [kop];
  for (const s of secties.filter(isAltijd)) {
    // Van "wat is het" alleen de eerste alinea; van de rest alles behalve de voorbeeldzinnen,
    // die alleen stijl geven (en de stijl staat al in de systeemprompt).
    const tekst = /^wat is/i.test(s.titel)
      ? alinea(s.tekst)[0]
      : s.tekst.split(/\n\s*VOORBEELDZINNEN:/)[0].trim();
    kern.push(blok(s.titel, tekst));
  }

  const scores = scoreSecties(secties, vraag);
  const kandidaten = secties
    .map((s, i) => ({ s, score: scores[i], i }))
    .filter(k => !isAltijd(k.s))
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const vraagWoorden = new Set(woorden(vraag));
  const treffers = (a) => woorden(a).filter(w => [...vraagWoorden].some(v => w.startsWith(v) || v.startsWith(w))).length;

  let ruimte = maxTekens - kern.join('\n\n').length;
  const extra = [];
  for (const { s, i } of kandidaten) {
    if (ruimte < 200) break;
    // Hele alinea's (of lijstitems), zo veel als er passen: liever drie complete dan vijf halve. Wat
    // over de vraag gaat eerst ("wie won de Olympische Spelen" staat in de vierde alinea van de
    // toekomstvisie), daarna in volgorde; in het blok weer in de volgorde van het bestand.
    const kandidaatStukken = stukken(s.tekst).map(x => ({ ...x, t: treffers(x.tekst) }));
    const gekozen = [];
    let lengte = s.titel.length + 8;
    for (const x of [...kandidaatStukken].sort((p, q) => q.t - p.t || p.k - q.k)) {
      if (lengte + x.tekst.length + 2 > ruimte) continue;
      gekozen.push(x);
      lengte += x.tekst.length + 2;
    }
    if (!gekozen.length) continue;
    gekozen.sort((p, q) => p.k - q.k);
    // Stukken uit dezelfde alinea (lijstitems) op aansluitende regels, anders een witregel ertussen.
    const tekst = gekozen.map((x, n) => (n && gekozen[n - 1].alinea === x.alinea ? '\n' : n ? '\n\n' : '') + x.tekst).join('');
    extra.push({ i, tekst: blok(s.titel, tekst) });
    ruimte -= lengte + 2;
  }
  // In de volgorde van het bestand, zodat het als één verhaal leest.
  extra.sort((a, b) => a.i - b.i);
  return [...kern, ...extra.map(e => e.tekst)].join('\n\n');
}

module.exports = { parseRijk, rijkDigest };
