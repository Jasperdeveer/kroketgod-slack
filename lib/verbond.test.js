// Tests voor heilige verbonden van twee of drie: oude paren blijven werken, aansluiten gaat via een
// verzoek dat een lid moet accepteren, en een verbond wordt nooit groter dan drie. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VERBOND_MAX, VERZOEK_GELDIG_MS,
  groepen, naarOpslag, groepVan, bondgenotenVan, verlaat, sluitPaar,
  beoordeelVerbond, toetsVerzoek, sluitAan, kiesEen, namenLijst,
} = require('./verbond.js');

// Het echte bestand op de Pi, oud formaat.
const OUD = { A: 'B', B: 'A', C: 'D', D: 'C' };
const NU = 1_800_000_000_000;

test('het oude formaat (lid → partner) wordt gewoon gelezen', () => {
  assert.deepEqual(groepen(OUD), [['A', 'B'], ['C', 'D']]);
  assert.deepEqual(bondgenotenVan(OUD, 'A'), ['B']);
  assert.deepEqual(bondgenotenVan(OUD, 'E'), []);
  assert.equal(groepVan(OUD, 'E'), null);
});

test('het nieuwe formaat is symmetrisch en kan drie leden dragen', () => {
  const drie = naarOpslag([['A', 'B', 'E']]);
  assert.deepEqual(drie, { A: ['B', 'E'], B: ['A', 'E'], E: ['A', 'B'] });
  assert.deepEqual(bondgenotenVan(drie, 'E'), ['A', 'B']);
  assert.deepEqual(groepen(drie), [['A', 'B', 'E']]);
});

test('een half kapot bestand levert nooit twee verbonden voor één lid op', () => {
  assert.deepEqual(groepen({ A: 'B', B: 'C' }), [['A', 'B', 'C']]);
  assert.deepEqual(groepen({ A: 'A', X: '' }), []);
  assert.deepEqual(groepen(null), []);
});

test('het maximum is drie', () => {
  assert.equal(VERBOND_MAX, 3);
  assert.equal(VERZOEK_GELDIG_MS, 24 * 3600 * 1000);
});

// ── Wat "alliantie [naam]" doet ───────────────────────────────────────────────

test('iemand zonder verbond: direct een paar', () => {
  assert.equal(beoordeelVerbond({}, 'A', 'B').soort, 'paar');
  assert.equal(beoordeelVerbond(OUD, 'E', 'F').soort, 'paar');
});

test('een verbond van twee: aansluiten wordt een verzoek', () => {
  const r = beoordeelVerbond(OUD, 'E', 'A');
  assert.equal(r.soort, 'verzoek');
  assert.deepEqual(r.groep, ['A', 'B']);
  // Ook als de aanvrager zelf al in een ander verbond zit.
  assert.equal(beoordeelVerbond(OUD, 'C', 'A').soort, 'verzoek');
});

test('een vol verbond, uzelf, of al verbonden', () => {
  const vol = naarOpslag([['A', 'B', 'E']]);
  assert.equal(beoordeelVerbond(vol, 'C', 'A').soort, 'vol');
  assert.equal(beoordeelVerbond(OUD, 'A', 'A').soort, 'zelf');
  assert.equal(beoordeelVerbond(OUD, 'A', 'B').soort, 'al_verbonden');
});

// ── Verzoeken beantwoorden ────────────────────────────────────────────────────

const verzoek = (extra = {}) => ({ vanId: 'E', doelId: 'A', ts: NU, gesloten: false, ...extra });

test('alleen een lid van het verbond beslist, binnen 24 uur, één keer', () => {
  assert.deepEqual(toetsVerzoek(verzoek(), OUD, 'A', NU + 1000).groep, ['A', 'B']);
  assert.equal(toetsVerzoek(verzoek(), OUD, 'B', NU).ok, true);
  assert.equal(toetsVerzoek(verzoek(), OUD, 'C', NU).reden, 'niet_lid');
  assert.equal(toetsVerzoek(verzoek(), OUD, 'E', NU).reden, 'niet_lid'); // de aanvrager zelf niet
  assert.equal(toetsVerzoek(verzoek({ gesloten: true }), OUD, 'A', NU).reden, 'gesloten');
  assert.equal(toetsVerzoek(verzoek(), OUD, 'A', NU + VERZOEK_GELDIG_MS + 1).reden, 'verlopen');
  assert.equal(toetsVerzoek(null, OUD, 'A', NU).reden, 'onbekend');
});

test('het verbond zoals het NU is telt: opgeheven of intussen vol', () => {
  assert.equal(toetsVerzoek(verzoek(), {}, 'A', NU).reden, 'opgeheven');
  const vol = naarOpslag([['A', 'B', 'F']]);
  assert.equal(toetsVerzoek(verzoek(), vol, 'A', NU).reden, 'vol');
  const alErin = naarOpslag([['A', 'B', 'E']]);
  assert.equal(toetsVerzoek(verzoek(), alErin, 'A', NU).reden, 'al_verbonden');
});

test('aansluiten: de aanvrager verlaat zijn eigen verbond en komt erbij', () => {
  const na = sluitAan(OUD, 'C', 'A');
  assert.deepEqual(groepen(na), [['A', 'B', 'C']]); // D blijft alleen achter: geen verbond meer
  const naE = sluitAan(OUD, 'E', 'A');
  assert.deepEqual(groepen(naE), [['A', 'B', 'E'], ['C', 'D']]);
});

// ── Verlaten en een nieuw paar ────────────────────────────────────────────────

test('verlaten: een verbond van drie wordt een paar, een paar houdt op', () => {
  const drie = naarOpslag([['A', 'B', 'E'], ['C', 'D']]);
  assert.deepEqual(groepen(verlaat(drie, 'E')), [['A', 'B'], ['C', 'D']]);
  assert.deepEqual(groepen(verlaat(OUD, 'A')), [['C', 'D']]);
  assert.deepEqual(groepen(verlaat(OUD, 'Z')), [['A', 'B'], ['C', 'D']]);
});

test('een nieuw paar: beiden verlaten hun oude verbond, zoals altijd', () => {
  assert.deepEqual(groepen(sluitPaar(OUD, 'A', 'C')), [['A', 'C']]);
  const drie = naarOpslag([['A', 'B', 'E']]);
  assert.deepEqual(groepen(sluitPaar(drie, 'E', 'F')), [['A', 'B'], ['E', 'F']]);
});

// ── Hulpjes ───────────────────────────────────────────────────────────────────

test('kiesEen verdeelt eerlijk en kiest nooit buiten de lijst', () => {
  assert.equal(kiesEen([], 0.5), null);
  assert.equal(kiesEen(['A', 'B'], 0), 'A');
  assert.equal(kiesEen(['A', 'B'], 0.5), 'B');
  assert.equal(kiesEen(['A', 'B'], 0.9999), 'B');
  const telling = {};
  for (let i = 0; i < 300; i++) { const k = kiesEen(['A', 'B', 'C'], i / 300); telling[k] = (telling[k] || 0) + 1; }
  assert.deepEqual(telling, { A: 100, B: 100, C: 100 });
});

test('namenLijst leest als gewone taal', () => {
  assert.equal(namenLijst([]), '');
  assert.equal(namenLijst(['A']), 'A');
  assert.equal(namenLijst(['A', 'B']), 'A en B');
  assert.equal(namenLijst(['A', 'B', 'C']), 'A, B en C');
});
