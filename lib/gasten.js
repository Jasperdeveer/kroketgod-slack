// ── Gasten uitnodigen ──────────────────────────────────────────────────────────
// Een lid kan een nevenentiteit (persona) in het kanaal halen: een NIEUWE gast die het zelf
// beschrijft (KOSTEN_NIEUW punten), of een BEKENDE gast uit personas.json die nu niet actief is
// (KOSTEN_BESTAAND punten). Hier staan alleen de regels: wat een geldige uitnodiging is en wat de
// lijst met bekende gasten toont. Pure functies, zodat de test ze zonder Slack kan draaien.
//
// WAAROM zo streng op trefwoorden: een persona reageert zodra een van zijn trefwoorden aan het
// begin van een woord in een bericht staat (zie trefwoordKomtVoor in index.js). Een trefwoord als
// "kro" of "wat" zou de gast op bijna elk bericht laten reageren, en een trefwoord dat al van een
// andere gast is, laat de ene gast de andere overstemmen — vindPersonaTrigger neemt de eerste.

const { isWeekendAms } = require('./tijd.js');

const KOSTEN_NIEUW = 5;
const KOSTEN_BESTAAND = 2;
// Was 20, zonder reden (oktober 2026, eigenaar). De echte grens zit in Slack: het venster met bekende
// gasten toont ze in een keuzelijst als ze niet meer als losse blokken passen, en die houdt bij 100 op.
const MAX_GASTEN = 100;         // ook de grens van het dashboard (personas.json)
const NAAM_MAX = 60;
const TREFWOORD_MIN = 3;
const TREFWOORD_MAX = 30;
const TREFWOORDEN_MAX = 8;
const BESCHRIJVING_MIN = 30;
const BESCHRIJVING_MAX = 3000;

// Woorden die in bijna elk bericht in het kanaal staan. Een trefwoord mag er geen van zijn en mag
// er ook niet het begin van zijn ("kro" → kroket).
const TE_ALGEMEEN = [
  'kroket', 'kroketten', 'kroketje', 'kroketgod', 'god', 'frituur', 'frituren', 'snack', 'snacks',
  'punten', 'punt', 'lekker', 'vrijdag', 'iedereen', 'mensen', 'vandaag', 'morgen', 'gisteren',
  'friet', 'frietjes', 'patat', 'eten', 'vroeger', 'werk', 'weekend',
  'wat', 'wie', 'waar', 'hoe', 'waarom', 'dat', 'die', 'dit', 'deze', 'niet', 'maar', 'ook', 'nog',
  'wel', 'zijn', 'ben', 'bent', 'heb', 'hebt', 'heeft', 'van', 'voor', 'met', 'dan', 'kan', 'als',
  'toch', 'dus', 'weer', 'gaan', 'gaat', 'goed', 'haha', 'lol', 'oke', 'hallo', 'hoi', 'hey',
  'jij', 'jullie', 'wij', 'zij', 'hij', 'het', 'een', 'and', 'the',
];

// De Kroket God zelf is geen gast: een persona spreekt nooit met zijn stem.
const VERBODEN_NAAM = /kroket\s*god|almachtige|frituurgod|hoge\s+frituurraad/;

