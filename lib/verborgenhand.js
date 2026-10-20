// ── De Verborgen Hand: elke dag schrijft een ander lid in het geheim het decreet ──────────
//
// Elke dag wijst de Hoge Frituurraad één lid met de rang Opperkroket (of hoger) aan dat het
// Decreet van de Dag mag schrijven en de stemming van de Kroket God mag kiezen. Dat lid krijgt een verborgen uitnodiging (een ephemeral
// in het kanaal, plus een kaart in de eigen App Home) en vult een verzegeld perkament in. De
// Kroket God vertelt daarna als verhaal hoe het perkament gevonden werd en spreekt in de nieuwe
// stemming. WIE het schreef, wordt nergens genoemd: niet in het kanaal, niet in de logs, niet in
// de systeemprompt. Alleen `verborgenhand.json` weet het, omdat de rondgang en de schrijfrechten
// het nodig hebben.
//
// DE RONDGANG. Iedereen komt één keer aan de beurt voordat iemand een tweede keer mag, en het is
// nooit twee dagen achter elkaar hetzelfde lid. De wachtrij wordt geschud zodra hij leeg is; wie
// intussen lid werd, schuift bij de volgende ronde aan. Wie niet meer meedoet (verbannen,
// afwezig, lang stil), wordt overgeslagen zonder de rest van de ronde te verstoren.
//
// WAT DE KEUZE DOET. Voor de rest van die dag gaat de keuze vóór de stemming-override en het
// decreet uit het dashboard (en vóór het decreet van de Opperkroket): het hele idee is dat het
// lid de dag bepaalt. Morgen geldt weer wat er stond.
//
// WAAROM HET DECREET GETOETST WORDT. Het decreet belandt de hele dag in de systeemprompt, voor
// elk antwoord aan iedereen. Tot nu toe kon alleen de Opperkroket dat; nu elk lid. Een tekst
// die eruitziet als een poging de bot om te praten ("negeer je regels…") wordt daarom
// geweigerd, en Slack-menties gaan eruit, zodat het perkament niemand kan pingen.
//
// Puur: geen I/O en geen klok, op de meegegeven `rng` na. Zie verborgenhand.test.js.

'use strict';

const { detecteerInjectie, neutraliseerDelimiters } = require('../prompt-safety.js');

const DECREET_MIN = 3;
const DECREET_MAX = 280;

// Twee verborgen berichten per dag, met minstens drie uur ertussen. Een ephemeral komt alleen
// aan als het lid op dat moment actief is. Daarom gaat hij pas weg bij het eerste bericht van
// de dag; de tweede is een herinnering voor wie het eerste weggeklikt of over het hoofd gezien heeft.
const MAX_UITNODIGINGEN = 2;
const HERINNER_NA_MS = 3 * 3_600_000;

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

// Fisher-Yates met een injecteerbare rng (tests).
function schud(lijst, rng) {
  const a = [...lijst];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// Haalt de volgende uit de wachtrij. Is de rij leeg, dan wordt er een nieuwe ronde geschud,
// en staat `vorige` daar vooraan, dan ruilt hij met de tweede: nooit twee dagen dezelfde.
function volgendeUitverkorene(wachtrij, kandidaten, vorige, rng = Math.random) {
  let rij = (wachtrij || []).filter(id => kandidaten.includes(id));
  if (!rij.length) {
    rij = schud(kandidaten, rng);
    if (rij.length > 1 && rij[0] === vorige) [rij[0], rij[1]] = [rij[1], rij[0]];
  }
  return { userId: rij[0] || null, wachtrij: rij.slice(1) };
}

// De staat voor `datum`: dezelfde als hij al van vandaag is, anders een nieuwe dag met de
// volgende uit de rondgang. `vorige` onthoudt de uitverkorene van de laatste dag dat er een was,
// ook over een weekend heen.
function staatVoorDag(staat, datum, kandidaten, rng = Math.random) {
  const oud = staat || {};
  if (oud.datum === datum) return oud;
  const vorige = oud.userId || oud.vorige || null;
  const { userId, wachtrij } = volgendeUitverkorene(oud.wachtrij, kandidaten, vorige, rng);
  return { datum, userId, wachtrij, vorige, keuze: null, uitnodigingen: 0, laatsteUitnodiging: 0 };
}

// De keuze die vandaag geldt, of null.
function keuzeVan(staat, datum) {
  return staat?.datum === datum && staat.keuze ? staat.keuze : null;
}

// Mag dit lid het perkament nu (nog) beschrijven? Eén keer per dag, alleen de uitverkorene.
function magSchrijven(staat, userId, datum) {
  return !!userId && staat?.datum === datum && staat.userId === userId && !staat.keuze;
}

function magUitnodigen(staat, userId, datum, nu) {
  if (!magSchrijven(staat, userId, datum)) return false;
  if ((staat.uitnodigingen || 0) >= MAX_UITNODIGINGEN) return false;
  return nu - (staat.laatsteUitnodiging || 0) >= HERINNER_NA_MS;
}

function naUitnodiging(staat, nu) {
  return { ...staat, uitnodigingen: (staat.uitnodigingen || 0) + 1, laatsteUitnodiging: nu };
}

// Toetst en schoont de decreettekst. { ok: true, tekst } of { ok: false, reden } — de reden
// verschijnt onder het invoerveld van het perkament, dus hij is in karakter.
function toetsDecreet(invoer) {
  let s = String(invoer == null ? '' : invoer)
    .replace(/<[@!#][^>]*>/g, '')            // Slack-menties en kanaalverwijzingen
    .replace(/@(here|channel|everyone)\b/gi, '')
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
  DECREET_MIN, DECREET_MAX, MAX_UITNODIGINGEN, HERINNER_NA_MS, STIL_NA_MS,
  HEFTIGHEDEN, HEFTIGHEID_STANDAARD, heftigheidLabel,
  kandidatenVoor, volgendeUitverkorene, staatVoorDag, keuzeVan, magSchrijven, magUitnodigen,
  naUitnodiging, toetsDecreet,
};
