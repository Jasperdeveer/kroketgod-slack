// Tests voor de fallbackketen: wat er gebeurt als een schakel STUK is in plaats van druk.
// Draait met een nagebootste fetch, dus zonder netwerk en zonder echte sleutels. Run: `npm test`.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

// De bank en de LLM-meter schrijven naar JSON-bestanden: naar een tijdelijke map, nooit over de
// echte spelstaat heen. Moet vóór het requiren van llm.js (state.js legt de map vast bij laden).
process.env.KROKET_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-llm-'));

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
const { _draaiModellen, providerCooldownTot, geminiKeyCooldownTot, STUK_STATUSSEN, ketenDefinitie } = llm;
const { BANK_TRAPPEN_MS, bankLijst, wisBank, sleutelId, isGebankt } = require('./providerbank.js');
const { volgendeMiddernachtPacific } = require('./tijd.js');

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

// Een "herstart": alles wat in het geheugen stond is weg, de bank in cooldowns.json niet.
function herstart() {
  providerCooldownTot.clear();
  geminiKeyCooldownTot.clear();
}

test.beforeEach(() => { herstart(); wisBank(); });

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
  assert.equal(bankLijst().length, 0, 'een 429 hoort niet op de persistente bank');
  herstart();
  await metFetch({ cerebras: 401, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  const na401 = bankLijst()[0].restMs;
  assert.ok(na401 > na429 * 10, `401 (${na401}ms) hoort veel langer te banken dan 429 (${na429}ms)`);
});

