// Tests voor de pure kern van raadpleeg. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('./raadpleeg.js');
const { bouwCommandoTekst } = require('./homecommandos.js');

const leeg = (datum = '2026-11-18') => R.dagStaat(null, datum);
const rngVan = (...w) => { let i = 0; return () => w[Math.min(i++, w.length - 1)]; };

test('een nieuwe dag begint leeg', () => {
  const oud = { datum: '2026-11-17', leden: { UA: { horoscoop: { teken: 'gunstig', verbruikt: false } } }, heilige: { kandidaat: 'UB', heilig: true } };
  const nieuw = R.dagStaat(oud, '2026-11-18');
  assert.deepEqual(nieuw, { datum: '2026-11-18', leden: {}, heilige: null });
  assert.equal(R.dagStaat(oud, '2026-11-17'), oud);
});

test('parseRaadpleeg en oudRitueel', () => {
  assert.deepEqual(R.parseRaadpleeg('raadpleeg Orakel wordt het wat'), { ritueel: 'orakel', rest: 'wordt het wat' });
  assert.equal(R.parseRaadpleeg('raadpleeg').ritueel, null);
  assert.equal(R.parseRaadpleeg('raadpleeg dans').ritueel, null);
  assert.equal(R.oudRitueel('horoscoop'), 'horoscoop');
  assert.equal(R.oudRitueel('orakelachtig'), null);
  assert.equal(R.oudRitueel('raadpleeg orakel'), null);
});

test('het sjabloon geeft de juiste commandotekst', () => {
  assert.equal(bouwCommandoTekst(R.RAADPLEEG_SJABLOON, ['orakel', 'wordt het wat']), 'raadpleeg orakel wordt het wat');
  assert.equal(bouwCommandoTekst(R.RAADPLEEG_SJABLOON, ['horoscoop', '']), 'raadpleeg horoscoop');
});

test('horoscoop: één per dag', () => {
  assert.equal(R.trekHoroscoop(leeg(), 'UA', () => 0.59).teken, 'gunstig');
  const r = R.trekHoroscoop(leeg(), 'UA', () => 0.6);
  assert.equal(r.teken, 'ongunstig');
  assert.equal(R.trekHoroscoop(r.staat, 'UA', () => 0.1).fout, 'al_gedaan');
});

test('sterren: beide kanten, goede richting', () => {
  let s = R.trekHoroscoop(leeg(), 'UA', () => 0.1).staat;
  s = R.trekHoroscoop(s, 'UB', () => 0.9).staat;
  const a = R.pakSterren(s, 'UA', 'UB');
  assert.ok(Math.abs(a.delta - 0.2) < 1e-9);
  assert.deepEqual(a.tekens, [{ id: 'UA', teken: 'gunstig' }, { id: 'UB', teken: 'ongunstig' }]);
  const b = R.pakSterren(s, 'UB', 'UA');
  assert.ok(Math.abs(b.delta + 0.2) < 1e-9);
  assert.equal(R.pakSterren(a.staat, 'UA', 'UB').delta, 0);

  const alleen = R.trekHoroscoop(leeg(), 'UA', () => 0.9).staat;
  assert.ok(Math.abs(R.pakSterren(alleen, 'UA', 'UB').delta + 0.1) < 1e-9);

  const nul = R.pakSterren(leeg(), 'UA', 'UB');
  assert.equal(nul.delta, 0);
  assert.deepEqual(nul.staat, leeg());
});

test('biecht', () => {
  const v = R.biecht(leeg(), 'UA', () => 0.39, { raidActief: true });
  assert.equal(v.uitkomst, 'vrijspraak');
  assert.equal(v.boete, null);
  const b = R.biecht(leeg(), 'UA', () => 0.5, { raidActief: false });
  assert.equal(b.uitkomst, 'boete');
  assert.ok(b.boete.actie && b.boete.tekst);
  assert.equal(R.biecht(b.staat, 'UA', () => 0.5, { raidActief: false }).fout, 'al_gedaan');
  // rng 0.99 kiest de laatste boete: raid_aanval, alleen bij raidActief
  assert.equal(R.biecht(leeg(), 'UA', rngVan(0.5, 0.99), { raidActief: true }).boete.actie, 'raid_aanval');
  for (let i = 0; i < 20; i++) {
    assert.notEqual(R.biecht(leeg(), 'UA', rngVan(0.5, i / 20), { raidActief: false }).boete.actie, 'raid_aanval');
  }
});

test('orakel', () => {
  const o = R.orakel(leeg(), 'UA', () => 0, { kandidaten: ['UA', 'UB'], raidActief: false });
  assert.equal(o.voorspelling.doel, 'UB');
  assert.ok(o.voorspelling.tekst.includes('{naam}'));
  const geen = R.orakel(leeg(), 'UA', () => 0, { kandidaten: ['UA'], raidActief: false });
  assert.equal(geen.voorspelling, null);
  assert.equal(R.orakel(geen.staat, 'UA', () => 0, { kandidaten: ['UB'], raidActief: false }).fout, 'al_gedaan');
  for (let i = 0; i < 20; i++) {
    assert.notEqual(R.orakel(leeg(), 'UA', rngVan(0, i / 20), { kandidaten: ['UB'], raidActief: false }).voorspelling.actie, 'raid_aanval');
  }
  assert.equal(R.orakel(leeg(), 'UA', rngVan(0, 0.99), { kandidaten: ['UB'], raidActief: true }).voorspelling.actie, 'raid_aanval');
});

