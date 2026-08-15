// Tests voor de zaaknummering en zaakontleding van De Hoge Frituurraad. Pure functies.
// Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { romeins, zaakNummer, volgendeTeller, parseerZaak } = require('./jurisprudentie');

// ── Romeinse cijfers ───────────────────────────────────────────────────────────

test('romeins zet de gangbare getallen goed om', () => {
  const verwacht = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX',
    10: 'X', 14: 'XIV', 19: 'XIX', 40: 'XL', 44: 'XLIV', 90: 'XC', 100: 'C', 400: 'CD',
    500: 'D', 900: 'CM', 1000: 'M', 1987: 'MCMLXXXVII',
  };
  for (const [n, r] of Object.entries(verwacht)) {
    assert.equal(romeins(Number(n)), r, `${n} → ${r}`);
  }
});

test('romeins weigert wat geen zaaknummer kan zijn', () => {
  for (const n of [0, -1, 4000, NaN, null, undefined, 'zeven']) {
    assert.equal(romeins(n), '', `${n} hoort leeg te zijn`);
  }
});

test('romeins kapt een kommagetal af in plaats van te struikelen', () => {
  assert.equal(romeins(7.9), 'VII');
});

// ── Zaaknummer ─────────────────────────────────────────────────────────────────

test('zaakNummer combineert jaar en romeins cijfer', () => {
  assert.equal(zaakNummer(2026, 7), '2026/VII');
  assert.equal(zaakNummer(2026, 1), '2026/I');
});

test('zaakNummer valt terug op het gewone getal buiten het romeinse bereik', () => {
  // Liever een lelijk nummer dan een zaak zonder nummer: onnummerbaar is onciteerbaar.
  assert.equal(zaakNummer(2026, 5000), '2026/5000');
});

test('volgendeTeller telt alleen zaken van hetzelfde jaar', () => {
  const zaken = [{ jaar: 2025 }, { jaar: 2026 }, { jaar: 2026 }];
  assert.equal(volgendeTeller(zaken, 2026), 3);
  assert.equal(volgendeTeller(zaken, 2025), 2);
  assert.equal(volgendeTeller(zaken, 2027), 1);
  assert.equal(volgendeTeller([], 2026), 1);
  assert.equal(volgendeTeller(undefined, 2026), 1);
});

// ── Zaak ontleden ──────────────────────────────────────────────────────────────

test('A vs B wordt gesplitst', () => {
  const z = parseerZaak('Mr. KroketPet vs Mr. Kroketinho');
  assert.equal(z.partij1, 'Mr. KroketPet');
  assert.equal(z.partij2, 'Mr. Kroketinho');
  assert.equal(z.grond, '');
});

test('vs, vs., versus en tegen werken allemaal', () => {
  for (const woord of ['vs', 'vs.', 'versus', 'tegen', 'VS', 'Versus']) {
    const z = parseerZaak(`Jasper ${woord} Rick`);
    assert.equal(z.partij1, 'Jasper', woord);
    assert.equal(z.partij2, 'Rick', woord);
  }
});

test('een grond achter "over" wordt afgesplitst', () => {
  const z = parseerZaak('Jasper vs Rick over de laatste kroket');
  assert.equal(z.partij2, 'Rick');
  assert.equal(z.grond, 'de laatste kroket');
});

test('een naam die zelf "over" bevat blijft heel', () => {
  // Splitsen op het LAATSTE " over " houdt de naam intact.
  const z = parseerZaak('Jasper vs Mr. Overjas over de laatste kroket');
  assert.equal(z.partij2, 'Mr. Overjas');
  assert.equal(z.grond, 'de laatste kroket');
});

test('zonder "over" blijft de hele rest de tweede partij', () => {
  const z = parseerZaak('Jasper vs Mr. Te Lang Gefrituurde Kroket');
  assert.equal(z.partij2, 'Mr. Te Lang Gefrituurde Kroket');
  assert.equal(z.grond, '');
});

test('ontbrekende structuur geeft een uitlegbare fout', () => {
  assert.match(parseerZaak('Jasper en Rick').fout, /naam1.*vs.*naam2/i);
  assert.ok(parseerZaak('').fout);
  assert.ok(parseerZaak(null).fout);
});

test('een lege partij wordt geweigerd', () => {
  assert.ok(parseerZaak('vs Rick').fout);
  assert.ok(parseerZaak('Jasper vs over de kroket').fout);
});

test('dubbele spaties breken het ontleden niet', () => {
  const z = parseerZaak('  Jasper   vs   Rick   over   de   kroket  ');
  assert.equal(z.partij1, 'Jasper');
  assert.equal(z.partij2, 'Rick');
  assert.equal(z.grond, 'de kroket');
});
