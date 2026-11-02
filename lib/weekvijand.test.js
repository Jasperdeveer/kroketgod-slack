// Tests voor de weekvijand die terugslaat. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');
const { WROK_MAX, GAVEN, GAVE_SOORTEN, gaveVan, maxHpVoor, isRazend, slaatTerug, terugslagBuit, schadeNaGave, komtTerug, vijandBeurt } = require('./weekvijand.js');
const gave = (soort) => ({ soort, naam: 'test' });

test('HP: 7 per lid, geschaald met karakter en wrok, met een bodem', () => {
  assert.equal(maxHpVoor(6, 1), 42);
  assert.equal(maxHpVoor(6, 1.3), 55);
  assert.equal(maxHpVoor(6, 1, 1), 50);
  assert.equal(maxHpVoor(1, 0.7), 12);
});

test('razend onder de helft, en dan slaat hij vaker terug', () => {
  const heel = { hp: 30, maxHp: 42 }, gewond = { hp: 21, maxHp: 42 };
  assert.ok(!isRazend(heel));
  assert.ok(isRazend(gewond));
  assert.ok(!isRazend({ hp: 0, maxHp: 42 }));
  assert.ok(!slaatTerug(heel, 0.3));
  assert.ok(slaatTerug(gewond, 0.3));
  assert.ok(!slaatTerug({ hp: 0, maxHp: 42 }, 0), 'een dode slaat niet terug');
});

test('wrok heeft een eind: na WROK_MAX keer terug komt er een nieuwe', () => {
  const ontsnapt = (wrok) => ({ vijand: { key: 'x' }, verslagen: false, hp: 5, wrok });
  assert.ok(komtTerug(ontsnapt(0)));
  assert.ok(komtTerug(ontsnapt(WROK_MAX - 1)));
  assert.ok(!komtTerug(ontsnapt(WROK_MAX)));
  assert.ok(!komtTerug({ vijand: { key: 'x' }, verslagen: true, hp: 0 }));
  assert.ok(!komtTerug({}));
});

test('zijn beurt: herstel als minder dan de helft vocht, nooit boven zijn maximum', () => {
  const b = vijandBeurt({ hp: 30, maxHp: 42, sindsBeurt: ['a', 'b'] }, 6, {});
  assert.deepEqual(b, { soort: 'herstel', herstel: 4, doelwitten: [], vochten: 2 });
  assert.equal(vijandBeurt({ hp: 41, maxHp: 42, sindsBeurt: [] }, 6, {}).herstel, 1);
  assert.equal(vijandBeurt({ hp: 42, maxHp: 42 }, 6, {}).herstel, 0);
});

test('zijn beurt: anders wraak op de zwaarste belager die nog iets bezit', () => {
  const raid = { hp: 20, maxHp: 42, sindsBeurt: ['a', 'b', 'c'],
    strijders: { a: { schade: 9 }, b: { schade: 6 }, c: { schade: 2 } } };
  assert.deepEqual(vijandBeurt(raid, 6, { a: 3, b: 1 }).doelwitten, ['a']);
  assert.deepEqual(vijandBeurt(raid, 6, { a: 0, b: 1 }).doelwitten, ['b']);
  assert.deepEqual(vijandBeurt(raid, 6, {}).doelwitten, []);
});

test('elke weekvijand in index.js heeft precies één gave, en elke gave hoort bij een vijand', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const WEEKVIJANDEN = ['), bron.indexOf('\n];', bron.indexOf('const WEEKVIJANDEN = [')));
  const sleutels = [...blok.matchAll(/\{ key: '([^']+)'/g)].map(m => m[1]);
  assert.equal(sleutels.length, 52);
  assert.deepEqual([...sleutels].sort(), Object.keys(GAVEN).sort());
  for (const [key, g] of Object.entries(GAVEN)) {
    assert.ok(GAVE_SOORTEN[g.soort], `${key}: onbekende soort ${g.soort}`);
    assert.ok(g.naam && g.tekst, `${key}: naam en tekst`);
  }
  assert.equal(gaveVan('slavink').regel, GAVE_SOORTEN.pantser.regel);
  assert.equal(gaveVan('bestaat_niet'), null);
});

test('taaie gaven leveren HP in, dikhuid krijgt er bij', () => {
  assert.equal(maxHpVoor(6, 1, 0, gave('pantser')), 34);
  assert.equal(maxHpVoor(6, 1, 0, gave('dikhuid')), 50);
  assert.equal(maxHpVoor(6, 1, 0, gave('stekels')), 42);
});

test('schade na de gave', () => {
  assert.equal(schadeNaGave(3, gave('pantser')), 2);
  assert.equal(schadeNaGave(2, gave('pantser')), 2);
  assert.equal(schadeNaGave(3, gave('ontwijk'), { worp: 0.1 }), 0);
  assert.equal(schadeNaGave(3, gave('ontwijk'), { worp: 0.5 }), 3);
  assert.equal(schadeNaGave(1, gave('samen'), { aanvalNr: 0 }), 1, 'nooit onder de 1');
  assert.equal(schadeNaGave(3, gave('samen'), { aanvalNr: 1 }), 2);
  assert.equal(schadeNaGave(3, gave('samen'), { aanvalNr: 2 }), 4);
  assert.equal(schadeNaGave(3, gave('dikhuid'), { metOffer: true }), 4);
  assert.equal(schadeNaGave(3, gave('dikhuid')), 3);
  assert.equal(schadeNaGave(3, null), 3);
});

test('gemene gaven: vaker terug, dubbel stelen, vroeg razend', () => {
  const raid = { hp: 30, maxHp: 42 };
  assert.ok(!slaatTerug(raid, 0.3));
  assert.ok(slaatTerug(raid, 0.3, gave('stekels')));
  assert.equal(terugslagBuit(gave('hebzucht')), 2);
  assert.equal(terugslagBuit(null), 1);
  assert.ok(!isRazend(raid));
  assert.ok(isRazend(raid, gave('kortlontje')));
});

test('beurt met gave: hongerig herstelt eerder, taai heelt ook op een wraakdag, wraakzucht treft er twee', () => {
  const raid = { hp: 20, maxHp: 42, sindsBeurt: ['a', 'b', 'c'],
    strijders: { a: { schade: 9 }, b: { schade: 6 }, c: { schade: 2 } } };
  const scores = { a: 1, b: 1, c: 1 };
  assert.equal(vijandBeurt(raid, 6, scores).soort, 'wraak');
  assert.equal(vijandBeurt(raid, 6, scores, gave('hongerig')).soort, 'herstel');
  const taai = vijandBeurt(raid, 6, scores, gave('taai'));
  assert.equal(taai.soort, 'wraak');
  assert.equal(taai.herstel, 2);
  assert.equal(vijandBeurt({ ...raid, sindsBeurt: [] }, 6, scores, gave('taai')).herstel, 6);
  assert.deepEqual(vijandBeurt(raid, 6, scores, gave('wraakzucht')).doelwitten, ['a', 'b']);
});
