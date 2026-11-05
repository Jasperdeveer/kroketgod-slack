// ── Emoji-reacties van de Kroket God ───────────────────────────────────────────
// De Kroket God antwoordt alleen op @-menties, maar hij kijkt mee: op een bericht dat erom vraagt
// zet hij stil één emoji. Twee lagen (verzoek van de eigenaar, oktober 2026):
//   1. VASTE REGELS: een patroon in het bericht → een emoji, met een kans per regel zodat woorden
//      die vaak vallen ("lekker") niet elk bericht een emoji opleveren. Geen LLM.
//   2. DE SLIMME LAAG: bij een deel van de berichten zonder regel kiest een klein model uit een
//      vast palet (sarcasme, zeuren, drama…) of kiest "geen". Dat staat in index.js; hier alleen
//      het palet.
// De Duitse vlag voor wie een ander erbij probeert te naaien (lijktOpVerklikking in index.js)
// staat hier los van en blijft altijd aan.
//
// REMMEN. Eén emoji per bericht, per persoon hoogstens één per `perPersoonMs`, in totaal
// hoogstens `perUur` per uur. Daarboven niets, ook niet als een regel raak is: een emoji op elk
// bericht is ruis, geen oordeel.
//
// Puur: geen I/O, geen klok (de aanroeper geeft `nu`, uur en weekdag mee), op `rng` na.

'use strict';

