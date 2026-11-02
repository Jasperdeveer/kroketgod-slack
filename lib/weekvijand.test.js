// Tests voor de weekvijand die terugslaat. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { WROK_MAX, maxHpVoor, isRazend, slaatTerug, komtTerug, vijandBeurt } = require('./weekvijand.js');

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
  assert.deepEqual(b, { soort: 'herstel', herstel: 4, vochten: 2 });
  assert.equal(vijandBeurt({ hp: 41, maxHp: 42, sindsBeurt: [] }, 6, {}).herstel, 1);
  assert.equal(vijandBeurt({ hp: 42, maxHp: 42 }, 6, {}).herstel, 0);
});

test('zijn beurt: anders wraak op de zwaarste belager die nog iets bezit', () => {
  const raid = { hp: 20, maxHp: 42, sindsBeurt: ['a', 'b', 'c'],
    strijders: { a: { schade: 9 }, b: { schade: 6 }, c: { schade: 2 } } };
  assert.equal(vijandBeurt(raid, 6, { a: 3, b: 1 }).doelwit, 'a');
  assert.equal(vijandBeurt(raid, 6, { a: 0, b: 1 }).doelwit, 'b');
  assert.equal(vijandBeurt(raid, 6, {}).doelwit, null);
});