// Diakritische tekens weg + kleine letters, zoals normaliseerVoorMatch in index.js.
function normaliseer(tekst) {
  return String(tekst ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Staat `trefwoord` aan het begin van een woord in `tekst`? (Dezelfde regel als de trigger.)
function komtVoor(tekst, trefwoord) {
  const geescaped = trefwoord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${geescaped}`).test(tekst);
}

// Twee trefwoorden bijten elkaar als een bericht met het ene ook het andere raakt.
function botst(a, b) {
  return komtVoor(a, b) || komtVoor(b, a);
}

// "Satébal, saté;  SATÉSAUS\nsate" → ['satebal', 'sate', 'satesaus'] (genormaliseerd, uniek).
function parseTrefwoorden(tekst) {
  const gezien = new Set();
  for (const ruw of String(tekst ?? '').split(/[,;\n]+/)) {
    const w = normaliseer(ruw).replace(/\s+/g, ' ');
    if (w) gezien.add(w);
  }
  return [...gezien];
}

const isGerichtePersona = (p) => !!p?.alleenVoorLid;
const isAanwezig = (p) => p?.actief !== false;

// Toetst een uitnodiging voor een nieuwe gast. Geeft { ok: true, naam, trefwoorden, beschrijving }
// of { ok: false, fouten } terug, met `fouten` per block_id van het formulier — precies wat Slack
// verwacht bij response_action 'errors'. `verdacht(tekst)` is de injectietoets uit prompt-safety.
function toetsNieuweGast({ naam, trefwoorden, beschrijving, personas = {}, saldo = 0, verdacht = () => false }) {
  const fouten = {};
  const schoneNaam = String(naam ?? '').replace(/\s+/g, ' ').trim();
  const lijst = parseTrefwoorden(trefwoorden);
  const tekst = String(beschrijving ?? '').trim();
  const bestaande = Object.entries(personas || {});

  if (saldo < KOSTEN_NIEUW) {
    fouten.naam_block = `Een nieuwe gast kost ${KOSTEN_NIEUW} kroketpunten en u heeft er ${saldo}.`;
  } else if (bestaande.length >= MAX_GASTEN) {
    fouten.naam_block = `Het gastenverblijf is vol (${MAX_GASTEN} gasten). Haal een bekende gast terug in plaats van een nieuwe.`;
  } else if (!schoneNaam) {
    fouten.naam_block = 'Uw gast heeft een naam nodig.';
  } else if (schoneNaam.length > NAAM_MAX) {
    fouten.naam_block = `Hoogstens ${NAAM_MAX} tekens.`;
  } else if (VERBODEN_NAAM.test(normaliseer(schoneNaam))) {
    fouten.naam_block = 'De Kroket God laat zich niet uitnodigen. Hij is er al.';
  } else if (verdacht(schoneNaam)) {
    fouten.naam_block = 'De Raad weigert deze naam.';
  } else {
    const dubbel = bestaande.find(([, p]) => normaliseer(p?.naam) === normaliseer(schoneNaam));
    if (dubbel) fouten.naam_block = `${dubbel[1].naam} bestaat al. Haal hem terug als bekende gast (${KOSTEN_BESTAAND} punten).`;
  }

  if (!lijst.length) {
    // Leeg mag: dan kiest de Raad ze zelf bij het uitschrijven (kiesTrefwoorden).
  } else if (lijst.length > TREFWOORDEN_MAX) {
    fouten.trefwoord_block = `Hoogstens ${TREFWOORDEN_MAX} trefwoorden.`;
  } else if (verdacht(String(trefwoorden ?? ''))) {
    fouten.trefwoord_block = 'De Raad weigert deze trefwoorden.';
  } else {
    const teKort = lijst.find(w => w.length < TREFWOORD_MIN);
    const teLang = lijst.find(w => w.length > TREFWOORD_MAX);
    const algemeen = lijst.find(w => TE_ALGEMEEN.some(a => komtVoor(a, w)));
    let botsing = null;
    for (const w of lijst) {
      for (const [, p] of bestaande) {
        const hun = parseTrefwoorden(p?.trefwoord).find(e => botst(w, e));
        if (hun) { botsing = { w, van: p.naam }; break; }
      }
      if (botsing) break;
    }
    if (teKort) fouten.trefwoord_block = `"${teKort}" is te kort — minstens ${TREFWOORD_MIN} letters.`;
    else if (teLang) fouten.trefwoord_block = `"${teLang.slice(0, 40)}" is te lang — hoogstens ${TREFWOORD_MAX} tekens.`;
    else if (algemeen) fouten.trefwoord_block = `"${algemeen}" valt in bijna elk bericht. Kies iets dat bij uw gast hoort.`;
    else if (botsing) fouten.trefwoord_block = `"${botsing.w}" bijt met een trefwoord van ${botsing.van}. Kies een ander.`;
  }

  if (tekst.length < BESCHRIJVING_MIN) {
    fouten.beschrijving_block = 'Vertel iets meer over uw gast: wie hij is en hoe hij praat.';
  } else if (tekst.length > BESCHRIJVING_MAX) {
    fouten.beschrijving_block = `Hoogstens ${BESCHRIJVING_MAX} tekens.`;
  } else if (verdacht(tekst)) {
    fouten.beschrijving_block = 'Dit leest als een poging de Raad te bevelen. Beschrijf alleen uw gast.';
  }

  if (Object.keys(fouten).length) return { ok: false, fouten };
  return { ok: true, naam: schoneNaam, trefwoorden: lijst, beschrijving: tekst };
}

// Trefwoorden uit de naam zelf: de woorden van vier letters of meer, zonder lidwoorden en titels.
// "De Frikandel Fluisteraar" → ['frikandel', 'fluisteraar']
const NAAM_STOPWOORDEN = new Set(['de', 'het', 'een', 'heilige', 'mister', 'mr', 'god', 'van', 'der', 'den']);
function naamTrefwoorden(naam) {
  return normaliseer(naam).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !NAAM_STOPWOORDEN.has(w));
}

const GEKOZEN_MAX = 5;

// Liet het lid de trefwoorden leeg, dan stelt de Raad ze voor bij het uitschrijven van het karakter.
// Die voorstellen gaan door dezelfde zeef als die van een lid: te kort, te lang, te algemeen of al
// van een andere gast → weg. Blijven er minder dan twee over, dan vult de naam aan. Kan leeg
// uitkomen; dan moet het lid ze zelf invullen.
function kiesTrefwoorden(voorstel, { naam = '', personas = {} } = {}) {
  const bezet = Object.values(personas || {}).flatMap(p => parseTrefwoorden(p?.trefwoord));
  const bruikbaar = (w) => w.length >= TREFWOORD_MIN && w.length <= TREFWOORD_MAX
    && !TE_ALGEMEEN.some(a => komtVoor(a, w)) && !bezet.some(e => botst(w, e));
  const gekozen = [];
  const neem = (w) => { if (gekozen.length < GEKOZEN_MAX && !gekozen.includes(w) && bruikbaar(w)) gekozen.push(w); };
  parseTrefwoorden(voorstel).forEach(neem);
  if (gekozen.length < 2) naamTrefwoorden(naam).forEach(neem);
  return gekozen;
}

// De bekende gasten voor het keuzevenster: iedereen uit personas.json, behalve de gerichte
// persona's (die horen bij één lid en zijn niet voor anderen op te roepen). Op naam gesorteerd,
// met wie er al is apart gemarkeerd.
function bekendeGasten(personas = {}) {
  return Object.entries(personas || {})
    .filter(([, p]) => p?.naam && !isGerichtePersona(p))
    .map(([id, p]) => ({
      id,
      naam: p.naam,
      icoon: p.icoon || '',
      trefwoorden: parseTrefwoorden(p.trefwoord).slice(0, 4),
      aanwezig: isAanwezig(p),
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

// Mag deze bekende gast nu worden teruggehaald? { ok: true, persona } of { ok: false, reden }.
function toetsBekendeGast({ id, personas = {}, saldo = 0 }) {
  const p = personas?.[id];
  if (!p || isGerichtePersona(p)) return { ok: false, reden: 'Die gast bestaat niet meer.' };
  if (isAanwezig(p)) return { ok: false, reden: `${p.naam} is er al.` };
  if (saldo < KOSTEN_BESTAAND) return { ok: false, reden: `Een bekende gast terughalen kost ${KOSTEN_BESTAAND} kroketpunten en u heeft er ${saldo}.` };
  return { ok: true, persona: p };
}

// Een uitgenodigde gast blijft GAST_WERKDAGEN werkdagen (verzoek eigenaar, 29 oktober 2026) en neemt
// precies zo lang na zijn binnenkomst afscheid. Zaterdag en zondag (Amsterdam) tellen niet mee: wie
// vrijdagmiddag binnenkomt, vertrekt woensdagmiddag. Een vertrek valt zo nooit in het weekend.
// shortcut: rond de zomertijdwissel schuift het vertrek een uur; geen reden om met wandkloktijd te rekenen.
const GAST_WERKDAGEN = 3;
function vertrekNaWerkdagen(start, werkdagen = GAST_WERKDAGEN) {
  let t = start;
  for (let i = 0; i < werkdagen; i++) do t += 86_400_000; while (isWeekendAms(new Date(t)));
  return t;
}

// Wie moet er nu weg? De aanwezige gast wiens vertrektijd het langst verstreken is, of null. Een gast
// zonder vertrektijd (aangezet in het dashboard) blijft tot iemand hem uitzet.
function eersteVertrekker(personas = {}, nu = Date.now()) {
  const weg = Object.entries(personas || {})
    .filter(([, p]) => p?.naam && isAanwezig(p) && p.vertrekOp && p.vertrekOp <= nu)
    .sort(([, a], [, b]) => a.vertrekOp - b.vertrekOp);
  return weg.length ? weg[0][0] : null;
}

// Gast vasthouden (verzoek eigenaar, 2 november 2026): een gast die vandaag afscheid neemt, houdt een
// lid voor KOSTEN_VASTHOUDEN punten een werkdag langer vast. Daarna vertrekt hij niet meer vandaag, dus
// kan het hooguit één keer per dag per gast. Een gast zonder vertrektijd blijft al voor altijd.
const KOSTEN_VASTHOUDEN = 2;
const amsDag = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(t));
const vertrektVandaag = (p, nu = Date.now()) => isAanwezig(p) && !!p?.vertrekOp && amsDag(p.vertrekOp) <= amsDag(nu);
// Een werkdag erbij, gerekend vanaf de vertrektijd; ligt die al achter ons (een vertrek dat in de
// stille modus bleef hangen), dan vanaf nu.
const verlengdVertrek = (p, nu = Date.now()) => vertrekNaWerkdagen(Math.max(p.vertrekOp || 0, nu), 1);

function toetsVasthouden({ id, personas = {}, saldo = 0, nu = Date.now() }) {
  const p = personas?.[id];
  if (!p || isGerichtePersona(p) || !isAanwezig(p)) return { ok: false, reden: 'Die gast is al vertrokken.' };
  if (!vertrektVandaag(p, nu)) return { ok: false, reden: `${p.naam} neemt vandaag geen afscheid; vasthouden kan op zijn laatste dag.` };
  if (saldo < KOSTEN_VASTHOUDEN) return { ok: false, reden: `Een gast vasthouden kost ${KOSTEN_VASTHOUDEN} kroketpunten en u heeft er ${saldo}.` };
  return { ok: true, persona: p };
}

// De winnaar van het gastendebat blijft een werkdag langer: een gast met vertrektijd schuift door, een
// daggast van het lot wordt tot de volgende werkdag een gewone gast. Geeft de nieuwe persona terug.
function naDebatWinst(p, nu = Date.now()) {
  if (!isAanwezig(p)) return { ...p, actief: true, uitgenodigdDoor: 'debat', uitgenodigdOp: nu, vertrekOp: vertrekNaWerkdagen(nu, 1) };
  return p.vertrekOp ? { ...p, vertrekOp: verlengdVertrek(p, nu) } : p;
}

module.exports = {
  KOSTEN_VASTHOUDEN, vertrektVandaag, verlengdVertrek, toetsVasthouden, naDebatWinst,
  KOSTEN_NIEUW, KOSTEN_BESTAAND, MAX_GASTEN, NAAM_MAX, TREFWOORDEN_MAX, BESCHRIJVING_MIN, BESCHRIJVING_MAX,
  GAST_WERKDAGEN, TE_ALGEMEEN, normaliseer, komtVoor, botst, parseTrefwoorden, naamTrefwoorden, kiesTrefwoorden,
  toetsNieuweGast, bekendeGasten, toetsBekendeGast, vertrekNaWerkdagen, eersteVertrekker,
};
