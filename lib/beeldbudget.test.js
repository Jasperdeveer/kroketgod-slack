// Tests voor het beeldbudget. Run: `npm test`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PLAFOND, verbruikt, reserveer, vol } = require('./beeldbudget.js');

const NU = Date.parse('2026-11-18T10:00:00Z');
const MORGEN = Date.parse('2026-11-19T00:00:01Z');

test('reserveer telt op binnen dezelfde UTC-dag en weigert boven het plafond', () => {
  let s = reserveer({}, 1450, NU, 7500);
  assert.deepEqual(s, { dag: '2026-11-18', neurons: 1450 });
  for (let i = 0; i < 4; i++) s = reserveer(s, 1450, NU, 7500);
  assert.equal(s.neurons, 7250);
  assert.equal(reserveer(s, 1450, NU, 7500), null, 'zesde klein-beeld past niet onder 7500');
  assert.equal(reserveer(s, 60, NU, PLAFOND).neurons, 7310, 'schnell past nog wel');
});

test('een plafond boven PLAFOND telt als PLAFOND', () => {
  assert.equal(reserveer({ dag: '2026-11-18', neurons: PLAFOND - 10 }, 60, NU, 99999), null);
});

test('na middernacht UTC begint het budget opnieuw; vol() sluit de dag', () => {
  const s = vol(NU);
  assert.equal(reserveer(s, 60, NU), null);
  assert.equal(verbruikt(s, MORGEN), 0);
  assert.deepEqual(reserveer(s, 60, MORGEN), { dag: '2026-11-19', neurons: 60 });
});

test('kapotte staat telt als leeg', () => {
  assert.equal(verbruikt(null, NU), 0);
  assert.equal(verbruikt({ dag: '2026-11-18', neurons: 'x' }, NU), 0);
});