test('de bank overleeft een herstart', async () => {
  // De dagelijkse pm2-herstart van 03:00 maakte de oude bank (een Map) leeg, en dan kreeg elke
  // dode schakel weer een kans per bericht.
  const bezoeken = await metFetch({ cerebras: 402, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
    herstart();
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.equal(bezoeken.filter(h => h === 'cerebras').length, 1, bezoeken.join(','));
  assert.equal(bankLijst()[0].label, 'Cerebras gpt-oss-120b');
  assert.equal(bankLijst()[0].status, 402);
});

test('een schakel die na zijn straf weer faalt, gaat een trede hoger', async () => {
  await metFetch({ cerebras: 404, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.equal(bankLijst()[0].trap, 1);
  // Straf laten verlopen door de bankregel terug te zetten, dan opnieuw.
  verlopenLaten();
  await metFetch({ cerebras: 404, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  const [regel] = bankLijst();
  assert.equal(regel.trap, 2);
  assert.ok(regel.restMs > BANK_TRAPPEN_MS[0], `${regel.restMs}`);
});

test('één geslaagde aanroep haalt een schakel van de bank', async () => {
  await metFetch({ cerebras: 401, openrouter: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  verlopenLaten();
  await metFetch({ cerebras: 200 }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.ok(!isGebankt('cerebras:gpt-oss-120b'));
  const op = JSON.parse(fs.readFileSync(path.join(process.env.KROKET_STATE_DIR, 'cooldowns.json'), 'utf8'));
  assert.deepEqual(op.llmBank, {}, 'ook de trap is weg');
});

// Zet elke bankregel op "net verlopen", zonder de trap te wissen.
function verlopenLaten() {
  const pad = path.join(process.env.KROKET_STATE_DIR, 'cooldowns.json');
  const op = JSON.parse(fs.readFileSync(pad, 'utf8'));
  for (const r of Object.values(op.llmBank)) r.tot = Date.now() - 1;
  fs.writeFileSync(pad, JSON.stringify(op));
}

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
  assert.ok(BANK_TRAPPEN_MS[0] >= 10 * 60_000);
});

// ── Gemini: per sleutel of voor allemaal? ─────────────────────────────────────

// Nep-fetch voor Gemini: antwoord per sleutel (uit de Bearer-header), de rest 200.
function nepGemini(perSleutel) {
  const bezoeken = [];
  const fn = async (url, opts = {}) => {
    const host = new URL(url).host;
    if (host.startsWith('generativelanguage')) {
      const key = String(opts.headers?.Authorization || '').replace('Bearer ', '');
      bezoeken.push(`gemini:${key}`);
      const [status, body] = perSleutel[key] || [200, ''];
      return { ok: status === 200, status, text: async () => body, json: async () => GOED };
    }
    bezoeken.push(host.replace(/^api\./, '').split('.')[0]);
    return { ok: true, status: 200, text: async () => '', json: async () => GOED };
  };
  fn.bezoeken = bezoeken;
  return fn;
}

async function metGemini(perSleutel, werk) {
  process.env.GEMINI_API_KEYS = 'sleutel-een,sleutel-twee,sleutel-drie';
  const nep = nepGemini(perSleutel);
  huidigeFetch = nep;
  try { await werk(); } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
    delete process.env.GEMINI_API_KEYS;
  }
  return nep.bezoeken;
}

test('een Gemini-503 raakt één sleutel, niet alle drie, en zet Gemini even uit de keten', async () => {
  const overbelast = [503, '{"error":{"code":503,"message":"The model is overloaded."}}'];
  const bezoeken = await metGemini({ 'sleutel-een': overbelast, 'sleutel-twee': overbelast, 'sleutel-drie': overbelast }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.equal(bezoeken.filter(b => b.startsWith('gemini')).length, 1, bezoeken.join(','));
  const rest = providerCooldownTot.get('gemini:gemini-2.5-flash') - Date.now();
  assert.ok(rest > 20_000 && rest <= 60_000, `${rest}`);
  assert.equal(bankLijst().length, 0, 'een overbelaste server is niet stuk');
});

test('een Gemini-sleutel met zijn dagquotum op blijft tot middernacht Pacific op de bank', async () => {
  const dagquotum = [429, '{"error":{"code":429,"details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]},{"retryDelay":"37s"}]}}'];
  const bezoeken = await metGemini({ 'sleutel-een': dagquotum }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
    herstart(); // ook na een herstart blijft hij eraf
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.deepEqual(bezoeken, ['gemini:sleutel-een', 'gemini:sleutel-twee', 'gemini:sleutel-twee']);
  const [regel] = bankLijst();
  assert.equal(regel.sleutel, `gemini-sleutel:${sleutelId('sleutel-een')}`);
  assert.equal(regel.label, 'Gemini-sleutel #1');
  assert.equal(regel.tot, volgendeMiddernachtPacific());
  const op = fs.readFileSync(path.join(process.env.KROKET_STATE_DIR, 'cooldowns.json'), 'utf8');
  assert.ok(!op.includes('sleutel-een'), 'de sleutel zelf staat nooit in het bestand');
});

test('een gewone minuutlimiet-429 komt niet op de bank', async () => {
  const minuut = [429, '{"error":{"code":429,"details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"},{"retryDelay":"37s"}]}}'];
  await metGemini({ 'sleutel-een': minuut }, async () => {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false });
  });
  assert.equal(bankLijst().length, 0);
  assert.ok(geminiKeyCooldownTot.get('sleutel-een') > Date.now());
});

// ── De ketendefinitie ─────────────────────────────────────────────────────────

test('de ketendefinitie noemt de modellen die er écht draaien', () => {
  process.env.GROQ_API_KEY = 'nep';
  try {
    const labels = ketenDefinitie().map(m => m.label);
    assert.ok(labels.includes('Groq gpt-oss-120b'), labels.join(', '));
    assert.ok(labels.includes('Groq gpt-oss-20b'), labels.join(', '));
    assert.ok(!labels.some(l => /70B|8B/.test(l) && l.startsWith('Groq')), labels.join(', '));
    for (const m of ketenDefinitie()) assert.equal(m.cooldownKey, `${m.provider}:${m.naam}`);
  } finally {
    delete process.env.GROQ_API_KEY;
  }
});

// ── De deadline geldt per aanroep, niet alleen tussen schakels ───────────────

// Een schakel die nooit antwoordt tot zijn verzoek wordt afgebroken — zoals een overbelaste
// gratis provider die de socket openhoudt.
function hangtTotAfbreken(url, opts = {}) {
  return new Promise((_, reject) => {
    if (!opts.signal) return; // zonder signaal hangt hij echt voor altijd: dan faalt de test op tijd
    opts.signal.addEventListener('abort', () => {
      const e = new Error('The user aborted a request.');
      e.name = 'AbortError';
      reject(e);
    });
  });
}

test('een hangende schakel wordt op de keten-deadline afgebroken, niet pas na zijn eigen timeout', async () => {
  const bezoeken = [];
  huidigeFetch = async (url, opts) => {
    const host = new URL(url).host.replace(/^api\./, '').split('.')[0];
    bezoeken.push(host);
    if (host === 'cerebras') return hangtTotAfbreken(url, opts);
    return { ok: true, status: 200, text: async () => '', json: async () => GOED };
  };
  const start = Date.now();
  try {
    const uit = await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false, deadlineMs: 300 });
    assert.equal(uit, 'De Raad heeft gesproken.');
  } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
  }
  const duur = Date.now() - start;
  assert.deepEqual(bezoeken, ['cerebras', 'openrouter']);
  assert.ok(duur < 2_000, `duurde ${duur}ms; de eigen timeout van Cerebras is 20s`);
  assert.equal(bankLijst().length, 0, 'een timeout is geen stukke sleutel');
});

test('de laatste schakel krijgt ook na de deadline nog een eerlijke kans', async () => {
  huidigeFetch = async (url, opts) => {
    const host = new URL(url).host.replace(/^api\./, '').split('.')[0];
    if (host === 'cerebras') return hangtTotAfbreken(url, opts);
    // OpenRouter is de laatste en antwoordt na 150 ms — ná de deadline van 100 ms.
    await new Promise(r => setTimeout(r, 150));
    return { ok: true, status: 200, text: async () => '', json: async () => GOED };
  };
  try {
    const uit = await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false, deadlineMs: 100 });
    assert.equal(uit, 'De Raad heeft gesproken.');
  } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
  }
});

