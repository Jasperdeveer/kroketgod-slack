// Tests voor de casinocijfers: boeken, opruimen en samenvatten. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BEWAAR_DAGEN, boekSpel, vatSamen } = require('./casinostats.js');

test('boeken en samenvatten per spel en per lid', () => {
  let s = {};
  s = boekSpel(s, '2026-10-28', 'A', 'roulette', 2, 0);
  s = boekSpel(s, '2026-10-28', 'A', 'roulette', 1, 36);
  s = boekSpel(s, '2026-10-29', 'B', 'blackjack', 4, 8);
  const alles = vatSamen(s, '2026-10-28', '2026-10-29');
  assert.equal(alles.spellen, 3);
  assert.equal(alles.ingezet, 7);
  assert.equal(alles.uitbetaald, 44);
  assert.equal(alles.netto, 37);
  assert.deepEqual(alles.perSpel.roulette, { spellen: 2, ingezet: 3, uitbetaald: 36 });
  assert.deepEqual(alles.perLid.B, { spellen: 1, ingezet: 4, uitbetaald: 8 });
  assert.deepEqual(alles.grootste, { netto: 35, userId: 'A', spel: 'roulette', dag: '2026-10-28' });
});

test('een periode en één lid', () => {
  let s = {};
  s = boekSpel(s, '2026-10-27', 'A', 'gokkast', 5, 0);
  s = boekSpel(s, '2026-10-28', 'A', 'gokkast', 5, 20);
  s = boekSpel(s, '2026-10-28', 'B', 'dobbelen', 3, 0);
  const a = vatSamen(s, '2026-10-28', '2026-10-28', 'A');
  assert.equal(a.spellen, 1);
  assert.equal(a.netto, 15);
  assert.deepEqual(Object.keys(a.perLid), ['A']);
  assert.equal(vatSamen(s, '2026-10-28', '2026-10-28', 'B').grootste, null); // B won niets
});

test('verlies maakt geen grootste winst', () => {
  const s = boekSpel({}, '2026-10-28', 'A', 'dobbelen', 3, 0);
  assert.equal(s['2026-10-28'].grootste, null);
});

test('alleen de laatste dagen blijven staan', () => {
  let s = boekSpel({}, '2026-08-01', 'A', 'roulette', 1, 0);
  s = boekSpel(s, '2026-10-29', 'A', 'roulette', 1, 0);
  assert.equal(BEWAAR_DAGEN, 60);
  assert.deepEqual(Object.keys(s), ['2026-10-29']);
});
