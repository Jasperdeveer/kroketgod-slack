// Tests voor de fallbackketen: wat er gebeurt als een schakel STUK is in plaats van druk.
// Draait met een nagebootste fetch, dus zonder netwerk en zonder echte sleutels. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Alleen deze twee schakels aanzetten; de rest valt weg op zijn env-gate. Cerebras staat dan
// vóór OpenRouter in de keten, en is dus niet de laatste — precies de schakel die overgeslagen
// mag worden. Moet vóór het requiren van llm.js, want de keys worden per aanroep gelezen maar
// geminiKeys() leest bij module-load.
process.env.CEREBRAS_API_KEY = 'nep-cerebras';
process.env.OPENROUTER_API_KEY = 'nep-openrouter';
delete process.env.GEMINI_API_KEYS;
delete process.env.GEMINI_API_KEY;
// De Groq-client wordt bij module-load aangemaakt en eist dan een sleutel; de keten leest
// `beschikbaar` pas per aanroep. Dus: zetten om te kunnen laden, daarna weghalen zodat de
// Groq-schakels buiten de keten blijven (die lopen via de SDK en niet via onze nep-fetch).
process.env.GROQ_API_KEY = 'nep-groq-alleen-voor-module-load';
delete process.env.SAMBANOVA_API_KEY;
delete process.env.CLOUDFLARE_ACCOUNT_ID;

// llm.js doet `require('node-fetch')`, dus globalThis.fetch vervangen helpt niet — we moeten
// de module zelf onderscheppen, en dat moet vóór het requiren van llm.js.
const Module = require('module');
let huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
const echteLoad = Module._load;
Module._load = function (naam) {
  if (naam === 'node-fetch') return (...a) => huidigeFetch(...a);
  return echteLoad.apply(this, arguments);
};

const llm = require('./llm.js');
delete process.env.GROQ_API_KEY;
const { _draaiModellen, providerCooldownTot, PROVIDER_STUK_MS, STUK_STATUSSEN } = llm;

const BERICHTEN = [{ role: 'system', content: 'systeem' }, { role: 'user', content: 'vraag' }];
const GOED = { choices: [{ message: { content: 'De Raad heeft gesproken.' }, finish_reason: 'stop' }] };

// Een nep-fetch die per host een vast antwoord geeft en bijhoudt wie er aangeklopt heeft.
function nepFetch(perHost) {
  const bezoeken = [];
  const fn = async (url) => {
    const host = new URL(url).host.replace(/^api\./, '').split('.')[0];
    bezoeken.push(host);
    const status = perHost[host] ?? 200;
    return {
      ok: status === 200,
      status,
      text: async () => `{"message":"nep ${status}"}`,
      json: async () => GOED,
    };
  };
  fn.bezoeken = bezoeken;
  return fn;
}

async function metFetch(perHost, werk) {
  const nep = nepFetch(perHost);
  huidigeFetch = nep;
  try { await werk(nep); } finally { huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); }; }
  return nep.bezoeken;
}

test.beforeEach(() => providerCooldownTot.clear());

test('een stukke schakel wordt na één keer overgeslagen', async () => {
  const bezoeken = await metFetch({ cerebras: 402, openrouter: 200 }, async () => {
    for (let i = 0; i < 3; i++) {
      await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
    }
  });
  // Drie aanroepen, maar Cerebras hoort er maar één keer bij te zitten.
  assert.equal(bezoeken.filter(h => h === 'cerebras').length, 1, bezoeken.join(','));
  assert.equal(bezoeken.filter(h => h === 'openrouter').length, 3, bezoeken.join(','));
});

test('een 429 bankt korter dan een kapotte sleutel', async () => {
  await metFetch({ cerebras: 429, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  const na429 = [...providerCooldownTot.values()][0] - Date.now();
  providerCooldownTot.clear();
  await metFetch({ cerebras: 401, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  const na401 = [...providerCooldownTot.values()][0] - Date.now();
  assert.ok(na401 > na429 * 10, `401 (${na401}ms) hoort veel langer te banken dan 429 (${na429}ms)`);
});

test('een serverfout bankt de schakel niet — die kan zo weer werken', async () => {
  const bezoeken = await metFetch({ cerebras: 503, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.equal(bezoeken.filter(h => h === 'cerebras').length, 2, bezoeken.join(','));
});

test('alleen harde fouten tellen als stuk', () => {
  for (const s of [401, 402, 403, 404]) assert.ok(STUK_STATUSSEN.has(s), String(s));
  for (const s of [429, 500, 502, 503, 413]) assert.ok(!STUK_STATUSSEN.has(s), String(s));
  assert.ok(PROVIDER_STUK_MS >= 10 * 60_000);
});
