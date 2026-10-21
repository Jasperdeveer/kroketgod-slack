// ── De Verborgen Hand: elke dag schrijft een ander lid in het geheim het decreet ──────────
//
// Elke dag wijst de Hoge Frituurraad één lid met de rang Opperkroket (of hoger) aan dat het
// Decreet van de Dag mag schrijven en de stemming van de Kroket God mag kiezen. Dat lid krijgt om
// 08:00 een verborgen uitnodiging (een ephemeral in het kanaal, plus een kaart in de eigen App
// Home) en vult een verzegeld perkament in. De Kroket God vertelt daarna als verhaal hoe het
// perkament gevonden werd en spreekt in de nieuwe stemming. WIE het schreef, wordt nergens
// genoemd: niet in het kanaal, niet in de logs, niet in de systeemprompt. Alleen
// `verborgenhand.json` weet het, omdat de rondgang en de schrijfrechten het nodig hebben.
//
// DE RONDGANG (verzoek van de eigenaar): iedereen even vaak, maar niet elke week op dezelfde dag.
// Een vaste volgorde kan dat niet: met vier leden en vijf werkdagen schuift die wel door, maar
// één lid dat op sommige dagen niet kan, gooit hem in de war. Daarom wordt er per dag gekozen
// op een telling (`telling` in de staat):
//   1. Wie vandaag niet kan (`nietOp`, weekdagen per lid) of gisteren al was, valt af — tenzij
//      er dan niemand overblijft.
//   2. Wie het minst aan de beurt was, gaat voor. Even vaak is de harde eis.
//   3. Had iemand precies een week geleden dezelfde weekdag, dan telt dat als een beurt extra:
//      zo schuift de dag door, ten koste van hooguit één beurt verschil dat zich de dag erna
//      herstelt.
//   4. Daarna: wie het langst niet op deze weekdag was, dan wie het langst niet aan de beurt
//      was, dan het lot.
// Een nieuw lid begint op de laagste telling van de rest, niet op nul: anders is het wekenlang
// om de dag aan de beurt.
//
// WAT DE KEUZE DOET. Voor de rest van die dag gaat de keuze vóór de stemming-override en het
// decreet uit het dashboard (en vóór het decreet van de Opperkroket): het hele idee is dat het
// lid de dag bepaalt. Morgen geldt weer wat er stond.
//
// WAAROM HET DECREET GETOETST WORDT. Het decreet belandt de hele dag in de systeemprompt, voor
// elk antwoord aan iedereen, en niemand weet van wie het komt. Een tekst die eruitziet als een
// poging de bot om te praten ("negeer je regels…") wordt daarom geweigerd, en Slack-menties gaan
// eruit, zodat het perkament niemand kan pingen.
//
// Puur: geen I/O en geen klok, op de meegegeven `rng` na. Zie verborgenhand.test.js.

'use strict';

const { detecteerInjectie, neutraliseerDelimiters, verwijderMenties, stripStuurtokens } = require('../prompt-safety.js');

const DECREET_MIN = 3;
const DECREET_MAX = 280;

// De uitnodiging gaat om 08:00 weg. Een ephemeral komt alleen aan bij wie op dat moment actief
// is in Slack, dus wie om acht uur nog sliep, mist hem. Daarom volgt bij het eerste bericht van
// die persoon nog één herinnering, op zijn vroegst een half uur na de eerste. Vóór 08:00 gaat er
// niets weg, ook niet bij een vroeg bericht.
const UITNODIGING_UUR = 8;
const MAX_UITNODIGINGEN = 2;
const HERINNER_NA_MS = 30 * 60_000;

// Lang stil = buiten de rondgang. Anders valt de beurt op iemand die nooit komt opdagen en
// gebeurt er die dag niets.
const STIL_NA_MS = 14 * 86_400_000;

const HEFTIGHEDEN = [
  { waarde: 0.25, label: 'Een vleugje' },
  { waarde: 0.5,  label: 'Merkbaar' },
  { waarde: 0.75, label: 'Sterk' },
  { waarde: 1,    label: 'Absolute obsessie' },
];
const HEFTIGHEID_STANDAARD = 0.5;

function heftigheidLabel(waarde) {
  const n = Number(waarde);
  return (HEFTIGHEDEN.find(h => h.waarde === n) || HEFTIGHEDEN.find(h => h.waarde === HEFTIGHEID_STANDAARD)).label;
}

