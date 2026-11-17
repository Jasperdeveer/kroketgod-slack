// Tests voor de weekvijand in beeld: elke snack heeft een uiterlijk, elk wapen een film, en elke
// film rendert en eindigt op het juiste beeld. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { aanvalFilm, kanonFilm, UITERLIJK, VORMEN, BELEG, WAPENBEELD, uiterlijkVan } = require('./vijandbeeld.js');
const { WAPENS } = require('./wapens.js');
const { naarGif, DEJAVU } = require('./casinobeeld.js');

const render = (svg) => {
  const { Resvg } = require('@resvg/resvg-js');
  return new Resvg(svg, { font: { fontFiles: DEJAVU, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' }, fitTo: { mode: 'width', value: 240 } }).render();
};
const basis = { vijandKey: 'eierbal', vijandNaam: 'De Eierbal', schade: 4, hpVoor: 40, maxHp: 51 };
const laatste = (film) => film.at(-1).svg;

test('elke weekvijand uit index.js heeft een uiterlijk met een bestaande vorm en bestaand beleg', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const WEEKVIJANDEN = ['), bron.indexOf('\n];', bron.indexOf('const WEEKVIJANDEN = [')));
  const sleutels = [...blok.matchAll(/key: '([a-z_]+)'/g)].map(m => m[1]);
  assert.ok(sleutels.length >= 50);
  for (const key of sleutels) {
    const u = UITERLIJK[key];
    assert.ok(u, `${key} heeft geen uiterlijk`);
    assert.ok(VORMEN[u.vorm], `${key}: onbekende vorm ${u.vorm}`);
    for (const b of u.beleg || []) assert.ok(BELEG[b], `${key}: onbekend beleg ${b}`);
  }
});

test('elk wapen uit het arsenaal heeft een beeld, en een onbekende vijand wordt een bal', () => {
  for (const key of Object.keys(WAPENS)) assert.ok(WAPENBEELD[key], key);
  assert.equal(uiterlijkVan('nieuwe_snack').vorm, 'bal');
  const film = aanvalFilm({ ...basis, vijandKey: 'nieuwe_snack', vijandNaam: 'De Nieuwe' });
  assert.ok(render(film[20].svg).width > 0);
});

test('elk wapen geeft een film die rendert en eindigt op de nieuwe HP', () => {
  for (const wapen of [null, ...Object.keys(WAPENS)]) {
    const film = aanvalFilm({ ...basis, wapen });
    assert.ok(film.length >= 25 && film.length <= 60, `${wapen}: ${film.length} beelden`);
    assert.ok(film.every(b => b.svg.startsWith('<svg') && b.ms > 0));
    assert.match(laatste(film), /36\/51 HP/, String(wapen));
    assert.match(laatste(film), /−4/);
    for (const i of [Math.floor(film.length / 2), film.length - 1]) assert.ok(render(film[i].svg).width > 0, `${wapen} beeld ${i}`);
  }
});

test('elke vorm rendert', () => {
  const eenPerVorm = Object.fromEntries(Object.entries(UITERLIJK).map(([k, u]) => [u.vorm, k]));
  assert.equal(Object.keys(eenPerVorm).length, Object.keys(VORMEN).length);
  for (const key of Object.values(eenPerVorm)) {
    const film = aanvalFilm({ ...basis, vijandKey: key, wapen: 'kroketmes' });
    assert.ok(render(film[24].svg).width > 0, key);
  }
});

test('een misser: "MIS!" met de naam van zijn gave, en de HP blijft staan', () => {
  const film = aanvalFilm({ ...basis, wapen: 'frietvork', schade: 0, gemist: true, gave: { soort: 'ontwijk', naam: 'Glad als olie' } });
  assert.match(laatste(film), /MIS!/);
  assert.match(laatste(film), /MIS · GLAD ALS OLIE/);
  assert.match(laatste(film), /40\/51 HP/);
  assert.ok(!film.some(b => b.svg.includes('−0')));
});

test('een ketsende Vetbom: "KETST!", de punten die hij pakt, en geen schade', () => {
  const film = aanvalFilm({ ...basis, wapen: 'vetbom', schade: 0, ketst: true, terugslag: 2 });
  assert.match(laatste(film), /KETST!/);
  assert.match(laatste(film), /−2 PT/);
  assert.match(laatste(film), /40\/51 HP/);
});

test('terugslag: hij valt aan en pakt punten, behalve tegen een Ovenwant', () => {
  assert.match(laatste(aanvalFilm({ ...basis, terugslag: 2 })), /−2 PT/);
  assert.ok(aanvalFilm({ ...basis, terugslag: 2 }).some(b => b.svg.includes('HIJ SLAAT TERUG')));
  assert.ok(!aanvalFilm({ ...basis, wapen: 'ovenwant', terugslag: 2 }).some(b => b.svg.includes('HIJ SLAAT TERUG')));
});

test('de genadeslag: HP op nul, "VERSLAGEN!", en schade nooit meer dan hij nog had', () => {
  const film = aanvalFilm({ ...basis, hpVoor: 3, schade: 6 });
  assert.match(laatste(film), /VERSLAGEN!/);
  assert.match(laatste(film), /0\/51 HP/);
  assert.ok(film.some(b => b.svg.includes('−3')));
  assert.ok(!film.some(b => b.svg.includes('−6')));
});

test('het kanon: een eigen film, ook als genadeslag', () => {
  const film = kanonFilm({ ...basis, schade: 8 });
  assert.match(laatste(film), /32\/51 HP/);
  assert.match(laatste(film), /HET FRITUURKANON/);
  assert.ok(render(film[16].svg).width > 0);
  assert.match(laatste(kanonFilm({ ...basis, schade: 8, hpVoor: 5 })), /VERSLAGEN!/);
});

test('een naam met tekens die SVG breken, wordt ge-escaped', () => {
  const film = aanvalFilm({ ...basis, vijandNaam: 'Patat & <Mayo>' });
  assert.match(film[0].svg, /PATAT &amp; &lt;MAYO&gt;/);
  assert.ok(render(film[0].svg).width > 0);
});

test('banier: pantser, gepekeld en offer', () => {
  assert.match(laatste(aanvalFilm({ ...basis, wapen: 'kroketmes', gave: { soort: 'pantser', naam: 'Hard gekookt' } })), /KROKETMES · DOOR HET PANTSER/);
  assert.match(laatste(aanvalFilm({ ...basis, pekelBonus: 1 })), /AANVAL · GEPEKELD \+1/);
  assert.match(laatste(aanvalFilm({ ...basis, offer: true })), /OFFER-AANVAL/);
});

test('de zwaarste film wordt een GIF van minder dan 1 MB', async () => {
  const film = aanvalFilm({ ...basis, vijandKey: 'patatje_oorlog', wapen: 'vetbom', terugslag: 2, razend: true });
  const { buf } = await naarGif(film, { breedte: 480 });
  assert.equal(buf.subarray(0, 6).toString(), 'GIF89a');
  assert.ok(buf.length < 1024 * 1024, `${Math.round(buf.length / 1024)} kB`);
});
