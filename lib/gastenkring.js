// ── De gastenkring: persona's weten van elkaar ─────────────────────────────────
// Elke gast (persona) krijgt in zijn prompt te zien wie er nog meer in het kanaal rondloopt, elk
// met één zin uit het eigen profiel. Zo kan Benito de weekvijand bij naam noemen en weet Alex Soze
// dat er een Tante Truus is (verzoek van de eigenaar, oktober 2026).
//
// Heel soms reageert een gast INHOUDELIJK op een andere: na een bericht van een gast een kleine
// kans dat een ander erop ingaat. Nooit door in een keten — een antwoord op een antwoord komt er
// niet — en in het hele kanaal hoogstens eens per ONDERLING_COOLDOWN_MS, zodat het iets blijft
// om op te kijken en geen persona-ruis wordt.
//
// Puur: geen I/O, op de meegegeven `rng` na. Zie gastenkring.test.js.

'use strict';

const { AFKORTING_VOOR_PUNT } = require('./tekst.js');

const ONDERLING_KANS = 0.07;
const ONDERLING_COOLDOWN_MS = 3 * 3_600_000;
const ANDEREN_MAX = 6;
const SCHETS_MAX = 160;

// Eén zin over een gast, uit de eerste echte alinea van zijn profiel: geen kopjes, geen opmaak,
// geen "Jij bent" vooraan (de schets gaat over iemand anders). Hoofdletterzinnen worden eerst
// door de aanroeper omgezet (ontschreeuw), anders schreeuwt het lijstje.
function schetsVan(profiel) {
  const alinea = String(profiel ?? '')
    .split(/\n\s*\n/)
    .map(a => a.split('\n').filter(r => !/^\s*(#|\/\/|━|=)/.test(r)).join(' '))
    .map(a => a.replace(/[*_>#`]/g, '').replace(/\s+/g, ' ').trim())
    .find(a => a.length >= 30 && !/:$/.test(a)) || '';
  const kern = alinea.replace(/^jij bent\s+/i, '');
  // De eerste zinsgrens die geen afkorting of initiaal is ("Mr. Satébal", "Donald J. Trump").
  let zin = kern;
  for (const m of kern.matchAll(/[.!?](?=\s)/g)) {
    const ervoor = kern.slice(0, m.index + 1);
    if (m[0] === '.' && (AFKORTING_VOOR_PUNT.test(ervoor) || /(?:^|[\s(])\p{Lu}\.$/u.test(ervoor))) continue;
    zin = kern.slice(0, m.index + 1);
    break;
  }
  return zin.length > SCHETS_MAX ? `${zin.slice(0, SCHETS_MAX - 1).replace(/\s+\S*$/, '')}…` : zin;
}

// De andere gasten voor in de prompt van `naam`: actief, niet hijzelf, niet een gerichte persona
// (die hoort bij één lid). Hoogstens ANDEREN_MAX.
function andereGasten(personas, naam) {
  return Object.values(personas || {})
    .filter(p => p?.naam && p.naam !== naam && p.actief !== false && !p.alleenVoorLid)
    .slice(0, ANDEREN_MAX);
}

// Wie mag reageren op een bericht van `sprekerNaam`? Iemand die ongevraagd mag invallen, niet
// gericht is, niet de spreker zelf, en niet in zijn eigen cooldown zit (`inCooldown(id)`).
function kandidatenVoorOnderling(personas, sprekerNaam, inCooldown = () => false) {
  return Object.entries(personas || {})
    .filter(([id, p]) => p?.naam && p.naam !== sprekerNaam && p.actief !== false && p.ongevraagd
      && !p.alleenVoorLid && !inCooldown(id));
}

// Valt de worp, en is de kanaalbrede rem verstreken? Geeft dan één kandidaat terug, anders null.
function kiesAntwoorder(kandidaten, { laatste = 0, nu, kans = ONDERLING_KANS, cooldownMs = ONDERLING_COOLDOWN_MS, rng = Math.random }) {
  if (!kandidaten.length || nu - laatste < cooldownMs) return null;
  if (rng() >= kans) return null;
  return kandidaten[Math.floor(rng() * kandidaten.length) % kandidaten.length];
}

// Ongevraagd invallen op een bericht van de Kroket God of een lid. Elke gast gooide eerst zijn eigen
// worp, dus met zeven gasten viel er na een Kroket God-bericht bijna de helft van de keren iemand in,
// en tijdens het Vetbad een hele rij (28 oktober 2026). Nu één worp per bericht: wie een kans boven
// de worp heeft, is raak (de weekvijand, met zijn hogere kans, dus vaker), en het lot kiest er één.
// Daarna zwijgen de gasten ongevraagd tot INVAL_PAUZE_MS na het laatste gastbericht.
// `kandidaten` = [[id, persona, kans], …], al gefilterd op actief, ongevraagd en eigen cooldown.
const INVAL_PAUZE_MS = 20 * 60_000;
function kiesInvaller(kandidaten, { laatste = 0, nu, pauzeMs = INVAL_PAUZE_MS, rng = Math.random }) {
  if (nu - laatste < pauzeMs) return null;
  const worp = rng();
  const raak = kandidaten.filter(([, , kans]) => worp < kans);
  return raak.length ? raak[Math.floor(rng() * raak.length) % raak.length] : null;
}

// Daggasten (verzoek eigenaar, 29 oktober 2026): elke dag lopen er DAGGASTEN afwezige gasten extra
// rond, door het lot gekozen. Niet die van gisteren, zolang er genoeg anderen zijn. Gerichte gasten
// (van één lid) doen niet mee. Geeft de ids terug.
const DAGGASTEN = 3;
function kiesDaggasten(personas, { vorige = [], aantal = DAGGASTEN, rng = Math.random } = {}) {
  const afwezig = Object.entries(personas || {})
    .filter(([, p]) => p?.naam && p.actief === false && !p.alleenVoorLid)
    .map(([id]) => id);
  const fris = afwezig.filter(id => !vorige.includes(id));
  const pot = fris.length >= aantal ? fris : afwezig;
  const gekozen = [];
  while (gekozen.length < aantal && pot.length) gekozen.push(pot.splice(Math.floor(rng() * pot.length) % pot.length, 1)[0]);
  return gekozen;
}

// Ochtendgroet (verzoek eigenaar, 2 november 2026): op werkdagen zegt elke gast van vandaag tussen
// 08:00 en 09:00 goedemorgen, elk op een eigen minuut. Het resterende uur (vanaf minuut `van`, voor
// een bot die pas om half negen opstart) gaat in gelijke vakken; elke gast krijgt in willekeurige
// volgorde een vak en daarin een willekeurige minuut. Geeft { id: minuut (van-59) }.
function planOchtendgroet(ids, { van = 0, rng = Math.random } = {}) {
  const rest = [...ids], plan = {};
  const vak = (60 - van) / rest.length;
  for (let i = 0; rest.length; i++) {
    const id = rest.splice(Math.floor(rng() * rest.length) % rest.length, 1)[0];
    plan[id] = van + Math.floor(i * vak + rng() * vak);
  }
  return plan;
}

// Wie er nu aan de beurt is: zijn minuut is geweest, hij groette nog niet, en zijn stem faalde nog
// geen GROET_POGINGEN keer. Op volgorde van minuut.
const GROET_POGINGEN = 3;
const teGroeten = ({ plan = {}, gegroet = [], pogingen = {} } = {}, minuut) => Object.entries(plan)
  .filter(([id, m]) => m <= minuut && !gegroet.includes(id) && (pogingen[id] || 0) < GROET_POGINGEN)
  .sort(([, a], [, b]) => a - b)
  .map(([id]) => id);

module.exports = {
  ONDERLING_KANS, ONDERLING_COOLDOWN_MS, ANDEREN_MAX, SCHETS_MAX, INVAL_PAUZE_MS, DAGGASTEN, GROET_POGINGEN,
  schetsVan, andereGasten, kandidatenVoorOnderling, kiesAntwoorder, kiesInvaller, kiesDaggasten, planOchtendgroet, teGroeten,
};
