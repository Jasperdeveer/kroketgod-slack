// Tests voor de Gokpauze: de onzichtbare reeks over werkdagen en het verbod erna. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { GOKPAUZE_DAGEN, GOKPAUZE_VERBOD, schuif, isWerkdag, naCasinoSpel, opRustdag, moetWaarschuwen, naWaarschuwing, naPoging, zonderRustdag, standVan } = require('./gokpauze.js');

const speel = (dagen, rec = undefined) => dagen.reduce((r, dag) => naCasinoSpel(r, dag), rec);
// ma 26 okt t/m vr 30 okt 2026
const WEEK = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];

test('dagen verschuiven, ook over de zomertijd en de jaargrens', () => {
  assert.equal(schuif('2026-10-24', 1), '2026-10-25');
  assert.equal(schuif('2026-10-25', 1), '2026-10-26');
  assert.equal(schuif('2026-12-31', 1), '2027-01-01');
  assert.equal(schuif('2026-03-01', -1), '2026-02-28');
  assert.ok(isWerkdag('2026-10-30') && !isWerkdag('2026-10-31') && !isWerkdag('2026-11-01'));
});

test('vijf werkdagen op rij: waarschuwing, en de twee werkdagen erna verbod', () => {
  assert.equal(GOKPAUZE_DAGEN, 5);
  assert.equal(GOKPAUZE_VERBOD, 2);
  const vier = speel(WEEK.slice(0, 4));
  assert.equal(vier.reeks, 4);
  assert.ok(!moetWaarschuwen(vier));
  const vijf = naCasinoSpel(vier, '2026-10-30');
  assert.ok(moetWaarschuwen(vijf));
  assert.equal(vijf.rustdag, '2026-11-02');
  assert.equal(vijf.rustTot, '2026-11-03');
  assert.ok(!opRustdag(vijf, '2026-10-30')); // de vijfde dag mag nog
  assert.ok(!opRustdag(vijf, '2026-10-31')); // het weekend ervoor is vrij
  assert.ok(opRustdag(vijf, '2026-11-02'));
  assert.ok(opRustdag(vijf, '2026-11-03'));
  assert.ok(!opRustdag(vijf, '2026-11-04'));
});

test('een verbod over het weekend heen geldt ook in dat weekend', () => {
  const r = speel(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02']); // di t/m ma
  assert.equal(r.rustdag, '2026-11-03');
  assert.equal(r.rustTot, '2026-11-04');
  const vanDonderdag = speel(['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']); // vr t/m do
  assert.equal(vanDonderdag.rustdag, '2026-10-30');
  assert.equal(vanDonderdag.rustTot, '2026-11-02');
  assert.ok(opRustdag(vanDonderdag, '2026-10-31'));
});

test('het weekend telt niet mee en breekt de reeks niet', () => {
  const r = speel(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']); // do, vr, za, zo, ma
  assert.equal(r.reeks, 3);
  assert.equal(r.laatste, '2026-11-02');
  assert.equal(speel(['2026-10-31', '2026-11-01']), undefined);
});

test('vaker spelen op één dag telt als één dag', () => {
  const r = speel(['2026-10-26', '2026-10-26', '2026-10-26', '2026-10-27']);
  assert.equal(r.reeks, 2);
});

test('een werkdag overslaan begint opnieuw', () => {
  const r = speel(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-30']);
  assert.equal(r.reeks, 1);
  assert.ok(!r.rustdag);
});

test('na het verbod begint de reeks opnieuw, en de oude waarschuwing komt niet terug', () => {
  const vijf = naWaarschuwing(speel(WEEK));
  assert.ok(!moetWaarschuwen(vijf));
  const daarna = naCasinoSpel(vijf, '2026-11-04');
  assert.equal(daarna.reeks, 1);
  assert.ok(!moetWaarschuwen(daarna));
  assert.ok(!opRustdag(daarna, '2026-11-04'));
});

test('pogingen tellen per verbod', () => {
  let r = speel(WEEK);
  r = naPoging(naPoging(r));
  assert.equal(r.pogingen, 2);
  const volgende = speel(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'], r);
  assert.equal(volgende.pogingen, 0);
  assert.equal(naPoging(undefined).pogingen, 1);
});

test('de stand voor het dashboard', () => {
  const drie = speel(['2026-10-26', '2026-10-27', '2026-10-28']);
  assert.deepEqual(standVan(drie, '2026-10-28'), { reeks: 3, rustdag: null, rustTot: null, gewaarschuwd: false, pogingen: 0 });
  assert.equal(standVan(drie, '2026-10-29').reeks, 3); // vandaag nog niet gespeeld, reeks loopt nog
  assert.equal(standVan(drie, '2026-10-30').reeks, 0); // gisteren overgeslagen
  assert.equal(standVan(speel(['2026-10-29', '2026-10-30']), '2026-11-02').reeks, 2); // maandag na vrijdag loopt hij nog
  const vijf = naPoging(naWaarschuwing(speel(WEEK)));
  assert.deepEqual(standVan(vijf, '2026-10-30'), { reeks: 0, rustdag: '2026-11-02', rustTot: '2026-11-03', gewaarschuwd: true, pogingen: 0 });
  assert.deepEqual(standVan(vijf, '2026-11-03'), { reeks: 0, rustdag: '2026-11-02', rustTot: '2026-11-03', gewaarschuwd: true, pogingen: 1 });
  assert.equal(standVan(vijf, '2026-11-04').rustdag, null);
  assert.equal(standVan(undefined, '2026-10-30').reeks, 0);
});

test('een oud record met alleen rustdag blijft werken', () => {
  const oud = { laatste: '2026-11-10', reeks: 0, rustdag: '2026-11-11', gemeld: true, pogingen: 0 };
  assert.ok(opRustdag(oud, '2026-11-11'));
  assert.ok(!opRustdag(oud, '2026-11-12'));
  assert.equal(standVan(oud, '2026-11-11').rustTot, '2026-11-11');
});

test('een opgeheven verbod geldt niet meer, en de reeks begint opnieuw', () => {
  const vijf = speel(WEEK);
  const vrij = zonderRustdag(vijf);
  assert.ok(!opRustdag(vrij, '2026-11-02'));
  assert.ok(!moetWaarschuwen(vrij));
  assert.equal(naCasinoSpel(vrij, '2026-11-02').reeks, 1);
});
