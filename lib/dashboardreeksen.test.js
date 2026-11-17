// Tests voor de dashboardreeksen. Run: `npm test`.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bouwReeksen } = require('./dashboardreeksen.js');

const NU = Date.parse('2026-11-19T12:00:00Z'); // donderdag; week ma 2026-11-16
const ts = (dag, uur = 10) => Date.parse(`${dag}T${String(uur).padStart(2, '0')}:00:00Z`);
const naam = (id) => `lid-${id}`;
const R = (bron = {}) => bouwReeksen({ nu: NU, naam, ...bron });

test('lege bron: elke reeks bestaat met een lege standaardwaarde', () => {
  const r = R();
  assert.equal(r.puntenWeek.labels.length, 7);
  assert.equal(r.schatkist.labels.length, 21);
  assert.equal(r.gegevenGenomen.labels.length, 21);
  assert.equal(r.casinoPerDag.labels.length, 14);
  assert.equal(r.llm.labels.length, 14);
  for (const k of ['puntenWeek', 'activiteitWeekdag', 'kaartenMaand', 'ingrepenPerDag', 'huiswinst', 'llm']) assert.deepEqual(r[k].reeksen.filter((x) => x.punten.some((p) => p !== 0 && p !== null)), [], k);
  for (const k of ['ingrepenPerId', 'verrassingen', 'aflaten', 'spellen', 'winnaarsVerliezers']) assert.deepEqual(r[k], [], k);
  assert.deepEqual(r.schatkist.reeksen[0].punten, Array(21).fill(null));
  assert.deepEqual(r.weekvijand.schade, []);
});

test('kapotte bronnen gooien niet', () => {
  assert.doesNotThrow(() => bouwReeksen({ nu: NU, puntenhistorie: 'x', regie: { log: 5 }, geleKaarten: [], berichten: 7, winkel: { items: null }, casinostats: { '2026-11-19': { leden: 3 } }, raid: { strijders: 4, log: 'x' }, llmstats: { dagen: [] } }));
  assert.doesNotThrow(() => bouwReeksen());
});

test('puntenWeek: weekscore per lid, null voor dagen zonder stand', () => {
  const r = R({ puntenhistorie: { dagen: { '2026-11-16': { A: 2 }, '2026-11-17': { A: 5, B: 1 } } } });
  assert.deepEqual(r.puntenWeek.reeksen.find((x) => x.naam === 'lid-A').punten, [2, 5, null, null, null, null, null]);
  assert.deepEqual(r.puntenWeek.reeksen.find((x) => x.naam === 'lid-B').punten, [0, 1, null, null, null, null, null]);
});

test('schatkist: dagstand per dag, vandaag live', () => {
  const r = R({ puntenhistorie: { schatkist: { '2026-11-18': 12, '2026-11-19': 99 } }, schatkistNu: 15 });
  const p = r.schatkist.reeksen[0].punten;
  assert.equal(p[19], 12);
  assert.equal(p[20], 15);
  assert.equal(p[0], null);
});

test('activiteitWeekdag: gemiddelde over vier weken per weekdag (Amsterdam)', () => {
  const b = [ts('2026-11-16'), ts('2026-11-09'), ts('2026-11-02'), ts('2026-10-26'), ts('2026-10-01')].map((t) => ({ ts: t, sprekerId: 'A' }));
  const r = R({ berichten: b });
  assert.deepEqual(r.activiteitWeekdag.reeksen[0].punten, [1, 0, 0, 0, 0, 0, 0]); // 4 maandagen in 28 dagen, 1 buiten het venster
});

test('kaartenMaand: geel en rood per lid, alleen deze maand', () => {
  const r = R({ geleKaarten: { A: { kaarten: [{ ts: ts('2026-11-03') }, { ts: ts('2026-11-04'), kleur: 'rood' }, { ts: ts('2026-10-30') }] }, B: { kaarten: [] } } });
  assert.deepEqual(r.kaartenMaand.labels, ['lid-A']);
  assert.deepEqual(r.kaartenMaand.reeksen.map((x) => x.punten), [[1], [1]]);
});

