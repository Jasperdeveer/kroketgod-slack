// Tests voor de paarstaat: kerven, de eeuwige twist en de gedeelde inzetberekening.
// Pure functies, dus geen state of tijdelijke mappen nodig. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  paarSleutel, kerfSleutel,
  KERF_MAX, kerfBij, kerven, vergeef, kerfstokVan,
  TWIST_DUELS, twistRijp, twistStand,
  INZET_MAX, duelInzet, inzetRedenen,
} = require('./paar.js');

const A = 'U_A', B = 'U_B', C = 'U_C';
const VANDAAG = '2026-09-14', MORGEN = '2026-09-15';

// ── Sleutels ──────────────────────────────────────────────────────────────────

test('paarSleutel is ongericht: dezelfde twee leden geven dezelfde sleutel', () => {
  assert.equal(paarSleutel(A, B), paarSleutel(B, A));
});

test('kerfSleutel is gericht: richting maakt verschil', () => {
  assert.notEqual(kerfSleutel(A, B), kerfSleutel(B, A));
});

// ── Kerven ────────────────────────────────────────────────────────────────────

test('kerfBij: een geslaagde roof laat twee kerven achter', () => {
  const r = kerfBij({}, A, B, 'roof_gelukt', VANDAAG);
  assert.equal(r.gewijzigd, true);
  assert.equal(kerven(r.stok, A, B), 2);
  assert.equal(kerven(r.stok, B, A), 0, 'de kerf is eenzijdig');
});

test('kerfBij: hoogstens één kerf per paar per dag', () => {
  let { stok } = kerfBij({}, A, B, 'duel_verloren', VANDAAG);
  assert.equal(kerven(stok, A, B), 1);
  const tweede = kerfBij(stok, A, B, 'roof_gelukt', VANDAAG);
  assert.equal(tweede.gewijzigd, false, 'dezelfde dag levert niets extra op');
  assert.equal(kerven(tweede.stok, A, B), 1);
  // Morgen mag het weer.
  const morgen = kerfBij(stok, A, B, 'roof_gelukt', MORGEN);
  assert.equal(morgen.gewijzigd, true);
  assert.equal(kerven(morgen.stok, A, B), 3);
});

test('kerfBij: de stok loopt niet verder dan het plafond', () => {
  let stok = {};
  for (let d = 0; d < 10; d++) {
    stok = kerfBij(stok, A, B, 'roof_gelukt', `2026-09-${String(d + 1).padStart(2, '0')}`).stok;
  }
  assert.equal(kerven(stok, A, B), KERF_MAX);
});

test('kerfBij: onbekende soort, zelfkerf en leegte doen niets', () => {
  assert.equal(kerfBij({}, A, B, 'onbekend', VANDAAG).gewijzigd, false);
  assert.equal(kerfBij({}, A, A, 'roof_gelukt', VANDAAG).gewijzigd, false);
  assert.equal(kerfBij({}, A, null, 'roof_gelukt', VANDAAG).gewijzigd, false);
});

test('kerfBij: hoogsteOoit blijft staan ook na vergiffenis', () => {
  let { stok } = kerfBij({}, A, B, 'roof_gelukt', VANDAAG);
  stok = kerfBij(stok, A, B, 'roof_gelukt', MORGEN).stok;
  assert.equal(kerven(stok, A, B), 4);
  const na = vergeef(stok, A, B);
  assert.equal(kerven(na.stok, A, B), 0);
  assert.equal(na.stok[kerfSleutel(A, B)].hoogsteOoit, 4, 'de geschiedenis blijft');
});

test('vergeef: wist de hele stok in één gebaar en meldt hoeveel', () => {
  let { stok } = kerfBij({}, A, B, 'roof_gelukt', VANDAAG);
  const r = vergeef(stok, A, B);
  assert.equal(r.gewijzigd, true);
  assert.equal(r.gewist, 2);
  assert.equal(kerven(r.stok, A, B), 0);
});

test('vergeef: een lege stok vergeven doet niets', () => {
  assert.equal(vergeef({}, A, B).gewijzigd, false);
  assert.equal(vergeef({}, A, B).gewist, 0);
});

