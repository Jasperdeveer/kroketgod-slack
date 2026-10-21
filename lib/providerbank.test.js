// Tests voor de bank: stukke schakels gaan er steeds langer op, overleven een herstart (het staat
// in cooldowns.json) en komen er na één geslaagde aanroep weer af. Run: `npm test`.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

// Naar een tijdelijke map schrijven, nooit over de echte spelstaat heen. Moet vóór het requiren
// van state.js, die de map bij module-load vastlegt.
const MAP = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-bank-'));
process.env.KROKET_STATE_DIR = MAP;

const {
  BANK_TRAPPEN_MS, TRAP_VERGEET_MS,
  sleutelId, bankStatus, isGebankt, bankStuk, bankTot, geefVrij, bankLijst, wisBank,
} = require('./providerbank.js');

const MIN = 60_000;
const UUR = 60 * MIN;
const T0 = Date.parse('2026-10-21T10:00:00Z');

test.beforeEach(() => wisBank());

test('de trap loopt op: 30 min, 2 uur, 24 uur, en daar blijft hij', () => {
  assert.deepEqual(BANK_TRAPPEN_MS, [30 * MIN, 2 * UUR, 24 * UUR]);
  let nu = T0;
  const verwacht = [30 * MIN, 2 * UUR, 24 * UUR, 24 * UUR];
  for (const [i, duur] of verwacht.entries()) {
    const uit = bankStuk('sambanova:llama', { status: 401 }, nu);
    assert.equal(uit.nieuw, true, `stap ${i}`);
    assert.equal(uit.tot - nu, duur, `stap ${i}`);
    nu = uit.tot + 1; // net verlopen: de volgende probe faalt meteen weer
  }
});

test('een tweede fout terwijl hij al op de bank zit, schiet de trap niet door', () => {
  const eerste = bankStuk('cerebras:gpt-oss-120b', { status: 402 }, T0);
  const tweede = bankStuk('cerebras:gpt-oss-120b', { status: 402 }, T0 + 1000);
  assert.equal(tweede.nieuw, false);
  assert.equal(tweede.tot, eerste.tot);
});

test('de bank overleeft een herstart: hij staat in cooldowns.json', () => {
  bankStuk('openrouter:x', { status: 404, reden: 'model bestaat niet meer' }, T0);
  const op = JSON.parse(fs.readFileSync(path.join(MAP, 'cooldowns.json'), 'utf8'));
  assert.ok(op.llmBank['openrouter:x'], JSON.stringify(op));
  assert.equal(op.llmBank['openrouter:x'].status, 404);
});

test('de bank laat de andere cooldowns in cooldowns.json met rust', () => {
  fs.writeFileSync(path.join(MAP, 'cooldowns.json'), JSON.stringify({ frituur: { U1: 123 }, roof: { U2: '2026-10-19' } }));
  bankStuk('cerebras:x', { status: 402 }, T0);
  wisBank();
  const op = JSON.parse(fs.readFileSync(path.join(MAP, 'cooldowns.json'), 'utf8'));
  assert.deepEqual(op, { frituur: { U1: 123 }, roof: { U2: '2026-10-19' } });
});

test('een geslaagde aanroep haalt hem eraf en zet de trap op nul', () => {
  let uit = bankStuk('groq:a', { status: 401 }, T0);
  uit = bankStuk('groq:a', { status: 401 }, uit.tot + 1);
  assert.equal(uit.trap, 2);
  assert.equal(geefVrij('groq:a'), true);
  assert.equal(geefVrij('groq:a'), false, 'niets te wissen → geen schrijfactie');
  const opnieuw = bankStuk('groq:a', { status: 401 }, uit.tot + 2);
  assert.equal(opnieuw.trap, 1);
});

test('na twee dagen rust begint de trap opnieuw', () => {
  const uit = bankStuk('groq:b', { status: 402 }, T0);
  const later = bankStuk('groq:b', { status: 402 }, uit.tot + TRAP_VERGEET_MS + 1);
  assert.equal(later.trap, 1);
});

test('bankTot zet een vast eindmoment en raakt de trap niet', () => {
  const tot = T0 + 21 * UUR;
  const uit = bankTot('gemini-sleutel:abc', tot, { status: 429, reden: 'dagquotum op', label: 'Gemini-sleutel #2' }, T0);
  assert.equal(uit.tot, tot);
  assert.ok(isGebankt('gemini-sleutel:abc', T0 + UUR));
  assert.ok(!isGebankt('gemini-sleutel:abc', tot + 1));
  // Een verlopen dagquotum telt niet als trede: de eerste harde fout daarna is een halfuur.
  const daarna = bankStuk('gemini-sleutel:abc', { status: 401 }, tot + 1);
  assert.equal(daarna.tot - (tot + 1), 30 * MIN);
});

test('bankLijst toont alleen wat nu op de bank zit, eerstvolgende eerst', () => {
  bankTot('lang', T0 + 10 * UUR, { label: 'Lang' }, T0);
  bankStuk('kort', { status: 401, label: 'Kort' }, T0);
  bankTot('voorbij', T0 - 1, {}, T0 - 2 * UUR);
  const lijst = bankLijst(T0 + MIN);
  assert.deepEqual(lijst.map(r => r.label), ['Kort', 'Lang']);
  assert.equal(lijst[0].trap, 1);
  assert.equal(lijst[0].restMs, 29 * MIN);
  assert.equal(bankStatus('voorbij', T0), null);
});

test('een API-sleutel komt nooit leesbaar in de bank', () => {
  const geheim = 'AIzaSy-dit-is-geheim-1234567890';
  const id = sleutelId(geheim);
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.ok(!geheim.includes(id));
  assert.equal(sleutelId(geheim), id, 'stabiel over herstarts');
});
