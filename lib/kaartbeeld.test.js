// Tests voor de kaartillustraties van App Home 2.0: elke tekening is geldige SVG die resvg naar PNG omzet.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { kaartSvg, vijandPortret, KAART_SLEUTELS, KNOP_NAAR_SLEUTEL } = require('./kaartbeeld.js');
const { naarPng } = require('./casinobeeld.js');
const { UITERLIJK } = require('./vijandbeeld.js');

const isPng = (b) => b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
const UIT = process.env.KAARTBEELD_UIT; // optioneel: bewaar proefplaatjes

test('er is een tekening per actie', () => {
  assert.deepEqual([...KAART_SLEUTELS].sort(), ['bingo', 'casino', 'duel', 'eer', 'gast', 'gok', 'gunst', 'offer', 'raadpleeg', 'roof', 'veiling', 'visioen']);
  for (const k of ['open_raadpleeg', 'open_duel', 'open_roof', 'open_offer', 'open_casino', 'open_eer', 'open_gunst', 'open_visioen', 'open_bingo', 'open_gok']) {
    assert.ok(KAART_SLEUTELS.includes(KNOP_NAAR_SLEUTEL[k]), k);
  }
});

test('veiling- en gastknoppen hebben hun tekening', () => {
  for (const k of ['veiling_bied_1', 'veiling_bied_3', 'gast_vasthouden_0', 'gast_vasthouden_3']) assert.ok(KAART_SLEUTELS.includes(KNOP_NAAR_SLEUTEL[k]), k);
});

test('elke kaarttekening wordt een PNG zonder tekst in het plaatje', () => {
  for (const k of KAART_SLEUTELS) {
    const svg = kaartSvg(k);
    assert.ok(svg.startsWith('<svg') && !/<text/.test(svg), k);
    const png = naarPng(svg);
    assert.ok(isPng(png) && png.length > 2000, k);
    if (UIT) fs.writeFileSync(`${UIT}/${k}.png`, png);
  }
});

test('onbekende sleutel gooit', () => assert.throws(() => kaartSvg('onzin')));

test('elk vijandportret wordt een PNG, ook voor een onbekende key', () => {
  for (const key of [...Object.keys(UITERLIJK), 'bestaat_niet']) {
    const svg = vijandPortret(key);
    assert.ok(!/<text/.test(svg), key);
    assert.ok(isPng(naarPng(svg)), key);
  }
  if (UIT) for (const key of ['hotdog', 'airfryer_kroket', 'friet_speciaal_oorlog']) fs.writeFileSync(`${UIT}/vijand-${key}.png`, naarPng(vijandPortret(key)));
});