// Diakritische tekens weg + kleine letters: "gefeliciteerd!" en "Gefeliciteerd" zijn gelijk.
function normaliseer(tekst) {
  return String(tekst ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Elke regel: `emoji` (Slack-naam zonder dubbele punten), `kans`, en `test(t, ctx)` op de
// genormaliseerde tekst, met ctx = { uur, weekdag, noemtKroketGodZonderMentie, quinty }. De VOLGORDE is
// de prioriteit: de eerste regel die raak is, beslist — ook als zijn kans dan niet valt. Zo levert een
// bericht dat over een kroket met ketchup gaat nooit "lekker" op omdat de ketchup-worp misliep. Een
// `zacht` regel die misliep, telt als geen regel: dan mag de slimme laag nog.
const REGELS = [
  { key: 'verjaardag', emoji: 'birthday', kans: 1,
    test: (t) => /\b(gefeliciteerd|proficiat|jarig|verjaardag|happy birthday|hoera)\b/.test(t) },
  { key: 'ketchup', emoji: 'rotating_light', kans: 1,
    test: (t) => /\b(ketchup|mayo|mayonaise|curry ?saus)\b/.test(t) && /kroket/.test(t) },
  { key: 'airfryer', emoji: 'ohhellno', kans: 0.8,
    test: (t) => /\b(airfryer|air fryer|hete ?lucht ?friteuse|magnetron)\b/.test(t) },
  { key: 'bitterbal', emoji: 'face_with_raised_eyebrow', kans: 1,
    test: (t) => /bitterbal/.test(t) && /\b(beter|lekkerder|wint|winnaar|superieur|boven)\b/.test(t) },
  { key: 'vrijdag', emoji: 'clock12', kans: 1,
    test: (t, ctx) => ctx.weekdag === 5 && /(\b12 ?uur\b|\b12[:.]00\b|\btwaalf uur\b|kroketmoment|lekkerkroketje|heilig(e)? moment)/.test(t) },
  { key: 'jargon', emoji: 'briefcase', kans: 0.8,
    test: (t) => /\b(ownership|synergie|kpi'?s?|sparren|deliverables?|alignen|aligned|stakeholders?|roadmap|scalen|mindset|proactief|helicopterview|quick wins?|low hanging fruit|bandbreedte|in de lead)\b/.test(t) },
  { key: 'complot', emoji: 'illuminati-kroket', kans: 0.8,
    test: (t) => /\b(complot|samenzwering|geheim|illuminati|doofpot|verborgen hand)\b/.test(t) },
  { key: 'verloren', emoji: 'sad-cat', kans: 0.8,
    test: (t) => /\b(punten kwijt|alles kwijt|blut|nul punten|0 punten|alles verloren|weer verloren)\b/.test(t)
      || (/\b(vetbad|offer|geofferd)\b/.test(t) && /\b(kwijt|weg|verloren|mislukt)\b/.test(t)) },
  { key: 'lenen', emoji: 'elmo-money', kans: 0.7,
    test: (t) => /\b(lenen|leen me|schuld|je bent me|ben je me|terugbetalen|terug betalen|wissel)\b/.test(t) },
  { key: 'excuses', emoji: 'shame-nun', kans: 0.8,
    test: (t) => /\b(sorry|sorrie|excuses|mijn fout|my bad|het spijt me|sry)\b/.test(t) },
  { key: 'komtgoed', emoji: 'saluting_face', kans: 0.7,
    test: (t) => /\b(komt goed|ik regel het|regel ik|doe ik|ik fix het|fix ik|consider it done|wordt geregeld)\b/.test(t) },
  { key: 'bluf', emoji: 'billed_cap', kans: 0.7,
    test: (t) => /(\bik zweer( het)?\b|\bzweer het\b|\becht waar\b|\b100 ?%|\bhonderd procent\b|\bgeen grap\b)/.test(t) },
  { key: 'opscheppen', emoji: 'clown_face', kans: 0.5,
    test: (t) => /\b(makkelijk|ez|easy|ik ben de beste|de beste van|ongeslagen|niemand kan mij|piece of cake|eitje)\b/.test(t) },
  { key: 'afwezig', emoji: 'candle', kans: 0.8,
    test: (t) => /\b(ben ziek|ziek thuis|griep|koorts|ben er niet|kan niet komen|afwezig|op vakantie|ben weg vandaag)\b/.test(t) },
  { key: 'vies', emoji: 'nauseated_face', kans: 0.8,
    test: (t) => /\b(vies|gadverdamme|gatverdamme|gadver|bah|walgelijk|smerig|kotsen|snack ?hel)\b/.test(t) },
  { key: 'frikandel', emoji: 'eyes', kans: 0.5,
    test: (t) => /frikandel/.test(t) },
  // Snacks met een eigen emoji in de werkruimte (verzoek van de eigenaar: vaker eigen emoji).
  { key: 'bosschebol', emoji: 'bosschebol', kans: 0.8,
    test: (t) => /bossche ?bol/.test(t) },
  { key: 'worstenbrood', emoji: 'worstenbrood', kans: 0.8,
    test: (t) => /worstenbrood/.test(t) },
  { key: 'kaas', emoji: 'lekker-kaasje', kans: 0.6,
    test: (t) => /\bkaas(je|jes|souffle|souffles)?\b/.test(t) },
  { key: 'snackbar', emoji: 'snackbar', kans: 0.5,
    test: (t) => /\b(snackbar|cafetaria|patatzaak|febo)\b/.test(t) },
  { key: 'lekker', emoji: 'lekker_kroketje', kans: 0.25,
    test: (t) => /\b(lekker|heerlijk|smaakt|smullen)\b/.test(t) || (/kroket/.test(t) && /\b(gegeten|op|gehaald|besteld)\b/.test(t)) },
  { key: 'kroketgod', emoji: 'eye', kans: 0.6,
    test: (t, ctx) => !!ctx.noemtKroketGodZonderMentie },
  { key: 'maandag', emoji: 'this-is-fine', kans: 0.7,
    test: (t, ctx) => /maandag/.test(t) && (ctx.weekdag === 1 || /\b(hekel|bah|zwaar|moe|ugh|alweer|haat)\b/.test(t)) },
  { key: 'nacht', emoji: 'owl', kans: 0.5,
    test: (t, ctx) => ctx.uur >= 0 && ctx.uur < 5 },
  { key: 'vroeg', emoji: 'rooster', kans: 0.5,
    test: (t, ctx) => ctx.uur >= 5 && ctx.uur < 7 },
  // Heel af en toe (verzoek van de eigenaar): een bericht van Quinty of over haar. Achteraan en
  // zacht, anders zou elk bericht van haar de andere regels en de slimme laag blokkeren.
  { key: 'quinty', emoji: 'quintrippy', kans: 0.15, zacht: true,
    test: (t, ctx) => !!ctx.quinty || /quint/.test(t) },
];

// Het palet van de slimme laag: de klasse die het model noemt → de emoji. "geen" is meestal het
// juiste antwoord, en het model moet dat ook weten. Na de eerste zes: eigen emoji van de werkruimte
// (verzoek van de eigenaar), bij dezelfde frequentie dus vaker eigen in plaats van vaker.
const SLIM_PALET = {
  sarcasme: { emoji: 'smirk', betekenis: 'het bericht is duidelijk sarcastisch of ironisch' },
  zeuren: { emoji: 'face_with_rolling_eyes', betekenis: 'iemand zeurt of klaagt over iets kleins' },
  drama: { emoji: 'popcorn', betekenis: 'er is ruzie of drama tussen leden aan de gang' },
  sterk: { emoji: 'fire', betekenis: 'iemand maakt een rake opmerking of een sterk punt' },
  gelijk: { emoji: 'crown', betekenis: 'iemand heeft overduidelijk gelijk' },
  oordeel: { emoji: 'scales', betekenis: 'er ligt een discussie die om een oordeel vraagt' },
  onnozel: { emoji: 'facepalm', betekenis: 'iemand doet of zegt iets onnozels' },
  chaos: { emoji: 'this-is-fine', betekenis: 'alles loopt in de soep, maar iemand doet alsof het prima gaat' },
  afkeer: { emoji: 'ohhellno', betekenis: 'een voorstel of idee dat echt niet kan' },
  terugkaatsen: { emoji: 'uno_reverse', betekenis: 'iemand kaatst een verwijt of plaagstoot terug naar de afzender' },
  schande: { emoji: 'shame-nun', betekenis: 'iemand bekent iets beschamends' },
  feest: { emoji: 'party_parrot', betekenis: 'goed nieuws of iets om te vieren' },
  verdriet: { emoji: 'sad-cat', betekenis: 'iemand is teleurgesteld of verdrietig' },
  geld: { emoji: 'elmo-money', betekenis: 'het gaat over geld, punten of rijk worden' },
  stoer: { emoji: 'deal_with_it_parrot', betekenis: 'iemand doet overdreven stoer of zelfverzekerd' },
  paniek: { emoji: 'panic', betekenis: 'haast, een deadline of paniek' },
  ongemak: { emoji: 'awkward', betekenis: 'een pijnlijke of ongemakkelijke opmerking' },
  verbazing: { emoji: 'omgcat', betekenis: 'iets onverwachts of schokkends' },
};
const SLIM_KLASSEN = [...Object.keys(SLIM_PALET), 'geen'];

// De klasse van de slimme laag → de emoji. Is de Kroket God het met Sander eens (hij heeft gelijk
// of maakt een sterk punt), dan zijn eigen :santi-jatoch: in plaats van kroon of vuur (verzoek van
// de eigenaar, zoals :quintrippy: bij Quinty).
function slimEmoji(klasse, { sander = false } = {}) {
  if (sander && (klasse === 'gelijk' || klasse === 'sterk')) return 'santi-jatoch';
  return SLIM_PALET[klasse]?.emoji || null;
}

// Laag / normaal / hoog (dashboard). `regelFactor` vermenigvuldigt de kans van elke regel,
// `slimKans` is het deel van de berichten zonder regel dat de slimme laag te zien krijgt.
// LAAG is de standaard (keuze van de eigenaar): een emoji van de Kroket God moet iets bijzonders
// blijven, en dat is hij alleen als hij zelden komt.
const FREQUENTIES = {
  laag: { perUur: 3, perPersoonMs: 60 * 60_000, regelFactor: 0.5, slimKans: 0.1 },
  normaal: { perUur: 8, perPersoonMs: 20 * 60_000, regelFactor: 1, slimKans: 0.25 },
  hoog: { perUur: 15, perPersoonMs: 8 * 60_000, regelFactor: 1, slimKans: 0.5 },
};
const FREQUENTIE_STANDAARD = 'laag';
const frequentie = (naam) => FREQUENTIES[naam] || FREQUENTIES[FREQUENTIE_STANDAARD];

// De eerste regel die raak is, en of zijn kans valt. { regel, raak: true, emoji|null } of null
// als geen regel past. `emoji` is null als de regel wel paste maar de worp misliep: dan krijgt
// het bericht niets, ook niet van de slimme laag.
function kiesRegel(tekst, ctx = {}, { factor = 1, rng = Math.random } = {}) {
  const t = normaliseer(tekst);
  const regel = REGELS.find(r => r.test(t, ctx));
  if (!regel) return null;
  const valt = rng() < regel.kans * factor;
  if (!valt && regel.zacht) return null;
  return { key: regel.key, emoji: valt ? regel.emoji : null };
}

// Mag er nu een emoji op een bericht van `userId`? `log` is de lijst van eerdere reacties
// [{ userId, ts }]; alleen het laatste uur telt.
function magReageren(log, userId, nu, freq) {
  const recent = (log || []).filter(r => nu - r.ts < 3_600_000);
  if (recent.length >= freq.perUur) return false;
  return !recent.some(r => r.userId === userId && nu - r.ts < freq.perPersoonMs);
}

function naReactie(log, userId, nu) {
  return [...(log || []).filter(r => nu - r.ts < 3_600_000), { userId, ts: nu }];
}

module.exports = {
  REGELS, SLIM_PALET, SLIM_KLASSEN, FREQUENTIES, FREQUENTIE_STANDAARD, frequentie, normaliseer, kiesRegel, magReageren, naReactie,
  slimEmoji,
};
