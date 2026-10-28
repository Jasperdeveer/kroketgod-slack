// Tests voor de Gokpauze: de onzichtbare reeks en de rustdag erna. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { GOKPAUZE_DAGEN, schuif, naCasinoSpel, opRustdag, moetWaarschuwen, naWaarschuwing, naPoging } = require('./gokpauze.js');

const speel = (dagen, rec = undefined) => dagen.reduce((r, dag) => naCasinoSpel(r, dag), rec);

test('dagen verschuiven, ook over de zomertijd en de jaargrens', () => {
  assert.equal(schuif('2026-10-24', 1), '2026-10-25');
  assert.equal(schuif('2026-10-25', 1), '2026-10-26');
  assert.equal(schuif('2026-12-31', 1), '2027-01-01');
  assert.equal(schuif('2026-03-01', -1), '2026-02-28');
});

test('vijf dagen op rij: waarschuwing, en de dag erna is rustdag', () => {
  assert.equal(GOKPAUZE_DAGEN, 5);
  const vier = speel(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
  assert.equal(vier.reeks, 4);
  assert.ok(!moetWaarschuwen(vier));
  const vijf = naCasinoSpel(vier, '2026-10-30');
  assert.ok(moetWaarschuwen(vijf));
  assert.equal(vijf.rustdag, '2026-10-31');
  assert.ok(!opRustdag(vijf, '2026-10-30')); // de vijfde dag mag nog
  assert.ok(opRustdag(vijf, '2026-10-31'));
  assert.ok(!opRustdag(vijf, '2026-11-01'));
});

test('vaker spelen op één dag telt als één dag', () => {
  const r = speel(['2026-10-26', '2026-10-26', '2026-10-26', '2026-10-27']);
  assert.equal(r.reeks, 2);
});

test('een dag overslaan begint opnieuw', () => {
  const r = speel(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-31']);
  assert.equal(r.reeks, 1);
  assert.ok(!r.rustdag);
});

test('na de rustdag begint de reeks opnieuw, en de oude waarschuwing komt niet terug', () => {
  const vijf = naWaarschuwing(speel(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']));
  assert.ok(!moetWaarschuwen(vijf));
  const daarna = naCasinoSpel(vijf, '2026-11-01');
  assert.equal(daarna.reeks, 1);
  assert.ok(!moetWaarschuwen(daarna));
  assert.ok(!opRustdag(daarna, '2026-11-01'));
});

test('pogingen tellen per rustdag', () => {
  let r = speel(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  r = naPoging(naPoging(r));
  assert.equal(r.pogingen, 2);
  const volgende = speel(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], r);
  assert.equal(volgende.pogingen, 0);
  assert.equal(naPoging(undefined).pogingen, 1);
});