test('verwerkActie: één keer', () => {
  // orakel van UA over UB/offer: rng 0 → eerste kandidaat, voorspelling index 1 via 0.3
  let s = R.orakel(leeg(), 'UA', rngVan(0, 0.3), { kandidaten: ['UB'], raidActief: false }).staat;
  assert.equal(s.leden.UA.orakel.actie, 'offer');
  const r = R.verwerkActie(s, 'UB', 'offer');
  assert.equal(r.uitbetalingen.length, 1);
  assert.equal(r.uitbetalingen[0].soort, 'orakel');
  assert.equal(r.uitbetalingen[0].aan, 'UA');
  assert.equal(R.verwerkActie(r.staat, 'UB', 'offer').uitbetalingen.length, 0);
  assert.equal(R.verwerkActie(s, 'UB', 'eer_gegeven').uitbetalingen.length, 0);
  assert.equal(R.verwerkActie(s, 'UC', 'offer').uitbetalingen.length, 0);

  // boete van UC/eer_gegeven: boetes[0], rng 0.5 → vrijspraak-grens, daarna 0
  const b = R.biecht(leeg(), 'UC', rngVan(0.5, 0), { raidActief: false }).staat;
  assert.equal(b.leden.UC.biecht.boete.actie, 'eer_gegeven');
  const w = R.verwerkActie(b, 'UC', 'eer_gegeven');
  assert.deepEqual(w.uitbetalingen.map((u) => [u.soort, u.aan]), [['boete', 'UC']]);
  assert.equal(R.verwerkActie(w.staat, 'UC', 'eer_gegeven').uitbetalingen.length, 0);
});

test('gisteren betaalt niets', () => {
  const s = R.orakel(leeg('2026-11-17'), 'UA', rngVan(0, 0.3), { kandidaten: ['UB'], raidActief: false }).staat;
  const vandaag = R.dagStaat(s, '2026-11-18');
  assert.equal(R.verwerkActie(vandaag, 'UB', 'offer').uitbetalingen.length, 0);
});

test('canonisatie: voordragen', () => {
  const nu = 1_000_000;
  const args = { voorsteller: 'UA', kandidaat: 'UB', nu, ts: '1.1', kanaal: 'C1' };
  assert.equal(R.draagVoor(leeg(), { ...args, kandidaat: 'UA' }).fout, 'zelf');
  const s = R.draagVoor(leeg(), args).staat;
  assert.equal(s.heilige.tot, nu + 7_200_000);
  assert.equal(R.draagVoor(s, { ...args, kandidaat: 'UC', nu: nu + 1 }).fout, 'al_gedaan');
  assert.equal(R.draagVoor(s, { ...args, voorsteller: 'UD', kandidaat: 'UC', nu: nu + 1 }).fout, 'open_voordracht');
  const nieuw = R.draagVoor(s, { ...args, voorsteller: 'UD', kandidaat: 'UC', nu: nu + 7_200_000 });
  assert.equal(nieuw.staat.heilige.kandidaat, 'UC');
  let h = s;
  for (const u of ['UX', 'UY']) h = R.bevestig(h, { userId: u, ts: '1.1', nu: nu + 1 }).staat;
  assert.equal(R.draagVoor(h, { ...args, voorsteller: 'UD', kandidaat: 'UC', nu: nu + 2 }).fout, 'al_heilige');
});

test('canonisatie: bevestigen', () => {
  const nu = 1_000_000;
  const s = R.draagVoor(leeg(), { voorsteller: 'UA', kandidaat: 'UB', nu, ts: '1.1', kanaal: 'C1' }).staat;
  const b = (st, userId, o = {}) => R.bevestig(st, { userId, ts: '1.1', nu: nu + 1, ...o });
  let r = b(s, 'UA'); assert.equal(r.staat.heilige.bevestigers.length, 0);
  r = b(r.staat, 'UB'); assert.equal(r.staat.heilige.bevestigers.length, 0);
  r = b(r.staat, 'UC'); r = b(r.staat, 'UC');
  assert.equal(r.staat.heilige.bevestigers.length, 1);
  assert.equal(r.nieuwHeilig, false);
  r = b(r.staat, 'UX', { ts: '9.9' }); assert.equal(r.staat.heilige.bevestigers.length, 1);
  r = b(r.staat, 'UX', { nu: nu + 7_200_000 }); assert.equal(r.staat.heilige.bevestigers.length, 1);
  r = b(r.staat, 'UD');
  assert.equal(r.nieuwHeilig, true);
  assert.equal(R.heiligeVandaag(r.staat), 'UB');
  assert.equal(b(r.staat, 'UE').nieuwHeilig, false);
  assert.equal(R.heiligeVandaag(leeg()), null);
});

test('openRituelen', () => {
  assert.deepEqual(R.openRituelen(leeg(), 'UA'), ['horoscoop', 'biecht', 'orakel', 'canoniseer']);
  let s = R.trekHoroscoop(leeg(), 'UA', () => 0).staat;
  s = R.biecht(s, 'UA', () => 0, { raidActief: false }).staat;
  assert.deepEqual(R.openRituelen(s, 'UA'), ['orakel', 'canoniseer']);
  s = R.draagVoor(s, { voorsteller: 'UA', kandidaat: 'UB', nu: 1, ts: '1', kanaal: 'C' }).staat;
  assert.deepEqual(R.openRituelen(s, 'UA'), ['orakel']);
  let h = R.draagVoor(leeg(), { voorsteller: 'UB', kandidaat: 'UC', nu: 1, ts: '1', kanaal: 'C' }).staat;
  for (const u of ['UX', 'UY']) h = R.bevestig(h, { userId: u, ts: '1', nu: 2 }).staat;
  assert.deepEqual(R.openRituelen(h, 'UA'), ['horoscoop', 'biecht', 'orakel']);
});