test('de Gemini-sleutelrotatie past binnen de tijd die de keten geeft', async () => {
  process.env.GEMINI_API_KEYS = 'a,b,c';
  let geminiBezoeken = 0;
  huidigeFetch = async (url, opts) => {
    if (new URL(url).host.startsWith('generativelanguage')) {
      geminiBezoeken++;
      return hangtTotAfbreken(url, opts);
    }
    return { ok: true, status: 200, text: async () => '', json: async () => GOED };
  };
  const start = Date.now();
  try {
    await _draaiModellen(BERICHTEN, 100, 'slim', { keurKarakter: false, deadlineMs: 300 });
  } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
    delete process.env.GEMINI_API_KEYS;
  }
  assert.equal(geminiBezoeken, 1, 'een timeout roteert niet naar de volgende sleutel');
  assert.ok(Date.now() - start < 2_000);
});

// ── Het tokenbudget per schakel ──────────────────────────────────────────────

test('elke schakel krijgt de prompt op maat van zijn eigen budget', async () => {
  const { inkortbaar } = require('./promptbudget.js');
  process.env.SAMBANOVA_API_KEY = 'nep-sambanova';
  const verstuurd = {};
  huidigeFetch = async (url, opts) => {
    const host = new URL(url).host.replace(/^api\./, '').split('.')[0];
    verstuurd[host] = JSON.parse(opts.body).messages;
    const status = host === 'openrouter' ? 200 : 503;
    return { ok: status === 200, status, text: async () => 'nep', json: async () => GOED };
  };
  // ~17.000 tokens aan stijlvoorbeelden: past bij Cerebras (60k) en OpenRouter (30k), niet bij
  // SambaNova (16k).
  const berichten = [
    { role: 'system', content: `REGELS VOORAAN\n\n${inkortbaar(1, 'voorbeeld '.repeat(6000))}` },
    { role: 'user', content: 'vraag' },
  ];
  try {
    await _draaiModellen(berichten, 100, 'slim', { keurKarakter: false });
  } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
    delete process.env.SAMBANOVA_API_KEY;
  }
  assert.deepEqual(Object.keys(verstuurd).sort(), ['cerebras', 'openrouter', 'sambanova']);
  assert.ok(verstuurd.cerebras[0].content.includes('voorbeeld'), 'Cerebras heeft ruimte genoeg');
  assert.ok(verstuurd.openrouter[0].content.includes('voorbeeld'), 'OpenRouter heeft ruimte genoeg');
  assert.equal(verstuurd.sambanova[0].content.trim(), 'REGELS VOORAAN', 'SambaNova krijgt alleen de regels');
  for (const msgs of Object.values(verstuurd)) {
    for (const m of msgs) assert.ok(!/[]/.test(m.content), 'markeringen gaan nooit de deur uit');
  }
});

test('dagquotum herkennen aan de 429-body van Google', () => {
  const { isDagquotumFout } = llm;
  assert.ok(isDagquotumFout('"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"'));
  assert.ok(isDagquotumFout('Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3-pro-image'));
  assert.ok(!isDagquotumFout('"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "retryDelay": "37s"'));
  assert.ok(!isDagquotumFout('limit: 10, model: gemini-2.5-flash'));
  assert.ok(!isDagquotumFout(null));
});

// ── Formaatkeuring voor stramien-aanroepen ────────────────────────────────────

test('een antwoord in het verkeerde formaat schuift door naar het volgende model', async () => {
  const antwoorden = {
    cerebras: 'Hier is een leuke kroket voor u!',
    openrouter: 'NAAM: De Ramen-kroket\nBESCHRIJVING: Bouillon en noedels in paneer.',
  };
  huidigeFetch = async (url) => {
    const host = new URL(url).host.replace(/^api\./, '').split('.')[0];
    return { ok: true, status: 200, text: async () => '', json: async () => ({ choices: [{ message: { content: antwoorden[host] }, finish_reason: 'stop' }] }) };
  };
  try {
    const uit = await _draaiModellen(BERICHTEN, 350, 'slim', { keurKarakter: false, valideer: t => /NAAM:/.test(t) && /BESCHRIJVING:/.test(t) });
    assert.match(uit, /Ramen-kroket/);
    // Op de laatste schakel beslist de aanroeper zelf: dan krijgt hij het antwoord gewoon.
    antwoorden.openrouter = 'Nog steeds geen stramien.';
    const laatste = await _draaiModellen(BERICHTEN, 350, 'slim', { keurKarakter: false, valideer: () => false });
    assert.equal(laatste, 'Nog steeds geen stramien.');
  } finally {
    huidigeFetch = async () => { throw new Error('geen nep-fetch gezet'); };
  }
});