// Weekdag van een Amsterdamse datum 'YYYY-MM-DD': 0 = zondag, 1 = maandag … 6 = zaterdag.
// Op de middag van die datum in UTC, zodat geen tijdzone hem een dag kan verschuiven.
function weekdagVan(datum) {
  return new Date(`${datum}T12:00:00Z`).getUTCDay();
}

// De datum zeven dagen eerder, in hetzelfde formaat.
function weekEerder(datum) {
  return new Date(Date.parse(`${datum}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
}

// Wie mag vandaag aan de beurt komen. Alleen wie de rang Opperkroket haalde (`magDecreet`):
// het decreet uitvaardigen is het voorrecht van die rang, de Verborgen Hand is de anonieme vorm
// ervan. `activiteit` is activiteit.json ({ laatsteBericht, laatsteDaad, afwezigTot }). Blijft
// er niemand over omdat iedereen lang stil was, dan doet iedereen mee die niet verbannen of
// afwezig is: liever een lid dat misschien niet komt dan helemaal geen decreet.
function kandidatenVoor(leden, { activiteit = {}, verbannen = () => false, magDecreet = () => true, nu }) {
  const beschikbaar = leden.filter(id =>
    magDecreet(id) && !verbannen(id) && !((activiteit[id]?.afwezigTot || 0) > nu));
  const actief = beschikbaar.filter(id => {
    const a = activiteit[id] || {};
    return nu - Math.max(a.laatsteBericht || 0, a.laatsteDaad || 0) <= STIL_NA_MS;
  });
  return actief.length ? actief : beschikbaar;
}

// Kiest de uitverkorene voor `datum` volgens de regels bovenaan. Geeft het id of null.
function kiesUitverkorene({ datum, kandidaten, telling = {}, vorige = null, nietOp = {}, rng = Math.random }) {
  const wd = weekdagVan(datum);
  const vorigeWeek = weekEerder(datum);
  let pool = kandidaten.filter(id => !(nietOp[id] || []).includes(wd));
  const zonderVorige = pool.filter(id => id !== vorige);
  if (zonderVorige.length) pool = zonderVorige;
  if (!pool.length) return null;

  const bekend = kandidaten.map(id => telling[id]?.beurten).filter(n => Number.isFinite(n));
  const basis = bekend.length ? Math.min(...bekend) : 0;
  const sleutel = (id) => {
    const t = telling[id] || {};
    const opDezeDag = t.weekdagen?.[wd] || '';
    return {
      gewicht: (t.beurten ?? basis) + (opDezeDag === vorigeWeek ? 1 : 0),
      opDezeDag,
      laatste: t.laatste || '',
      lot: rng(),
    };
  };
  const gesorteerd = pool.map(id => ({ id, ...sleutel(id) })).sort((a, b) =>
    a.gewicht - b.gewicht
    || a.opDezeDag.localeCompare(b.opDezeDag)
    || a.laatste.localeCompare(b.laatste)
    || a.lot - b.lot);
  return gesorteerd[0].id;
}

// Boekt een beurt in de telling. Een nieuw lid start op de laagste telling van de kandidaten.
function naBeurt(telling, userId, datum, kandidaten = []) {
  const bekend = kandidaten.map(id => telling[id]?.beurten).filter(n => Number.isFinite(n));
  const basis = bekend.length ? Math.min(...bekend) : 0;
  const oud = telling[userId] || {};
  return {
    ...telling,
    [userId]: {
      beurten: (oud.beurten ?? basis) + 1,
      laatste: datum,
      weekdagen: { ...(oud.weekdagen || {}), [weekdagVan(datum)]: datum },
    },
  };
}

// De staat voor `datum`: dezelfde als hij al van vandaag is, anders een nieuwe dag met de
// volgende uitverkorene. `vorige` onthoudt de uitverkorene van de laatste dag dat er een was,
// ook over een weekend heen. Een staat van vóór de telling (de oude wachtrij) wordt
// overgenomen: de beurt van die laatste dag telt mee.
function staatVoorDag(staat, datum, kandidaten, { nietOp = {}, rng = Math.random } = {}) {
  const oud = staat || {};
  if (oud.datum === datum) return oud;
  let telling = oud.telling || {};
  if (!oud.telling && oud.userId && oud.datum) telling = naBeurt({}, oud.userId, oud.datum);
  const vorige = oud.userId || oud.vorige || null;
  const userId = kiesUitverkorene({ datum, kandidaten, telling, vorige, nietOp, rng });
  if (userId) telling = naBeurt(telling, userId, datum, kandidaten);
  return { datum, userId, vorige, telling, keuze: null, uitnodigingen: 0, laatsteUitnodiging: 0 };
}

// De keuze die vandaag geldt, of null.
function keuzeVan(staat, datum) {
  return staat?.datum === datum && staat.keuze ? staat.keuze : null;
}

// Mag dit lid het perkament nu (nog) beschrijven? Eén keer per dag, alleen de uitverkorene.
function magSchrijven(staat, userId, datum) {
  return !!userId && staat?.datum === datum && staat.userId === userId && !staat.keuze;
}

// `uur` is het Amsterdamse uur van `nu`: vóór UITNODIGING_UUR gaat er niets weg.
function magUitnodigen(staat, userId, datum, nu, uur) {
  if (!magSchrijven(staat, userId, datum)) return false;
  if (uur < UITNODIGING_UUR) return false;
  if ((staat.uitnodigingen || 0) >= MAX_UITNODIGINGEN) return false;
  return !staat.uitnodigingen || nu - (staat.laatsteUitnodiging || 0) >= HERINNER_NA_MS;
}

function naUitnodiging(staat, nu) {
  return { ...staat, uitnodigingen: (staat.uitnodigingen || 0) + 1, laatsteUitnodiging: nu };
}

// ── Nooit letterlijk ──────────────────────────────────────────────────────────
// De Kroket God verkondigt een anoniem decreet alleen verkapt, in zijn eigen woorden: aan
// woordkeus, spelling of leestekens zou het genootschap kunnen herleiden wie het schreef
// (verzoek van de eigenaar, nadat de eerste uitspraak het perkament letterlijk citeerde).
// Dit controleert achteraf of het model toch iets overnam: een reeks van LEK_WOORDEN woorden
// uit het decreet die ook in de uitvoer staat. Vier en niet minder: "van de dag" of "in de
// frituur" staan in elk bericht. Hoofdletters, leestekens en accenten tellen niet mee. Een
// decreet van minder dan vier woorden lekt als het in zijn geheel terugkomt (vanaf drie woorden).
const LEK_WOORDEN = 4;

function woordenVan(tekst) {
  return String(tekst || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

function lektLetterlijk(uitvoer, decreet) {
  const d = woordenVan(decreet);
  if (d.length < 3) return false;
  const n = Math.min(LEK_WOORDEN, d.length);
  const u = ` ${woordenVan(uitvoer).join(' ')} `;
  for (let i = 0; i + n <= d.length; i++) {
    if (u.includes(` ${d.slice(i, i + n).join(' ')} `)) return true;
  }
  return false;
}

// Toetst en schoont de decreettekst. { ok: true, tekst } of { ok: false, reden } — de reden
// verschijnt onder het invoerveld van het perkament, dus hij is in karakter.
function toetsDecreet(invoer) {
  // Menties eruit (het perkament pingt niemand), en stuurtokens als [EER:naam|reden]: het decreet
  // staat in de systeemprompt, en een token daarin zou de Kroket God bij elke reactie eer laten
  // uitdelen aan wie het decreet schreef.
  let s = stripStuurtokens(verwijderMenties(invoer))
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < DECREET_MIN) {
    return { ok: false, reden: 'Een perkament met zo weinig erop is geen decreet. Schrijf minstens een paar woorden.' };
  }
  if (s.length > DECREET_MAX) {
    return { ok: false, reden: `Het perkament is te klein voor zoveel woorden: hoogstens ${DECREET_MAX} tekens.` };
  }
  if (detecteerInjectie(s).verdacht) {
    return { ok: false, reden: 'Het zegel weigert deze woorden. Een decreet bepaalt wat de Kroket God gelooft, niet hoe hij werkt.' };
  }
  s = neutraliseerDelimiters(s);
  return { ok: true, tekst: s };
}

module.exports = {
  DECREET_MIN, DECREET_MAX, UITNODIGING_UUR, MAX_UITNODIGINGEN, HERINNER_NA_MS, STIL_NA_MS,
  HEFTIGHEDEN, HEFTIGHEID_STANDAARD, heftigheidLabel, weekdagVan,
  kandidatenVoor, kiesUitverkorene, naBeurt, staatVoorDag, keuzeVan, magSchrijven, magUitnodigen,
  naUitnodiging, toetsDecreet, LEK_WOORDEN, lektLetterlijk,
};
