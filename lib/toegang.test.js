// Tests voor de toegang tot het genootschap: wie mag zich aanmelden. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { magAanmelden } = require('./toegang.js');

test('aanmelden in het gewijde kanaal zelf mag', () => {
  assert.deepEqual(magAanmelden({ inHoofdkanaal: true }), { ok: true });
});

test('via een DM of de App Home mag het niet zonder bevestiging uit de kanaalleden', () => {
  // De exploit: een werkruimtegebruiker buiten het besloten kanaal werd zo lid.
  const r = magAanmelden({ inHoofdkanaal: false, kanaalLid: null });
  assert.equal(r.ok, false);
  assert.match(r.reden, /gewijde kanaal/);
  assert.equal(magAanmelden({ kanaalLid: false }).ok, false);
});

test('een bevestigd kanaallid mag zich ook elders aanmelden', () => {
  assert.deepEqual(magAanmelden({ inHoofdkanaal: false, kanaalLid: true }), { ok: true });
});

test('wie al lid is wordt nooit opnieuw ingeschreven, ook niet in het kanaal', () => {
  // Opnieuw aanmelden wiste rol en karakter: het formulier schreef het dossier opnieuw.
  const r = magAanmelden({ alLid: true, inHoofdkanaal: true, kanaalLid: true });
  assert.equal(r.ok, false);
  assert.match(r.reden, /al lid/);
});

test('zonder gegevens is het antwoord nee', () => {
  assert.equal(magAanmelden().ok, false);
  assert.equal(magAanmelden({}).ok, false);
});
