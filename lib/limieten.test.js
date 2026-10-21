// Tests voor de daglimieten: tellen per dag, de dagwissel en de zondebokstraf.
// Pure functies met een injecteerbare dagsleutel. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DAGLIMIETEN, IEDEREEN, telling, resterend, magNog, boekIn, zondebokStraf,
} = require('./limieten.js');

const A = 'U_A', B = 'U_B';
const VANDAAG = '2026-10-21', MORGEN = '2026-10-22';

test('een leeg boek staat alles toe', () => {
  assert.equal(magNog({}, 'zondebok', A, VANDAAG), true);
  assert.equal(magNog(undefined, 'lofzang', A, VANDAAG), true);
  assert.equal(resterend({}, 'lofzang', A, VANDAAG), DAGLIMIETEN.lofzang);
});

test('zondebok: één per lid per dag', () => {
  const boek = boekIn({}, 'zondebok', A, VANDAAG);
  assert.equal(magNog(boek, 'zondebok', A, VANDAAG), false);
  // Een ander lid heeft zijn eigen beurt.
  assert.equal(magNog(boek, 'zondebok', B, VANDAAG), true);
});

test('de telling van gisteren telt vandaag niet meer', () => {
  const boek = boekIn({}, 'zondebok', A, VANDAAG);
  assert.equal(magNog(boek, 'zondebok', A, MORGEN), true);
  assert.equal(telling(boek, 'zondebok', A, MORGEN), 0);
  // En boeken op de nieuwe dag begint weer bij één, niet bij twee.
  assert.equal(telling(boekIn(boek, 'zondebok', A, MORGEN), 'zondebok', A, MORGEN), 1);
});

test('lofzang: het plafond houdt na het tweede punt', () => {
  let boek = {};
  for (let i = 0; i < DAGLIMIETEN.lofzang; i++) {
    assert.equal(magNog(boek, 'lofzang', A, VANDAAG), true);
    boek = boekIn(boek, 'lofzang', A, VANDAAG);
  }
  assert.equal(magNog(boek, 'lofzang', A, VANDAAG), false);
  assert.equal(resterend(boek, 'lofzang', A, VANDAAG), 0);
});

test('organische eer: de Raad samen en per ontvanger', () => {
  let boek = boekIn({}, 'organische_eer', IEDEREEN, VANDAAG);
  boek = boekIn(boek, 'organische_eer_ontvanger', A, VANDAAG);
  // Dezelfde ontvanger vandaag niet nog eens, een ander wel.
  assert.equal(magNog(boek, 'organische_eer_ontvanger', A, VANDAAG), false);
  assert.equal(magNog(boek, 'organische_eer_ontvanger', B, VANDAAG), true);
  boek = boekIn(boek, 'organische_eer', IEDEREEN, VANDAAG);
  assert.equal(magNog(boek, 'organische_eer', IEDEREEN, VANDAAG), false);
});

test('boekIn muteert het boek van de aanroeper niet', () => {
  const boek = boekIn({}, 'lofzang', A, VANDAAG);
  const kopie = JSON.parse(JSON.stringify(boek));
  boekIn(boek, 'lofzang', A, VANDAAG);
  boekIn(boek, 'zondebok', B, VANDAAG);
  assert.deepEqual(boek, kopie);
});

test('een onbekende soort is een programmeerfout, geen stille ruimte', () => {
  assert.throws(() => magNog({}, 'bestaat_niet', A, VANDAAG), /Onbekende daglimiet/);
});

test('zondebokStraf: wie op nul staat verliest niets', () => {
  assert.equal(zondebokStraf(0), 0);
  assert.equal(zondebokStraf(-2), 0);
  assert.equal(zondebokStraf(undefined), 0);
  assert.equal(zondebokStraf(1), 1);
  assert.equal(zondebokStraf(12), 1);
});
