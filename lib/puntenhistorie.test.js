// Tests voor de dagstanden. Run: `npm test`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { legDagstandVast, weekReeks, gemiddeldeReeks, ruimOp, BEWAAR_DAGEN } = require('./puntenhistorie.js');

const MA = '2026-11-16';

test('legDagstandVast bewaart per dag de scores en muteert de invoer niet', () => {
  const scores = { A: 3, B: 5 };
  const s1 = legDagstandVast({}, MA, scores);
  assert.deepEqual(s1.dagen[MA], { A: 3, B: 5 });
  scores.A = 99;
  assert.equal(s1.dagen[MA].A, 3);
  const s2 = legDagstandVast(s1, MA, { A: 4, B: 5 }); // zelfde dag overschrijft
  assert.equal(s2.dagen[MA].A, 4);
  assert.equal(s1.dagen[MA].A, 3);
});

test('legDagstandVast negeert ongeldige invoer', () => {
  assert.deepEqual(legDagstandVast(null, MA, { A: 1 }).dagen[MA], { A: 1 });
  assert.deepEqual(legDagstandVast({}, MA, { A: 'x', B: 2, C: NaN }).dagen[MA], { B: 2 });
  assert.deepEqual(legDagstandVast({ dagen: {} }, 'rommel', { A: 1 }).dagen, {});
});

test('weekReeks: zeven waarden, null voor dagen zonder stand, 0 voor een lid dat ontbreekt', () => {
  let s = legDagstandVast({}, '2026-11-16', { A: 1 });
  s = legDagstandVast(s, '2026-11-17', { A: 4, B: 2 });
  assert.deepEqual(weekReeks(s, MA, 'A'), [1, 4, null, null, null, null, null]);
  assert.deepEqual(weekReeks(s, MA, 'B'), [0, 2, null, null, null, null, null]);
  assert.deepEqual(weekReeks({}, MA, 'A'), Array(7).fill(null));
});

test('weekReeks loopt over de maandgrens', () => {
  const s = legDagstandVast({}, '2026-12-01', { A: 7 });
  assert.equal(weekReeks(s, '2026-11-30', 'A')[1], 7);
});

test('gemiddeldeReeks: gemiddelde over de aanwezige leden, afgerond op een tiende', () => {
  let s = legDagstandVast({}, '2026-11-16', { A: 1, B: 2 });
  s = legDagstandVast(s, '2026-11-17', { A: 1, B: 1, C: 1 });
  s = legDagstandVast(s, '2026-11-18', {});
  assert.deepEqual(gemiddeldeReeks(s, MA), [1.5, 1, null, null, null, null, null]);
});

test('ruimOp bewaart 60 dagen, ook over de jaargrens, en muteert niet', () => {
  assert.equal(BEWAAR_DAGEN, 60);
  const nu = Date.UTC(2026, 10, 18, 9); // 18 nov
  let s = legDagstandVast({}, '2026-11-18', { A: 1 });
  s = legDagstandVast(s, '2026-09-19', { A: 1 }); // 60 dagen terug: blijft
  s = legDagstandVast(s, '2026-09-18', { A: 1 }); // 61 dagen terug: weg
  s = legDagstandVast(s, '2025-12-31', { A: 1 });
  const schoon = ruimOp(s, nu);
  assert.deepEqual(Object.keys(schoon.dagen).sort(), ['2026-09-19', '2026-11-18']);
  assert.equal(Object.keys(s.dagen).length, 4);
});

test('legDagstandVast bewaart schatkist en raid naast de leden; ongeldig blijft weg', () => {
  const s = legDagstandVast({}, MA, { A: 1 }, { schatkist: 12, raid: { key: 'w47', hp: 30, maxHp: 40 } });
  assert.equal(s.schatkist[MA], 12);
  assert.deepEqual(s.raid[MA], { key: 'w47', hp: 30, maxHp: 40 });
  assert.deepEqual(s.dagen[MA], { A: 1 }); // geen vervuiling van de ledenstand
  assert.deepEqual(weekReeks(s, MA, 'A').slice(0, 1), [1]);
  assert.deepEqual(gemiddeldeReeks(s, MA)[0], 1);
  const t = legDagstandVast(s, '2026-11-17', { A: 2 }, { schatkist: 'x', raid: { hp: 5 } });
  assert.deepEqual(Object.keys(t.schatkist), [MA]);
  assert.deepEqual(Object.keys(t.raid), [MA]);
  assert.equal(legDagstandVast({}, MA, { A: 1 }).schatkist, undefined);
});

test('ruimOp ruimt ook schatkist en raid op', () => {
  const nu = Date.UTC(2026, 10, 18, 9);
  let s = legDagstandVast({}, '2026-11-18', { A: 1 }, { schatkist: 1, raid: { key: 'k', hp: 1 } });
  s = legDagstandVast(s, '2025-01-01', { A: 1 }, { schatkist: 2, raid: { key: 'k', hp: 2 } });
  const schoon = ruimOp(s, nu);
  assert.deepEqual(Object.keys(schoon.schatkist), ['2026-11-18']);
  assert.deepEqual(Object.keys(schoon.raid), ['2026-11-18']);
});
