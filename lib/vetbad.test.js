// Tests voor het Vetbad: de kansverdeling, de Vetpot (die nooit punten bijdrukt) en Dubbel of niks
// (eerlijk, één keer, alleen voor de winnaar). Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GRENZEN, JACKPOT_FACTOR, VETPOT_AANDEEL, VETPOT_START, VETPOT_MAX, DUBBEL_GELDIG_MS, DUBBEL_BEWAAR_MS,
  uitkomstVan, jackpotVrij, beslisUitkomst, vetbadDelta, potInleg, naInleg, verwachtingPerPunt,
  dubbelOfNiksDelta, toetsDubbel, ruimKansen,
} = require('./vetbad.js');

const bijna = (a, b) => Math.abs(a - b) < 1e-9;

// ── De kansen ─────────────────────────────────────────────────────────────────

test('de worp valt in de juiste band, ook precies op een grens', () => {
  assert.equal(uitkomstVan(0), 'vetpot');
  assert.equal(uitkomstVan(0.0099), 'vetpot');
  assert.equal(uitkomstVan(0.01), 'dubbel');
  assert.equal(uitkomstVan(0.3799), 'dubbel');
  assert.equal(uitkomstVan(0.38), 'terug');
  assert.equal(uitkomstVan(0.55), 'verzwolgen');
  assert.equal(uitkomstVan(0.9999), 'verzwolgen');
});

test('er is nog maar één jackpot, en die valt in 1% van de worpen', () => {
  assert.deepEqual(GRENZEN.map(([n]) => n), ['vetpot', 'dubbel', 'terug', 'verzwolgen']);
  assert.ok(bijna(Object.fromEntries(GRENZEN).vetpot, 0.01));
  assert.equal(JACKPOT_FACTOR, 3);
});

test('de verdeling over 10.000 gelijke stappen klopt', () => {
  const telling = {};
  for (let i = 0; i < 10000; i++) {
    const u = uitkomstVan(i / 10000);
    telling[u] = (telling[u] || 0) + 1;
  }
  assert.deepEqual(telling, { vetpot: 100, dubbel: 3700, terug: 1700, verzwolgen: 4500 });
});

test('hoogstens één jackpot per week: daarna wordt een jackpotworp een verdubbeling', () => {
  const WEEK = '2026-10-19';
  assert.equal(jackpotVrij({}, WEEK), true);
  assert.equal(jackpotVrij({ jackpotWeek: '2026-10-12' }, WEEK), true);
  assert.equal(jackpotVrij({ jackpotWeek: WEEK }, WEEK), false);
  assert.equal(jackpotVrij({}, null), false);
  assert.equal(beslisUitkomst(0, { jackpotVrij: true }), 'vetpot');
  assert.equal(beslisUitkomst(0, { jackpotVrij: false }), 'dubbel');
  // De andere uitkomsten merken niets van het plafond.
  for (const worp of [0.2, 0.4, 0.9]) {
    assert.equal(beslisUitkomst(worp, { jackpotVrij: false }), uitkomstVan(worp));
  }
});

test('wat elk offer oplevert', () => {
  assert.equal(vetbadDelta('vetpot', 4, 23), 12 + 23);
  assert.equal(vetbadDelta('dubbel', 4), 4);
  assert.equal(vetbadDelta('terug', 4), 0);
  assert.equal(vetbadDelta('verzwolgen', 4), -4);
});

// ── Geen geldmachine ──────────────────────────────────────────────────────────

test('voor de speler blijft het Vetbad een put van 5% per ingezet punt', () => {
  assert.ok(bijna(verwachtingPerPunt(), -0.05), String(verwachtingPerPunt()));
});

test('ook mét de pot meegeteld drukt het Vetbad geen punten bij', () => {
  // De pot wordt gevuld uit het huisvoordeel, niet erbovenop. Met de demping voor wie achterloopt
  // (hoogstens het halve huisvoordeel gemiddeld) erbij moet er nog marge onder nul overblijven.
  const collectief = verwachtingPerPunt({ collectief: true });
  assert.ok(bijna(collectief, -0.0275), String(collectief));
  assert.ok(collectief < 0);
  assert.ok(VETPOT_AANDEEL * 0.5 < 0.05, 'de pot mag nooit het hele huisvoordeel opslokken');
});

// ── De pot vullen ─────────────────────────────────────────────────────────────

test('van een verlies druipt gemiddeld precies een twintigste in de pot', () => {
  for (const verlies of [1, 3, 6, 10]) {
    let som = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) som += potInleg(verlies, (i + 0.5) / N);
    assert.ok(Math.abs(som / N - verlies * VETPOT_AANDEEL) < 0.002, `verlies ${verlies}: ${som / N}`);
  }
});

test('nooit een negatieve of halve inleg', () => {
  assert.equal(potInleg(0, 0), 0);
  assert.equal(potInleg(-3, 0), 0);
  for (const w of [0, 0.3, 0.99]) assert.ok(Number.isInteger(potInleg(7, w)));
});

test('de pot heeft een plafond; wat erboven druipt loopt over', () => {
  assert.equal(VETPOT_START, 10);
  assert.deepEqual(naInleg(10, 1), { pot: 11, overloop: 0 });
  assert.deepEqual(naInleg(VETPOT_MAX, 1), { pot: VETPOT_MAX, overloop: 1 });
  assert.deepEqual(naInleg(VETPOT_MAX - 1, 3), { pot: VETPOT_MAX, overloop: 2 });
  assert.deepEqual(naInleg(undefined, 2), { pot: 2, overloop: 0 });
});

// ── Dubbel of niks ────────────────────────────────────────────────────────────

test('dubbel of niks is eerlijk: verwachting precies nul', () => {
  let som = 0;
  for (let i = 0; i < 1000; i++) som += dubbelOfNiksDelta(6, (i + 0.5) / 1000);
  assert.equal(som, 0);
  assert.equal(dubbelOfNiksDelta(6, 0.49), 6);
  assert.equal(dubbelOfNiksDelta(6, 0.5), -6);
});

const NU = 1_800_000_000_000;
const kans = (extra = {}) => ({ userId: 'U_A', winst: 6, ts: NU, gespeeld: false, ...extra });

test('alleen de winnaar, één keer, binnen een kwartier, en alleen als de winst er nog is', () => {
  assert.deepEqual(toetsDubbel(kans(), 'U_A', NU + 60_000, 10), { ok: true });
  assert.equal(toetsDubbel(null, 'U_A', NU, 10).reden, 'onbekend');
  assert.equal(toetsDubbel(kans(), 'U_B', NU, 10).reden, 'niet_uw');
  assert.equal(toetsDubbel(kans({ gespeeld: true }), 'U_A', NU, 10).reden, 'gespeeld');
  assert.equal(toetsDubbel(kans(), 'U_A', NU + DUBBEL_GELDIG_MS + 1, 10).reden, 'verlopen');
  assert.deepEqual(toetsDubbel(kans(), 'U_A', NU + DUBBEL_GELDIG_MS, 10), { ok: true });
  assert.equal(toetsDubbel(kans(), 'U_A', NU, 5).reden, 'uitgegeven');
  assert.deepEqual(toetsDubbel(kans(), 'U_A', NU, 6), { ok: true });
});

test('oude kansen worden opgeruimd', () => {
  const kansen = { oud: kans({ ts: NU - DUBBEL_BEWAAR_MS }), vers: kans({ ts: NU - 1000 }) };
  assert.deepEqual(Object.keys(ruimKansen(kansen, NU)), ['vers']);
  assert.deepEqual(ruimKansen(undefined, NU), {});
});
