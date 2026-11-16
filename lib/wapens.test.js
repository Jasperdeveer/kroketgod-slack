// Tests voor het Frituurarsenaal: de wapens tegen de weekvijand. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WAPENS, WAPENREK_MAX, KANON_DOEL, zwakTegen, koopWeigering, wapenUithaal, pekelBonus,
  kanonInleg, kanonTotaal, kanonVuurt, kanonSchade,
} = require('./wapens.js');
const { GAVE_SOORTEN } = require('./weekvijand.js');

const gave = (soort) => ({ soort, naam: 'test' });
const vast = (...worpen) => { let i = 0; return () => worpen[i++ % worpen.length]; };

test('de catalogus: prijzen uit de spec, elk wapen met naam, icoon en uitleg', () => {
  const prijzen = Object.fromEntries(Object.entries(WAPENS).map(([k, w]) => [k, w.prijs]));
  assert.deepEqual(prijzen, { frietvork: 1, kroketmes: 3, vliegenmepper: 2, ovenwant: 2, vershoudfolie: 2, pekelspuit: 3, vetbom: 5 });
  for (const w of Object.values(WAPENS)) assert.ok(w.naam && w.icoon && w.uitleg);
});

test('zwak tegen: elke gave-soort wijst naar een bestaand wapen of naar niets', () => {
  for (const soort of Object.keys(GAVE_SOORTEN)) {
    const w = zwakTegen(soort);
    assert.ok(w === null || WAPENS[w], soort);
  }
  assert.equal(zwakTegen('pantser'), 'kroketmes');
  assert.equal(zwakTegen('ontwijk'), 'vliegenmepper');
  assert.equal(zwakTegen('taai'), 'vershoudfolie');
  assert.equal(zwakTegen('samen'), 'pekelspuit');
  assert.equal(zwakTegen('stekels'), 'ovenwant');
  assert.equal(zwakTegen('offerdoof'), null);
  assert.equal(zwakTegen(undefined), null);
});

test('kopen: rek van twee, één in de hand, één vetbom, geen krediet', () => {
  assert.equal(koopWeigering({}, 'kroketmes', 3), null);
  assert.match(koopWeigering({}, 'bazooka', 99), /kent/);
  assert.match(koopWeigering({ inHand: 'frietvork', gekocht: 1 }, 'kroketmes', 9), /in de hand/);
  assert.match(koopWeigering({ gekocht: WAPENREK_MAX }, 'frietvork', 9), /rek/);
  assert.match(koopWeigering({ gekocht: 1, vetbom: true }, 'vetbom', 9), /Vetbom/);
  assert.match(koopWeigering({}, 'vetbom', 4), /5/);
});

test('uithaal: plus-schade, en het juiste wapen schakelt de gave uit', () => {
  assert.equal(wapenUithaal(2, 'frietvork', null).basis, 3);
  const mes = wapenUithaal(2, 'kroketmes', gave('pantser'));
  assert.equal(mes.basis, 4);
  assert.equal(mes.gave, null, 'kroketmes gaat door pantser');
  assert.equal(wapenUithaal(2, 'kroketmes', gave('ontwijk')).gave.soort, 'ontwijk');
  assert.equal(wapenUithaal(2, 'vliegenmepper', gave('ontwijk')).gave, null);
  const want = wapenUithaal(2, 'ovenwant', gave('stekels'));
  assert.equal(want.basis, 3);
  assert.equal(want.terugslag, false);
  assert.equal(want.knal, false);
  assert.equal(wapenUithaal(2, 'frietvork', null).terugslag, true);
  const folie = wapenUithaal(2, 'vershoudfolie', null);
  assert.equal(folie.basis, 2);
  assert.equal(folie.folie, true);
  assert.equal(wapenUithaal(2, 'pekelspuit', null).pekel, true);
  assert.equal(wapenUithaal(2, null, gave('pantser')).basis, 2, 'zonder wapen verandert er niets');
});

test('vetbom: +2 tot +6, en 1 op 6 ketst terug zonder schade', () => {
  assert.equal(wapenUithaal(1, 'vetbom', null, vast(0.5, 0)).basis, 3);
  assert.equal(wapenUithaal(3, 'vetbom', null, vast(0.5, 0.999)).basis, 9);
  const ketst = wapenUithaal(3, 'vetbom', gave('samen'), vast(0.1));
  assert.equal(ketst.ketst, true);
  assert.equal(ketst.basis, 0);
  assert.equal(ketst.gave, null, 'een ketsende bom krijgt geen samen-bonus');
  assert.equal(ketst.terugslag, false, 'de ketsende bom is de terugslag al');
});

test('pekel: twee keer +1 voor anderen, dezelfde dag', () => {
  const pekel = { dag: 'd1', door: 'a', over: 2 };
  assert.deepEqual(pekelBonus(pekel, 'a', 'd1'), { bonus: 0, pekel });
  assert.deepEqual(pekelBonus(pekel, 'b', 'd2'), { bonus: 0, pekel });
  const een = pekelBonus(pekel, 'b', 'd1');
  assert.equal(een.bonus, 1);
  const twee = pekelBonus(een.pekel, 'c', 'd1');
  assert.equal(twee.bonus, 1);
  assert.equal(pekelBonus(twee.pekel, 'd', 'd1').bonus, 0);
  assert.equal(pekelBonus(undefined, 'b', 'd1').bonus, 0);
});

test('kanon: vuurt bij 12 punten van minstens drie leden', () => {
  assert.equal(kanonTotaal({ inleg: { a: 5, b: 4 } }), 9);
  assert.ok(!kanonVuurt({ inleg: { a: 6, b: 6 } }), 'twee leden zijn niet genoeg');
  assert.ok(kanonVuurt({ inleg: { a: 6, b: 5, c: 1 } }));
  assert.ok(!kanonVuurt({ inleg: { a: 6, b: 5, c: 1 }, gevuurd: true }));
  assert.ok(!kanonVuurt({ inleg: { a: 5, b: 5, c: 1 } }));
  assert.equal(kanonSchade(51), 8);
  assert.equal(kanonSchade(5), 1);
});

test('kanon-inleg: nooit meer dan nodig, een derde lid kan altijd aanhaken', () => {
  assert.deepEqual(kanonInleg({}, 'a', 5, 9), { bedrag: 5 });
  assert.deepEqual(kanonInleg({ inleg: { a: 10 } }, 'b', 5, 9), { bedrag: 2 });
  assert.deepEqual(kanonInleg({ inleg: { a: 6, b: 6 } }, 'c', 5, 9), { bedrag: 1 }, 'vol, maar de derde mag erbij');
  assert.match(kanonInleg({ inleg: { a: 6, b: 6 } }, 'a', 1, 9).weigering, /ander lid/);
  assert.match(kanonInleg({ gevuurd: true }, 'a', 1, 9).weigering, /gevuurd/);
  assert.match(kanonInleg({}, 'a', 3, 2).weigering, /2/);
  assert.match(kanonInleg({}, 'a', 0, 9).weigering, /minstens/);
  assert.equal(KANON_DOEL, 12);
});
