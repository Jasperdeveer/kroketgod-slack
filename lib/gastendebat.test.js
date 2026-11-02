// Tests voor het gastendebat: stelling, debaters en de telling. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { STELLINGEN, kiesStelling, kiesDebaters, telDebatStemmen, debatWinnaar } = require('./gastendebat.js');

test('een stelling die nog niet geweest is, en daarna begint het rondje opnieuw', () => {
  const alles = STELLINGEN.map((_, i) => i);
  assert.equal(kiesStelling(alles.slice(1), () => 0.5), 0);
  for (let i = 0; i < 50; i++) assert.ok(![0, 1, 2].includes(kiesStelling([0, 1, 2])));
  assert.ok(alles.includes(kiesStelling(alles)));
  assert.ok(new Set(STELLINGEN).size === STELLINGEN.length);
});

test('twee verschillende debaters, of geen debat', () => {
  for (let i = 0; i < 50; i++) {
    const [a, b] = kiesDebaters(['x', 'y', 'z']);
    assert.notEqual(a, b);
  }
  assert.deepEqual(kiesDebaters(['x', 'y'], () => 0), ['x', 'y']);
  assert.equal(kiesDebaters(['x']), null);
  assert.equal(kiesDebaters(), null);
});

test('stemmen: alleen wie mag, wie op beide stemt telt niet', () => {
  const reacties = [
    { name: 'one', users: ['UBOT', 'U1', 'U2', 'U3', 'BUITEN'] },
    { name: 'two', users: ['UBOT', 'U3', 'U4'] },
    { name: 'kroket', users: ['U5'] },
  ];
  const mag = (u) => u.startsWith('U') && u !== 'UBOT';
  assert.deepEqual(telDebatStemmen(reacties, mag), { a: 2, b: 1 });
  assert.deepEqual(telDebatStemmen([], mag), { a: 0, b: 0 });
  assert.equal(debatWinnaar({ a: 2, b: 1 }), 'a');
  assert.equal(debatWinnaar({ a: 0, b: 3 }), 'b');
  assert.equal(debatWinnaar({ a: 1, b: 1 }), null);
  assert.equal(debatWinnaar({ a: 0, b: 0 }), null);
});