test('kerfstokVan: alleen de eigen openstaande kerven, aflopend', () => {
  let stok = {};
  stok = kerfBij(stok, A, B, 'roof_gelukt', VANDAAG).stok;      // A tegen B: 2
  stok = kerfBij(stok, A, C, 'duel_verloren', VANDAAG).stok;    // A tegen C: 1
  stok = kerfBij(stok, B, A, 'roof_gelukt', VANDAAG).stok;      // B tegen A: 2
  const lijst = kerfstokVan(stok, A);
  assert.deepEqual(lijst.map(k => k.daderId), [B, C]);
  assert.equal(lijst[0].kerven, 2);
  // Vergeven verdwijnt uit de lijst.
  const na = vergeef(stok, A, B).stok;
  assert.deepEqual(kerfstokVan(na, A).map(k => k.daderId), [C]);
});

// ── De Eeuwige Twist ──────────────────────────────────────────────────────────

test('twistRijp: pas vanaf het drempelaantal duels', () => {
  const bijna = { [A]: { tegen: { [B]: { gewonnen: 2, verloren: TWIST_DUELS - 3 } } } };
  assert.equal(twistRijp(bijna, A, B), false);
  const rijp = { [A]: { tegen: { [B]: { gewonnen: 2, verloren: TWIST_DUELS - 2 } } } };
  assert.equal(twistRijp(rijp, A, B), true);
});

test('twistRijp: een onbekend paar is nooit rijp', () => {
  assert.equal(twistRijp({}, A, B), false);
  assert.equal(twistRijp({ [A]: { tegen: {} } }, A, B), false);
});

test('twistStand: geeft de onderlinge stand met het verschil', () => {
  const h = { [A]: { tegen: { [B]: { gewonnen: 5, verloren: 2 } } } };
  assert.deepEqual(twistStand(h, A, B), { voor: 5, tegen: 2, verschil: 3 });
  assert.deepEqual(twistStand({}, A, B), { voor: 0, tegen: 0, verschil: 0 });
});

// ── De gedeelde inzet ─────────────────────────────────────────────────────────
// Dit is de reden dat deze module bestaat: drie voorstellen verhogen dezelfde inzet.

test('duelInzet: zonder wrok is de inzet één', () => {
  assert.equal(duelInzet({ bezitA: 10, bezitB: 10 }), 1);
});

test('duelInzet: kerven, twist en vete stapelen maar lopen tegen het plafond', () => {
  assert.equal(duelInzet({ kerven: 2, bezitA: 20, bezitB: 20 }), 3);
  assert.equal(duelInzet({ kerven: 2, twist: true, bezitA: 20, bezitB: 20 }), 4);
  // Alles tegelijk zou 1+4+1 = 6, ×2 = 12 zijn; het plafond houdt het op INZET_MAX.
  assert.equal(duelInzet({ kerven: 4, twist: true, vete: true, bezitA: 40, bezitB: 40 }), INZET_MAX);
});

test('duelInzet: het armoedeplafond beschermt de armste van de twee', () => {
  // Vier kerven zou 5 willen, maar wie 4 punten heeft riskeert er hoogstens 2.
  assert.equal(duelInzet({ kerven: 4, bezitA: 4, bezitB: 30 }), 2);
  assert.equal(duelInzet({ kerven: 4, bezitA: 30, bezitB: 4 }), 2, 'richting maakt niet uit');
});

test('duelInzet: bij één punt blijft de inzet één — armoede sluit niemand uit', () => {
  assert.equal(duelInzet({ kerven: 4, twist: true, vete: true, bezitA: 1, bezitB: 50 }), 1);
  assert.equal(duelInzet({ bezitA: 0, bezitB: 0 }), 1);
});

test('duelInzet: nooit onder één en nooit boven het maximum, wat je ook meegeeft', () => {
  for (const k of [0, 1, 2, 3, 4, 99]) {
    for (const bezit of [0, 1, 2, 5, 50]) {
      const i = duelInzet({ kerven: k, twist: true, vete: true, bezitA: bezit, bezitB: bezit });
      assert.ok(i >= 1 && i <= INZET_MAX, `inzet ${i} bij kerven ${k}, bezit ${bezit}`);
    }
  }
});

test('inzetRedenen: benoemt elke bron, en zwijgt als er geen is', () => {
  assert.deepEqual(inzetRedenen({}), []);
  const r = inzetRedenen({ kerven: 3, twist: true, vete: true });
  assert.equal(r.length, 3);
  assert.match(r[0], /3 openstaande kerven/);
  assert.deepEqual(inzetRedenen({ kerven: 1 }), ['1 openstaande kerf']);
});
