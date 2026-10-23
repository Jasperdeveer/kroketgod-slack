// Tests voor de kaarten: geel is een uur, rood is een dag, en de tweede gele kaart in dezelfde
// week wordt vanzelf rood. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GELE_KAART_UREN, RODE_KAART_UREN,
  geleKaarten, kleurVoorNieuweKaart, schorsingUren, voegKaartToe, zonderLaatsteGeleKaart,
} = require('./kaarten.js');

const WEEK = '2026-10-19';   // een maandag
const VORIGE = '2026-10-12';

const geel = (week, reden = 'x') => ({ ts: 1, reden, weekSleutel: week, kleur: 'geel' });
const rood = (week, reden = 'x') => ({ ts: 1, reden, weekSleutel: week, kleur: 'rood' });

test('geel is een uur, rood is een dag', () => {
  assert.equal(GELE_KAART_UREN, 1);
  assert.equal(RODE_KAART_UREN, 24);
  assert.equal(schorsingUren('geel'), 1);
  assert.equal(schorsingUren('rood'), 24);
});

// ── Welke kleur ───────────────────────────────────────────────────────────────

test('de eerste kaart van de week is geel', () => {
  assert.equal(kleurVoorNieuweKaart(undefined, WEEK), 'geel');
  assert.equal(kleurVoorNieuweKaart({ kaarten: [] }, WEEK), 'geel');
});

test('de tweede gele kaart in dezelfde week wordt rood', () => {
  assert.equal(kleurVoorNieuweKaart({ kaarten: [geel(WEEK)] }, WEEK), 'rood');
});

test('een gele kaart van vorige week telt niet mee', () => {
  assert.equal(kleurVoorNieuweKaart({ kaarten: [geel(VORIGE)] }, WEEK), 'geel');
});

test('na rood blijft elke volgende kaart die week rood — geen escalatie boven de dag', () => {
  const dossier = { kaarten: [geel(WEEK), rood(WEEK)] };
  assert.equal(kleurVoorNieuweKaart(dossier, WEEK), 'rood');
  assert.equal(schorsingUren(kleurVoorNieuweKaart(dossier, WEEK)), 24);
});

test('kaarten van vóór deze regel hebben geen kleur en tellen als geel', () => {
  const oud = { kaarten: [{ ts: 1, reden: 'x', weekSleutel: WEEK }], bannenDezeWeek: [{ ts: 1, weekSleutel: WEEK, duurUren: 4 }] };
  assert.equal(geleKaarten(oud, WEEK), 1);
  assert.equal(kleurVoorNieuweKaart(oud, WEEK), 'rood');
});

test('alleen een rode kaart deze week (geel weggestreept) begint weer bij geel', () => {
  assert.equal(kleurVoorNieuweKaart({ kaarten: [rood(WEEK)] }, WEEK), 'geel');
});

// ── Tellen en registreren ─────────────────────────────────────────────────────

test('geleKaarten telt per week of in totaal, en nooit rood', () => {
  const dossier = { kaarten: [geel(VORIGE), geel(WEEK), rood(WEEK)] };
  assert.equal(geleKaarten(dossier, WEEK), 1);
  assert.equal(geleKaarten(dossier), 2);
  assert.equal(geleKaarten(undefined), 0);
});

test('voegKaartToe zet de kaart erbij zonder het oude dossier te wijzigen', () => {
  const oud = { kaarten: [geel(WEEK)], bannenDezeWeek: [] };
  const nieuw = voegKaartToe(oud, { kleur: 'rood', reden: 'opnieuw', week: WEEK, ts: 5 });
  assert.equal(oud.kaarten.length, 1);
  assert.deepEqual(nieuw.kaarten[1], { ts: 5, reden: 'opnieuw', weekSleutel: WEEK, kleur: 'rood' });
  assert.deepEqual(nieuw.bannenDezeWeek, []);
  assert.equal(voegKaartToe(undefined, { kleur: 'geel', reden: 'r', week: WEEK, ts: 1 }).kaarten.length, 1);
});

// ── De Zachte Hand ────────────────────────────────────────────────────────────

test('de Zachte Hand schrapt de laatste gele kaart en laat rood staan', () => {
  const dossier = { kaarten: [geel(VORIGE, 'oud'), geel(WEEK, 'nieuw'), rood(WEEK, 'rood')] };
  const { dossier: na, weg } = zonderLaatsteGeleKaart(dossier);
  assert.equal(weg.reden, 'nieuw');
  assert.deepEqual(na.kaarten.map(k => k.reden), ['oud', 'rood']);
  assert.equal(dossier.kaarten.length, 3); // origineel ongemoeid
});

test('wie geen gele kaart heeft, verliest niets aan de Zachte Hand', () => {
  const dossier = { kaarten: [rood(WEEK)] };
  assert.deepEqual(zonderLaatsteGeleKaart(dossier), { dossier, weg: null });
  assert.equal(zonderLaatsteGeleKaart(undefined).weg, null);
});

test('na het schrappen van de gele kaart van deze week is de volgende weer geel', () => {
  const { dossier } = zonderLaatsteGeleKaart({ kaarten: [geel(WEEK)] });
  assert.equal(kleurVoorNieuweKaart(dossier, WEEK), 'geel');
});