test('gegevenGenomen en ingrepen uit het regielog', () => {
  const log = [
    { ts: ts('2026-11-19'), id: 'zegen', laag: 'ingreep', soort: 'geven', punten: 3 },
    { ts: ts('2026-11-19', 11), id: 'belasting', laag: 'ingreep', soort: 'nemen', punten: -4 },
    { ts: ts('2026-11-19', 12), id: 'raadsel', laag: 'verrassing', soort: 'verrassing', punten: 0 },
    { ts: ts('2026-11-10'), id: 'zegen', laag: 'ingreep', soort: 'geven', punten: 2 },
    { ts: ts('2026-10-01'), id: 'zegen', laag: 'ingreep', soort: 'geven', punten: 9 },
  ];
  const r = R({ regie: { log } });
  const [geg, gen] = r.gegevenGenomen.reeksen.map((x) => x.punten);
  assert.equal(geg[20], 3); assert.equal(gen[20], 4); assert.equal(geg[11], 2);
  assert.equal(geg.reduce((a, b) => a + b), 5); // het log van oktober valt buiten 21 dagen
  const geven = r.ingrepenPerDag.reeksen.find((x) => x.naam === 'geven').punten;
  assert.equal(geven[13], 1); assert.equal(geven[4], 1);
  assert.deepEqual(r.ingrepenPerId[0], { label: 'zegen', value: 2, soort: 'geven' });
  assert.deepEqual(r.verrassingen.map((v) => [v.id, v.dag, v.minuut]), [['raadsel', '2026-11-19', 13 * 60]]);
});

test('aflaten: omzet per item deze week', () => {
  const items = [{ ts: ts('2026-11-17'), item: 'schild', prijs: 5 }, { ts: ts('2026-11-18'), item: 'schild', prijs: 5 }, { ts: ts('2026-11-18'), item: 'vet', prijs: 3 }, { ts: ts('2026-11-10'), item: 'vet', prijs: 3 }];
  const r = R({ winkel: { items }, itemNaam: (k) => k.toUpperCase() });
  assert.deepEqual(r.aflaten, [{ label: 'SCHILD', value: 10, verkocht: 2 }, { label: 'VET', value: 3, verkocht: 1 }]);
});

test('casino: per dag, huiswinst cumulatief, spellen en winnaars', () => {
  const stats = {
    '2026-11-18': { leden: { A: { slots: { spellen: 2, ingezet: 4, uitbetaald: 1 } }, B: { dobbel: { spellen: 1, ingezet: 2, uitbetaald: 6 } } } },
    '2026-11-19': { leden: { A: { slots: { spellen: 1, ingezet: 3, uitbetaald: 0 } } } },
  };
  const r = R({ casinostats: stats });
  const [ing, uit, sp] = r.casinoPerDag.reeksen.map((x) => x.punten);
  assert.deepEqual([ing[12], uit[12], sp[12]], [6, 7, 3]);
  assert.deepEqual([ing[13], uit[13], sp[13]], [3, 0, 1]);
  assert.deepEqual(r.huiswinst.reeksen[0].punten.slice(-2), [-1, 2]);
  assert.deepEqual(r.spellen, [{ label: 'slots', value: 3, ingezet: 7 }, { label: 'dobbel', value: 1, ingezet: 2 }]);
  assert.deepEqual(r.winnaarsVerliezers, [{ label: 'lid-B', value: 4 }, { label: 'lid-A', value: -6 }]);
});

test('weekvijand: HP per dag van deze vijand, schade en wapens', () => {
  const raid = { actief: true, hp: 20, maxHp: 40, weekStart: '2026-11-16', strijders: { A: { schade: 5 }, B: { schade: 0 }, C: { schade: 9 } }, wapenTelling: { vetbom: 2 } };
  const hist = { raid: { '2026-11-16': { key: '2026-11-16', hp: 40, maxHp: 40 }, '2026-11-17': { key: '2026-11-16', hp: 31, maxHp: 40 }, '2026-11-15': { key: 'oud', hp: 1, maxHp: 9 } } };
  const r = R({ raid, puntenhistorie: hist, wapenNaam: (k) => `W-${k}` });
  assert.deepEqual(r.weekvijand.reeksen[0].punten, [40, 31, null, 20, null, null, null]);
  assert.equal(r.weekvijand.maxHp, 40);
  assert.deepEqual(r.weekvijand.schade, [{ label: 'lid-C', value: 9 }, { label: 'lid-A', value: 5 }]);
  assert.deepEqual(r.weekvijand.wapens, [{ label: 'W-vetbom', value: 2 }]);
  const oud = R({ raid: { ...raid, wapenTelling: undefined, log: [{ wapen: 'x' }, { wapen: 'x' }, {}] } });
  assert.deepEqual(oud.weekvijand.wapens, [{ label: 'x', value: 2 }]);
});

test('llm: calls per provider per dag', () => {
  const r = R({ llmstats: { dagen: { '2026-11-19': { gemini: 4, groq: 2 }, '2026-11-18': { gemini: 1 }, '2026-10-01': { oud: 9 } } } });
  assert.deepEqual(r.llm.reeksen.map((x) => x.naam), ['gemini', 'groq']);
  assert.deepEqual(r.llm.reeksen[0].punten.slice(-2), [1, 4]);
});
