// Tests voor de Gunst: de grenzen, de netto-berekening en de zondagse uitkering.
// Pure functies met injecteerbare weeksleutel en klok. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GUNST_PER_WEEK, GUNST_BODEM, ROEM_MAX_PER_WEEK,
  gegevenDezeWeek, mag, boekGunst, nettoGulheid, roemVoorGulheid, uitkering, ruimOudeWeken,
} = require('./gunst.js');

const A = 'U_A', B = 'U_B', C = 'U_C';
const WEEK = '2026-10-12', VOLGENDE = '2026-10-19';
const NU = new Date('2026-10-14T12:00:00Z').getTime();
const RIJK = 20;

// Helper: n gunsten boeken en het boek teruggeven.
function metGaven(...paren) {
  let boek = {};
  for (const [van, naar, week = WEEK] of paren) ({ boek } = boekGunst(boek, van, naar, week, NU));
  return boek;
}

// ── De grenzen ────────────────────────────────────────────────────────────────

test('een gewone gunst mag', () => {
  assert.deepEqual(mag({}, A, B, RIJK, WEEK), { ok: true });
});

test('jezelf iets gunnen mag niet', () => {
  const r = mag({}, A, A, RIJK, WEEK);
  assert.equal(r.ok, false);
  assert.match(r.reden, /uzelf/i);
});

test('hoogstens twee gunsten per week', () => {
  const boek = metGaven([A, B], [A, C]);
  assert.equal(gegevenDezeWeek(boek, A, WEEK).length, GUNST_PER_WEEK);
  const r = mag(boek, A, 'U_D', RIJK, WEEK);
  assert.equal(r.ok, false);
  assert.match(r.reden, /al vergeven/i);
});

test('hoogstens één gunst per persoon per week', () => {
  const boek = metGaven([A, B]);
  const r = mag(boek, A, B, RIJK, WEEK);
  assert.equal(r.ok, false);
  assert.match(r.reden, /al iets gegund/i);
  // Aan iemand ánders mag nog wel.
  assert.equal(mag(boek, A, C, RIJK, WEEK).ok, true);
});

test('de limieten lopen per week opnieuw', () => {
  const boek = metGaven([A, B], [A, C]);
  assert.equal(mag(boek, A, B, RIJK, WEEK).ok, false);
  assert.equal(mag(boek, A, B, RIJK, VOLGENDE).ok, true);
});

test('je moet er zelf genoeg overhouden', () => {
  // Precies op de rand: met GUNST_BODEM + 1 kun je nog net geven, met GUNST_BODEM niet meer.
  assert.equal(mag({}, A, B, GUNST_BODEM + 1, WEEK).ok, true);
  const r = mag({}, A, B, GUNST_BODEM, WEEK);
  assert.equal(r.ok, false);
  assert.match(r.reden, /overhouden/i);
  assert.equal(mag({}, A, B, 0, WEEK).ok, false);
});

test('de grenzen gelden ook bij een ontbrekend of raar boek', () => {
  assert.equal(mag(null, A, B, RIJK, WEEK).ok, true);
  assert.equal(mag({}, null, B, RIJK, WEEK).ok, false);
  assert.equal(mag({}, A, null, RIJK, WEEK).ok, false);
});

// ── Boeken ────────────────────────────────────────────────────────────────────

test('boekGunst muteert het bestaande boek niet', () => {
  const boek = {};
  boekGunst(boek, A, B, WEEK, NU);
  assert.deepEqual(boek, {});
});

test('gunsten van verschillende weken staan los van elkaar', () => {
  const boek = metGaven([A, B], [A, C, VOLGENDE]);
  assert.equal(gegevenDezeWeek(boek, A, WEEK).length, 1);
  assert.equal(gegevenDezeWeek(boek, A, VOLGENDE).length, 1);
});

// ── Netto gulheid ─────────────────────────────────────────────────────────────

test('netto is gegeven minus gekregen', () => {
  const boek = metGaven([A, B], [A, C]);
  assert.equal(nettoGulheid(boek, A, WEEK), 2);
  assert.equal(nettoGulheid(boek, B, WEEK), -1);
});

test('rondpompen levert per constructie niets op', () => {
  // Dit is de hele reden dat het netto is: twee leden die elkaar om beurten een punt
  // toeschuiven komen allebei op nul uit en krijgen dus geen roem.
  const boek = metGaven([A, B], [B, A]);
  assert.equal(nettoGulheid(boek, A, WEEK), 0);
  assert.equal(nettoGulheid(boek, B, WEEK), 0);
  assert.equal(roemVoorGulheid(nettoGulheid(boek, A, WEEK)), 0);
  assert.equal(roemVoorGulheid(nettoGulheid(boek, B, WEEK)), 0);
});

test('wie niets deed heeft netto nul', () => {
  assert.equal(nettoGulheid({}, A, WEEK), 0);
});

// ── Roem ──────────────────────────────────────────────────────────────────────

test('roem komt pas bij twee netto punten, en nooit meer dan één', () => {
  assert.equal(roemVoorGulheid(0), 0);
  assert.equal(roemVoorGulheid(1), 0);
  assert.equal(roemVoorGulheid(2), 1);
  assert.equal(roemVoorGulheid(99), ROEM_MAX_PER_WEEK);
});

test('een negatieve netto levert nooit roem of straf op', () => {
  assert.equal(roemVoorGulheid(-5), 0);
  assert.equal(roemVoorGulheid(NaN), 0);
});

// ── De uitkering ──────────────────────────────────────────────────────────────

test('de uitkering noemt alleen wie werkelijk iets overhield', () => {
  const boek = metGaven([A, B], [A, C], [B, C]);
  const uit = uitkering(boek, [A, B, C], WEEK);
  assert.equal(uit.length, 1, 'alleen A gaf netto twee punten weg');
  assert.equal(uit[0].id, A);
  assert.equal(uit[0].roem, 1);
});

test('een lege week keert niets uit', () => {
  assert.deepEqual(uitkering({}, [A, B, C], WEEK), []);
});

test('de uitkering staat op volgorde van gulheid', () => {
  const boek = metGaven([A, B], [A, C], [B, C], [B, 'U_D']);
  const uit = uitkering(boek, [A, B, C, 'U_D'], WEEK);
  assert.ok(uit.length >= 1);
  for (let i = 1; i < uit.length; i++) assert.ok(uit[i - 1].netto >= uit[i].netto);
});

// ── Opruimen ──────────────────────────────────────────────────────────────────

test('oude weken worden opgeruimd, recente blijven', () => {
  let boek = {};
  for (const w of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']) ({ boek } = boekGunst(boek, A, B, w, NU));
  const r = ruimOudeWeken(boek, 4);
  assert.equal(r.gewijzigd, true);
  assert.deepEqual(Object.keys(r.boek).sort(), ['w3', 'w4', 'w5', 'w6']);
});

test('opruimen doet niets als er weinig weken zijn', () => {
  const boek = metGaven([A, B]);
  assert.equal(ruimOudeWeken(boek, 4).gewijzigd, false);
});
