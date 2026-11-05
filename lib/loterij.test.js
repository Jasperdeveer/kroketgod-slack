// Tests voor de Frituurloterij: loten kopen, de stand en de trekking. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { LOT_PRIJS, MIN_DEELNEMERS, stand, koopLot, trek } = require('./loterij.js');

const koop = (staat, userId, dag) => koopLot(staat, userId, dag).staat;

test('één lot per lid per dag, de pot telt alle loten', () => {
  let s = koop(undefined, 'A', '2026-11-02');
  assert.deepEqual(koopLot(s, 'A', '2026-11-02'), { fout: 'U kocht vandaag al een lot. Morgen mag er weer een bij.' });
  s = koop(s, 'A', '2026-11-03');
  s = koop(s, 'B', '2026-11-03');
  assert.deepEqual(stand(s, 'A', '2026-11-03'),
    { pot: 3 * LOT_PRIJS, loten: 3, deelnemers: 2, mijnLoten: 2, vandaagGekocht: true, laatste: null });
  assert.equal(stand(s, 'B', '2026-11-04').vandaagGekocht, false);
  assert.deepEqual(stand(undefined, null, '2026-11-04'), { pot: 0, loten: 0, deelnemers: 0, mijnLoten: 0, vandaagGekocht: false, laatste: null });
});

test('de trekking: elk lot is één kans, de winnaar krijgt de hele pot en de loten zijn weg', () => {
  let s = koop(undefined, 'A', '2026-11-02');
  s = koop(s, 'A', '2026-11-03');
  s = koop(s, 'B', '2026-11-03');
  // Loten op volgorde A, A, B: rnd 0,5 wijst het tweede lot aan, 0,9 het derde.
  const a = trek(s, '2026-11-06', () => 0.5);
  assert.deepEqual(a.uitslag, { dag: '2026-11-06', winnaar: 'A', pot: 3, loten: 3, deelnemers: 2, winnendeLoten: 2 });
  assert.deepEqual(a.staat.loten, []);
  assert.deepEqual(stand(a.staat, 'A', '2026-11-06').laatste, a.uitslag);
  assert.equal(trek(s, '2026-11-06', () => 0.9).uitslag.winnaar, 'B');
});

test('te weinig deelnemers: de pot schuift door, er verandert niets', () => {
  assert.equal(MIN_DEELNEMERS, 2);
  let s = koop(undefined, 'A', '2026-11-02');
  s = koop(s, 'A', '2026-11-03');
  const r = trek(s, '2026-11-06', () => 0);
  assert.deepEqual(r.uitslag, { doorgeschoven: true, pot: 2, deelnemers: 1 });
  assert.equal(r.staat, s);
  assert.deepEqual(trek({ loten: [], historie: [] }, '2026-11-06', () => 0).uitslag, null);
});

test('een lid dat niet mag winnen, telt niet als deelnemer maar zijn lot blijft in de pot', () => {
  let s = koop(undefined, 'A', '2026-11-02');
  s = koop(s, 'B', '2026-11-02');
  s = koop(s, 'C', '2026-11-02');
  const magWinnen = (id) => id !== 'A';
  for (const rnd of [0, 0.4, 0.99]) {
    const { uitslag } = trek(s, '2026-11-06', () => rnd, magWinnen);
    assert.notEqual(uitslag.winnaar, 'A');
    assert.equal(uitslag.pot, 3);
    assert.equal(uitslag.deelnemers, 2);
  }
  assert.ok(trek(s, '2026-11-06', () => 0, (id) => id === 'B').uitslag.doorgeschoven);
});

test('de historie houdt de laatste twintig trekkingen', () => {
  let s;
  for (let i = 0; i < 25; i++) {
    s = koop(koop(s, 'A', `d${i}`), 'B', `d${i}`);
    s = trek(s, `d${i}`, () => 0).staat;
  }
  assert.equal(s.historie.length, 20);
  assert.equal(s.historie.at(-1).dag, 'd24');
});
