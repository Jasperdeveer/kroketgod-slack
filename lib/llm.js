// ── LLM-transport ──────────────────────────────────────────────────────────────
// De fallbackketen over alle gratis providers, met per-key en per-model cooldowns, retries bij
// afkapping en een vangnet voor lege of uit-karakter antwoorden.
//
// De naad met index.js ligt bij TRANSPORT versus PROMPTING: hier staat hoe een verzoek bij een
// model komt en wat er met de respons gebeurt; wat er IN de prompt staat (systeem-prompt,
// ledendata, stemming van de dag) blijft in index.js. Daardoor heeft deze module geen enkele
// afhankelijkheid terug naar het hoofdbestand.

const Groq = require('groq-sdk');
const fetch = require('node-fetch');

const { readJSON, writeJSON } = require('./state.js');
const { instelling } = require('./instellingen.js');
const { kapAfOpZinsgrens } = require('./tekst.js');
const { volgendeMiddernachtPacific } = require('./tijd.js');
const { pasInBudget } = require('./promptbudget.js');
const {
  BANK_TRAPPEN_MS, sleutelId, isGebankt, bankStatus, bankStuk, bankTot, geefVrij,
} = require('./providerbank.js');
const {
  isUitKarakter,
  isRijksgrensOvertreding,
  KARAKTER_FALLBACK,
  RIJKSGRENS_FALLBACK,
} = require('./karakter.js');

// timeout + maxRetries:0 — de groq-sdk doet standaard 2 interne retries op 429/5xx, wat onder
// quota-druk latentie én quota-verbruik verdrievoudigt. Onze eigen fallbackketen vangt fouten al
// op, dus interne retries zijn contraproductief; korte timeout voorkomt vastlopers.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 15000, maxRetries: 0 });

// ── Tijdslimiet per aanroep ────────────────────────────────────────────────────
// De keten-deadline werd alleen TUSSEN schakels gecontroleerd. Een schakel die op 30 s van de 35
// begon, kreeg gewoon zijn volle 15-20 s timeout, en Gemini zelfs 15 s per sleutel × drie sleutels.
// Nu krijgt elke aanroep min(eigen timeout, wat er van de deadline over is), afgedwongen met een
// AbortSignal: node-fetch en de groq-sdk breken het verzoek dan echt af in plaats van het
// resultaat te negeren terwijl de socket openblijft.
const GEMINI_TIMEOUT_MS = 15_000;
const COMPAT_TIMEOUT_MS = 20_000;
const GROQ_TIMEOUT_MS = 15_000;

// De laatste schakel wordt ook ná de deadline nog geprobeerd (liever een antwoord dan de statische
// fallback); die krijgt dan dit minimum in plaats van een tijdslimiet van nul.
const LAATSTE_SCHAKEL_MIN_MS = 8_000;

function tijdslimiet(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1, Math.round(ms)));
  t.unref?.();
  return { signal: ctrl.signal, klaar: () => clearTimeout(t) };
}

// Een afgebroken verzoek als nette fout, met de tijd erin, zodat de keten-log "timeout na 8 s"
// zegt in plaats van "The user aborted a request".
function alsTimeout(err, wie, ms) {
  if (err?.name !== 'AbortError' && err?.type !== 'aborted') return err;
  const fout = new Error(`${wie} timeout na ${Math.round(ms / 100) / 10}s`);
  fout.status = 0; fout.timeout = true;
  return fout;
}

// Roept Gemini via OpenAI-compatible endpoint. Geeft hetzelfde object terug als Groq.
// Verzamelt alle beschikbare Gemini-keys: GEMINI_API_KEYS (comma-separated, meerdere projecten)
// plus de losse GEMINI_API_KEY. Dubbele keys worden ontdubbeld, volgorde blijft behouden.
function geminiKeys() {
  const multi = (process.env.GEMINI_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  const enkel = process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY.trim()] : [];
  return [...new Set([...multi, ...enkel])];
}

// Extra output-budget dat we reasoning-modellen meegeven bovenop het gevraagde aantal tokens.
// Bij reasoning-modellen (Gemini, Cerebras gpt-oss) tellen de 'denk'-tokens mee in max_tokens;
// zonder headroom eten die het output-budget op en wordt de zichtbare zin halverwege afgekapt.
// 512 bleek soms te krap (Gemini kan bij een creatieve prompt 800+ denk-tokens gebruiken → nog
// steeds een afgekapte zin), vandaar ruimer: 1024.
const REDENEER_HEADROOM = 1024;

// Welke modellen denken eerst (en rekenen die denk-tokens mee in max_tokens)? Gemini, Cerebras
// gpt-oss, en op Groq de gpt-oss- en qwen3-modellen. Bepaalt de headroom én het tokenbudget.
function isRedeneermodel(provider, naam) {
  return provider === 'gemini' || provider === 'cerebras'
    || (provider === 'groq' && /gpt-oss|qwen3/i.test(String(naam || '')));
}

// ── Groq-modelnamen: één plek, aanpasbaar zonder deploy ────────────────────────
// Groq zet modellen zonder aankondiging uit. `llama-3.3-70b-versatile` en `llama-3.1-8b-instant` zijn
// zo allebei verdwenen (404 model_not_found), en die namen stonden op negen plekken los hardgecodeerd:
// de modellenketen hieronder, de sarcasme-detectie, de ban-toets, de sentimentanalyse, de quiz, de
// trivia-vertaling, de quotameter van het dashboard en de prompt-bouwer van het visioen. Alles wat
// daarop stond viel stil — de meeste met een stille catch, en het visioen met "het Grote Vetbad is
// overbelast" nog vóór er één beeldmodel was aangeroepen.
// Actuele lijst opvragen: GET https://api.groq.com/openai/v1/models (met de Groq-key).
const GROQ_SLIM  = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_LICHT = process.env.GROQ_MODEL_LICHT || 'openai/gpt-oss-20b';

// Per-key cooldown: een sleutel die 429 (quota/rate-limit) geeft slaan we even over, zodat we niet
// elk bericht opnieuw twee dode round-trips naar Google maken voordat we bij een werkende key zijn.
// Korte window: is het 'm een dag-quota, dan kost dat hooguit één probe per window; is het een
// tijdelijke rate-limit, dan komt de key vanzelf snel weer in de rotatie.
const geminiKeyCooldownTot = new Map();

const GEMINI_KEY_COOLDOWN_MS = 5 * 60_000;

// Een 429 met "PerDay" in de body is het DAGquotum van die sleutel, niet de minuutlimiet. Dat komt
// pas om middernacht Pacific-tijd terug, dus die sleutel gaat tot dan op de (persistente) bank —
// anders kost hij na elke herstart en elke verlopen 10-min-cooldown opnieuw een dode round-trip.
const geminiBankSleutel = (key) => `gemini-sleutel:${sleutelId(key)}`;

// Tot wanneer een Gemini-sleutel niet bevraagd wordt: de langste van de korte cooldown in het
// geheugen (minuutlimiet) en de bank (dagquotum). 0 = vrij. Ook voor het dashboard.
function geminiSleutelVrijOp(key, nu = Date.now()) {
  const kort = geminiKeyCooldownTot.get(key) || 0;
  const bank = bankStatus(geminiBankSleutel(key), nu)?.tot || 0;
  const tot = Math.max(kort, bank);
  return tot > nu ? tot : 0;
}

// `timeoutMs` begrenst de HELE sleutelrotatie, niet elke sleutel apart.
async function callGemini({ model, messages, max_tokens, temperature }, { timeoutMs = GEMINI_TIMEOUT_MS * 3 } = {}) {
  const stopOp = Date.now() + timeoutMs;
  const keys = geminiKeys();
  if (keys.length === 0) {
    const err = new Error('GEMINI_API_KEY niet geconfigureerd');
    err.status = 0; err.skip = true;
    throw err;
  }

  // Sla keys over die net 429 gaven (per-key cooldown). Staat ÁLLES in cooldown (alle keys op hun
  // dag-quota), dan Gemini in z'n geheel skippen i.p.v. elk bericht 3 dode keys af te gaan (~1,5s
  // verspild per bericht). De cooldown verloopt vanzelf, dus elke ~5 min wordt er weer één getest.
  const nu = Date.now();
  const teProberen = keys.filter(key => !geminiSleutelVrijOp(key, nu));
  if (teProberen.length === 0) {
    const err = new Error('Alle Gemini-keys in cooldown (dag-quota op) — Gemini overgeslagen');
    err.status = 429; err.skip = true;
    throw err;
  }

  let laatsteFout;
  // Roteer over de keys bij een rate limit/quota (429). Serverfouten en timeouts niet: die zitten
  // bij Google en raken elke sleutel.
  for (let i = 0; i < teProberen.length; i++) {
    const key = teProberen[i];
    const nr = keys.indexOf(key) + 1; // origineel sleutelnummer, voor herkenbare logging
    const rest = Math.min(GEMINI_TIMEOUT_MS, stopOp - Date.now());
    if (rest <= 0) {
      const err = new Error('Gemini: geen tijd meer voor de volgende sleutel');
      err.status = 0; err.timeout = true;
      throw laatsteFout || err;
    }
    const limiet = tijdslimiet(rest);
    let response, errorText;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          // 'low' i.p.v. 'none': een beetje denken houdt Gemini ín karakter (met 'none' viel hij
          // geregeld uit karakter → die respons werd weggegooid en kostte een quota-call voor niks).
          // Valkuil: bij Gemini tellen thinking-tokens mee in max_tokens, dus geef output-budget
          // headroom zodat het denken de zichtbare output niet uithongert (anders lege respons).
          max_tokens: max_tokens ? max_tokens + REDENEER_HEADROOM : max_tokens,
          temperature,
          reasoning_effort: 'low',
        }),
        // Korte timeout (zie GEMINI_TIMEOUT_MS): een gratis-tier Gemini die binnen 15s niets
        // teruggeeft komt niet meer, en de keten heeft zijn deadline.
        signal: limiet.signal,
      });
      if (response.ok) {
        geminiKeyCooldownTot.delete(key); // weer gezond → uit cooldown halen
        if (nr > 1) console.log(`✓ Gemini via reservesleutel #${nr}`);
        return await response.json();
      }
      errorText = await response.text();
    } catch (err) {
      // Een timeout zit bij Google, niet bij de sleutel: niet doorroteren, de keten valt door.
      throw alsTimeout(err, 'Gemini', rest);
    } finally {
      limiet.klaar();
    }
    laatsteFout = new Error(`Gemini ${response.status}: ${errorText.substring(0, 200)}`);
    laatsteFout.status = response.status;
    // Bij 429 deze key in cooldown zetten. Gemini noemt zelf een retry-delay in de body
    // (vaak ~60s = per-minuut RPM-limiet, GEEN dag-quota) — respecteer die i.p.v. een vaste
    // 5-min cooldown, zodat een key die over een minuut weer mag niet onnodig 5 min wegvalt.
    // Geclampt op [20s, 10min]; niet-parsebaar → de default.
    if (response.status === 429) {
      const m = errorText.match(/retry[^0-9]*([\d.]+)\s*s/i);
      const retryMs = m ? Math.round(parseFloat(m[1]) * 1000) : GEMINI_KEY_COOLDOWN_MS;
      const cooldownMs = Math.min(Math.max(retryMs, 20_000), 10 * 60_000);
      geminiKeyCooldownTot.set(key, Date.now() + cooldownMs);
      if (/PerDay/i.test(errorText)) {
        const { nieuw, tot } = bankTot(geminiBankSleutel(key), volgendeMiddernachtPacific(),
          { status: 429, reden: 'dagquotum op', label: `Gemini-sleutel #${nr}` });
        if (nieuw) console.warn(`🚫 Gemini-sleutel #${nr}: dagquotum op — tot ${new Date(tot).toISOString()} (middernacht Pacific) op de bank.`);
      }
    }
    // Een serverfout zit bij Google, niet bij de sleutel: een 503 ("model overloaded") geldt voor
    // álle sleutels tegelijk. Doorroteren kostte drie dode round-trips per bericht (productielog:
    // ~170 Gemini-503's), dus stoppen en de keten laten doorvallen; die zet Gemini even op de bank.
    if (response.status >= 500) {
      laatsteFout.overbelast = response.status === 503;
      throw laatsteFout;
    }
    // Alleen doorrouteren naar de volgende key bij quota/rate-limit.
    if (response.status !== 429 || i === teProberen.length - 1) throw laatsteFout;
    console.warn(`⚠️ Gemini-sleutel #${nr} gaf ${response.status} — volgende sleutel proberen.`);
  }
  throw laatsteFout;
}

// Generieke caller voor elke OpenAI-compatibele chat-completions API (Cerebras, OpenRouter, ...).
// Gate op de API-key: ontbreekt die, dan skip (de fallbackketen gaat door naar het volgende model).
async function callOpenAICompat({ url, apiKey, envNaam, body, timeoutMs = COMPAT_TIMEOUT_MS }) {
  if (!apiKey) {
    const err = new Error(`${envNaam} niet geconfigureerd`);
    err.status = 0; err.skip = true;
    throw err;
  }
  // Korte timeout: trage gratis providers (bv. overbelaste OpenRouter-modellen) mogen de
  // keten niet 60s blokkeren — liever snel doorvallen naar het volgende model.
  const ms = Math.min(COMPAT_TIMEOUT_MS, timeoutMs);
  const limiet = tijdslimiet(ms);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: limiet.signal,
    });
    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`${envNaam} ${response.status}: ${errorText.substring(0, 200)}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  } catch (err) {
    throw alsTimeout(err, envNaam.replace(/_API_(KEY|TOKEN)$/, ''), ms);
  } finally {
    limiet.klaar();
  }
}

// Dispatcht één chat-completion naar de juiste provider. Alle providers zijn OpenAI-compatibel,
// dus `opts` ({ model, messages, max_tokens, temperature }) gaat ongewijzigd door.
// `timeoutMs` is de tijd die deze aanroep maximaal mag kosten (de keten geeft mee wat er van zijn
// deadline over is); elke provider houdt daarnaast zijn eigen, kortere plafond.
async function roepModelAan(provider, opts, { timeoutMs } = {}) {
  const limiet = Number(timeoutMs) > 0 ? { timeoutMs: Number(timeoutMs) } : {};
  switch (provider) {
    case 'gemini':   return callGemini(opts, limiet);
    // De gpt-oss- en qwen3-modellen op Groq zijn REDENEERmodellen: de denk-tokens tellen mee in
    // max_tokens, precies zoals bij Cerebras en Gemini hieronder. Zonder headroom komt er een halve zin
    // terug. Alleen voor die modellen, want reasoning_effort naar een model dat het niet kent is een 400.
    case 'groq': {
      const redeneert = isRedeneermodel('groq', opts.model);
      const ms = Math.min(GROQ_TIMEOUT_MS, limiet.timeoutMs || GROQ_TIMEOUT_MS);
      const t = tijdslimiet(ms);
      try {
        return await groq.chat.completions.create(redeneert ? {
          ...opts,
          max_tokens: opts.max_tokens ? opts.max_tokens + REDENEER_HEADROOM : opts.max_tokens,
          reasoning_effort: 'low',
        } : opts, { timeout: ms, signal: t.signal });
      } catch (err) {
        // De sdk gooit bij een afgebroken verzoek een APIUserAbortError zonder status.
        throw /abort/i.test(err?.name || err?.constructor?.name || '') ? alsTimeout({ name: 'AbortError' }, 'Groq', ms) : err;
      } finally {
        t.klaar();
      }
    }
    case 'cerebras': return callOpenAICompat({
      ...limiet,
      url: 'https://api.cerebras.ai/v1/chat/completions',
      apiKey: process.env.CEREBRAS_API_KEY, envNaam: 'CEREBRAS_API_KEY',
      // gpt-oss-120b is een reasoning-model; 'low' houdt het snel (~350ms). Net als bij Gemini
      // tellen de 'denk'-tokens mee in max_tokens, dus geef output-headroom — anders vreet het
      // redeneren het budget op en wordt de zichtbare zin halverwege afgekapt.
      body: {
        ...opts,
        max_tokens: opts.max_tokens ? opts.max_tokens + REDENEER_HEADROOM : opts.max_tokens,
        reasoning_effort: 'low',
      },
    });
    case 'openrouter': return callOpenAICompat({
      ...limiet,
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY, envNaam: 'OPENROUTER_API_KEY', body: opts,
    });
    case 'sambanova': return callOpenAICompat({
      ...limiet,
      url: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY, envNaam: 'SAMBANOVA_API_KEY', body: opts,
    });
    case 'cloudflare': return callOpenAICompat({
      ...limiet,
      // Cloudflare Workers AI: account-ID zit in de URL, API-token is de Bearer-key.
      url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
      apiKey: process.env.CLOUDFLARE_API_TOKEN, envNaam: 'CLOUDFLARE_API_TOKEN', body: opts,
    });
    default: throw new Error(`Onbekende provider: ${provider}`);
  }
}

// Korte cooldown per provider na een 429 (rate limit). Zolang een provider in cooldown staat,
// slaat de keten hem over i.p.v. er elk bericht opnieuw een trage round-trip op te wachten.
// De laatste schakel wordt nooit overgeslagen, zodat er altijd een poging tot antwoord is.
const providerCooldownTot = new Map();

const PROVIDER_COOLDOWN_MS = 45_000;

// Een schakel kan ook STUK zijn in plaats van druk: een verkeerde of nooit ingevulde sleutel
// (401/403), een model dat is opgeruimd (404) of een opgebruikt gratis quotum (402). Die gaat op
// de persistente bank van lib/providerbank.js, met een oplopende straf (30 min → 2 uur → 24 uur)
// die een herstart overleeft. Zie de toelichting daar.
const STUK_STATUSSEN = new Set([401, 402, 403, 404]);
const STUK_UITLEG = { 401: 'Sleutel klopt niet.', 402: 'Quotum op.', 403: 'Sleutel klopt niet.', 404: 'Model bestaat niet meer.' };

// "30 min", "2 uur", "24 uur" — voor de bank-logregel.
const duurTekst = (ms) => (ms >= 90 * 60_000 ? `${Math.round(ms / 3_600_000)} uur` : `${Math.round(ms / 60_000)} min`);

// ── De keten ──────────────────────────────────────────────────────────────────
// Eén definitie, voor de keten zelf én voor wie hem moet tonen of volgen: het dashboard las de
// namen eerder uit een eigen lijst ("Groq 70B", "Groq 8B-instant") terwijl de keten allang op
// gpt-oss-120b/20b draaide, en kroket-van-de-dag en de trivia riepen Gemini en Groq buiten de
// keten om aan — zonder cooldowns, zonder bank, zonder telling op de LLM-meter.
//
// Slimme modellen eerst, allemaal gratis tiers. Volgorde:
// Gemini 2.5 Flash → Cerebras gpt-oss-120b → SambaNova Llama-3.3-70B → Groq gpt-oss-120b
// → Cloudflare Llama-3.3-70B → OpenRouter → Groq gpt-oss-20b (laatste redmiddel, eigen quota-bucket).
// SambaNova en Cloudflare zijn extra gratis dag-buckets (juni 2026) — env-gated, dus inert
// tot hun keys in .env staan: SAMBANOVA_API_KEY resp. CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
// Elke schakel is env-gated: zonder API-key wordt hij eruit gefilterd, zodat de laatste
// schakel altijd echt beschikbaar is. Model-ID's zijn overschrijfbaar via env i.v.m. churn.
const PROVIDER_NAMEN = {
  gemini: 'Gemini', cerebras: 'Cerebras', sambanova: 'SambaNova', groq: 'Groq',
  cloudflare: 'Cloudflare', openrouter: 'OpenRouter',
};

// "Groq gpt-oss-120b", "Cloudflare llama-3.3-70b-instruct-fp8-fast": de naam die de keten écht
// gebruikt, zonder de organisatie-prefix die alleen ruimte kost op het dashboard.
function ketenLabel(provider, naam) {
  return `${PROVIDER_NAMEN[provider] || provider} ${String(naam).replace(/^.*\//, '')}`;
}

function ketenDefinitie(maxTokens = 400) {
  return [
    {
      provider: 'gemini',
      naam: 'gemini-2.5-flash',
      temp: 1.1,
      tokens: maxTokens,
      tier: 'zwaar',
      budget: 120_000,
      beschikbaar: geminiKeys().length > 0,
      // Een 503 ("model overloaded") geldt voor heel gemini-2.5-flash: even uit de keten in plaats
      // van elk volgend bericht opnieuw te laten wachten op dezelfde overbelaste server.
      overbelastMs: 45_000,
    },
    {
      provider: 'cerebras',
      naam: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
      temp: 1.0,
      tokens: maxTokens,
      tier: 'zwaar',
      budget: 60_000,
      beschikbaar: !!process.env.CEREBRAS_API_KEY,
    },
    {
      // SambaNova Cloud: snel Llama-3.3-70B op een eigen gratis dag-bucket. Slim werkpaard,
      // tier 'middel' zodat ook lichte taken hierop kunnen vallen (spreidt de last).
      provider: 'sambanova',
      naam: process.env.SAMBANOVA_MODEL || 'Meta-Llama-3.3-70B-Instruct',
      temp: 1.1,
      tokens: maxTokens,
      tier: 'middel',
      budget: 16_000,
      beschikbaar: !!process.env.SAMBANOVA_API_KEY,
    },
    {
      // Model uit de omgeving, want Groq ruimt op: llama-3.3-70b-versatile én llama-3.1-8b-instant zijn
      // beide zonder aankondiging verdwenen (404 model_not_found), waardoor deze schakel én het laatste
      // redmiddel hieronder allebei stilvielen. Dat kostte elk bericht twee nutteloze calls, en het
      // visioen viel volledig om omdat de prompt-bouwer op dit model stond. Nooit meer een deploy voor
      // een modelnaam. Actuele lijst: GET https://api.groq.com/openai/v1/models.
      provider: 'groq',
      naam: GROQ_SLIM,
      temp: 1.2,
      tokens: maxTokens,
      tier: 'middel',
      // Groq weigert elk verzoek boven zijn 8.000 tokens per minuut met een 413, output-budget
      // (max_tokens + denk-tokens) inbegrepen.
      budget: 8_000,
      beschikbaar: !!process.env.GROQ_API_KEY,
    },
    {
      // Cloudflare Workers AI: 10.000 neurons/dag gratis, eigen infra/bucket. Gate op account-ID
      // én token (account-ID zit in de URL). Llama-3.3-70B fp8-fast.
      provider: 'cloudflare',
      naam: process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      temp: 1.1,
      tokens: maxTokens,
      tier: 'middel',
      budget: 24_000,
      beschikbaar: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    },
    {
      provider: 'openrouter',
      naam: process.env.OPENROUTER_MODEL || 'openrouter/free',
      temp: 1.0,
      tokens: maxTokens,
      tier: 'middel',
      budget: 30_000,
      beschikbaar: !!process.env.OPENROUTER_API_KEY,
    },
    {
      // Laatste redmiddel: kleiner maar robuust. Groq's rate limits zijn PER MODEL, dus dit kleine model
      // heeft een eigen dag-quota los van het grote hierboven — als álle slimme modellen op zijn is deze
      // vaak nog beschikbaar. Liever een simpel antwoord dan de statische "spoedberaad".
      // Ook hier uit de omgeving: dit was llama-3.1-8b-instant, en dat model bestaat niet meer.
      provider: 'groq',
      naam: GROQ_LICHT,
      temp: 1.15,
      tokens: maxTokens,
      tier: 'licht',
      budget: 8_000,
      beschikbaar: !!process.env.GROQ_API_KEY,
    },
  ].map(m => ({ ...m, label: ketenLabel(m.provider, m.naam), cooldownKey: `${m.provider}:${m.naam}` }));
}

// Niveau bepaalt welke modellen meedoen, zodat simpele taken de schaarse slimme quota niet opmaken:
//   'slim'  (default) → volledige keten, beste kwaliteit (gespreksreacties, vonnissen, comebacks).
//   'licht'           → sla de zware/schaarse modellen (Gemini, Cerebras) over; gebruik alleen de
//                       lichtere modellen voor formulematige taken (zegens, begroetingen, bevestigingen).
// Elk model heeft een `tier`: 'zwaar' = slim+schaars, 'middel' = degelijk, 'licht' = snel+dom.
// Telt succesvolle LLM-calls per provider per dag (voor de dashboard-kostenmeter).
// Bewaart de laatste 14 dagen in llmstats.json.
function telLlmCall(provider) {
  try {
    const data = readJSON('llmstats.json', { dagen: {} });
    const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
    if (!data.dagen[vandaag]) data.dagen[vandaag] = {};
    data.dagen[vandaag][provider] = (data.dagen[vandaag][provider] || 0) + 1;
    const sleutels = Object.keys(data.dagen).sort();
    while (sleutels.length > 14) delete data.dagen[sleutels.shift()];
    writeJSON('llmstats.json', data);
  } catch (_) {}
}

// Het tokenbudget per schakel: zie lib/promptbudget.js. `budget` in de ketendefinitie is het
// maximum per verzoek (invoer plus output-budget). Een verzoek dat niet past wordt vóór verzending
// gekrompen — eerst de stijlvoorbeelden en andere inkortbare blokken, dan oude gespreksbeurten —
// in plaats van het naar een 413 te sturen. De gekrompen versie geldt alleen voor DIE schakel.
function passendVoor(model, berichten, maxTokens) {
  const uitvoerTokens = maxTokens + (isRedeneermodel(model.provider, model.naam) ? REDENEER_HEADROOM : 0);
  const { berichten: passend, stappen } = pasInBudget(berichten, { budget: model.budget, uitvoerTokens });
  if (stappen.length) console.log(`✂️ ${model.label}: prompt ingekort voor ${model.budget} tokens (${stappen.join(', ')}).`);
  return passend;
}

// `opties.temperatuur` overschrijft de temperatuur van ELK model in de keten. Nodig voor
// classificatie: de modellen staan hier op 1.0-1.2 omdat ze proza moeten schrijven, maar een
// ja/nee-vraag hoort deterministisch te zijn. Zonder deze knop moest elke classifier buiten de
// keten om rechtstreeks één provider aanroepen — "Groq of niks", zonder terugval en ongeteld
// op de LLM-meter.
// `opties.keurKarakter: false` slaat de karakterkeuring over. Voor een CLASSIFICATIE hoort die
// niet te draaien: isHoofdletterSpam slaat aan op dertig tekens met >65% hoofdletters, en een
// classifier die netjes "BELEDIGING EN BEDELARIJ" antwoordt zou dan worden weggegooid en
// vervangen door een Kroket God-zin — die de aanroeper vervolgens niet als klasse kan lezen.
async function _draaiModellen(berichten, maxTokens = 400, niveau = 'slim', opties = {}) {
  // Spaarstand (dashboard): forceer het lichte niveau zodat Gemini/Cerebras gespaard worden.
  if (niveau === 'slim' && instelling('spaarstand')) niveau = 'licht';
  const modellen = ketenDefinitie(maxTokens)
    // Lichte taken slaan de schaarse zware modellen (Gemini/Cerebras) over en gebruiken alleen
    // de lichtere schakels. GROQ_API_KEY is verplicht, dus er blijft altijd minstens Groq over.
    .filter(m => niveau === 'slim' || m.tier !== 'zwaar')
    .filter(m => m.beschikbaar);

  // Provider aan/uit (dashboard): filter handmatig uitgezette modellen, maar NOOIT alles — als de
  // selectie leeg zou worden, negeer de uit-lijst (er moet altijd een werkend model overblijven).
  const uit = instelling('providerUit') || [];
  if (uit.length) {
    const gefilterd = modellen.filter(m => !uit.includes(m.provider));
    if (gefilterd.length > 0) {
      modellen.length = 0;
      modellen.push(...gefilterd);
    }
  }

  // Globale deadline: één bericht mag nooit eindeloos alle providers aflopen (anders stapelen
  // trage requests op en wordt de bot onbereikbaar). Na KETEN_DEADLINE_MS stoppen we met nieuwe
  // schakels en vallen we terug op de statische fallback — behalve de laatste (snelle, goedkope)
  // schakel, die proberen we altijd nog één keer.
  const KETEN_DEADLINE_MS = 35_000;
  // `opties.deadlineMs` kort de keten in voor aanroepers die niet kunnen wachten. Een
  // classificatie is een ja/nee-vraag waar een mention-handler op staat te wachten; die mag geen
  // halve minuut alle providers aflopen. Zonder deze knop liep het slechtste geval op tot ~100s,
  // omdat een tweede poging een VERSE keten-deadline kreeg bovenop de eerste.
  const deadline = Date.now() + (Number(opties.deadlineMs) > 0 ? Number(opties.deadlineMs) : KETEN_DEADLINE_MS);

  let laatsteFout;
  for (let i = 0; i < modellen.length; i++) {
    const model = modellen[i];
    const isLaatsteModel = i === modellen.length - 1;
    // Sla een net-ge429'de of gebankte schakel over (behalve de laatste — die proberen we altijd).
    // Cooldown-key per provider+model: Groq's limits zijn per MODEL, dus een 429 op
    // gpt-oss-20b mag gpt-oss-120b niet buitenspel zetten.
    const { cooldownKey } = model;
    if (!isLaatsteModel && (Date.now() < (providerCooldownTot.get(cooldownKey) || 0) || isGebankt(cooldownKey))) {
      continue;
    }
    // Deadline overschreden? Sla resterende schakels over (behalve de laatste) en bail naar fallback.
    if (!isLaatsteModel && Date.now() > deadline) {
      console.warn('⚠️ Keten-deadline overschreden — stop met verdere providers, fallback.');
      continue;
    }
    // Verwerk één respons: geef de inhoud terug, of het NEXT-symbool als de keten naar het
    // volgende model moet (uit-karakter op een niet-laatste schakel). Gooit nooit zelf.
    const NEXT = Symbol('next');
    const afhandelen = (laatste) => {
      const keuze = laatste.choices[0];
      let inhoud = keuze.message?.content;
      // Afgekapt op de tokenlimiet? Knip terug tot de laatste volledige zin i.p.v. een halve zin
      // door te sturen. Het vangnet voor als de extra tokenruimte (headroom/retry) nog niet volstond.
      if (keuze.finish_reason === 'length') {
        console.warn(`⚠️ Afgeknopt (${model.naam}) — kap af op laatste volledige zin.`);
        inhoud = kapAfOpZinsgrens(inhoud);
      }
      // Lege of null-content (bv. Gemini die zijn hele budget aan denken opmaakt) is GEEN geldig
      // antwoord — zonder deze check crasht schoonOutput er later op (tekst.replace op null).
      if (!inhoud || !String(inhoud).trim()) {
        console.warn(`⚠️ Lege respons (${model.naam}) — ${isLaatsteModel ? 'statische fallback' : 'volgend model'}.`);
        if (!isLaatsteModel) return NEXT;
        return KARAKTER_FALLBACK[Math.floor(Math.random() * KARAKTER_FALLBACK.length)];
      }
      if (isRijksgrensOvertreding(inhoud)) {
        console.warn(`⚠️ Rijksgrens overschreden (${model.naam}) — rijksfallback.`);
        return RIJKSGRENS_FALLBACK[Math.floor(Math.random() * RIJKSGRENS_FALLBACK.length)];
      }
      if (opties.keurKarakter !== false && isUitKarakter(inhoud)) {
        console.warn(`⚠️ Uit-karakter respons gedetecteerd (${model.naam}) — ${isLaatsteModel ? 'statisch fallback' : 'volgend model'}.`);
        if (!isLaatsteModel) return NEXT;
        return KARAKTER_FALLBACK[Math.floor(Math.random() * KARAKTER_FALLBACK.length)];
      }
      if (i > 0) console.log(`✓ Antwoord via fallback: ${model.naam}`);
      telLlmCall(model.provider);
      return inhoud;
    };

    // Wat deze aanroep mag kosten: wat er van de deadline over is (de laatste schakel krijgt
    // altijd nog een minimum, want die wordt ook ná de deadline geprobeerd).
    const tijdOver = () => {
      const rest = deadline - Date.now();
      return isLaatsteModel ? Math.max(rest, LAATSTE_SCHAKEL_MIN_MS) : rest;
    };

    try {
      let laatste = await roepModelAan(model.provider, { model: model.naam, max_tokens: model.tokens, temperature: opties.temperatuur ?? model.temp, messages: passendVoor(model, berichten, model.tokens) }, { timeoutMs: tijdOver() });
      // Hij antwoordt: van de bank af (als hij erop stond) en de straftrap terug op nul.
      geefVrij(cooldownKey);
      // Afkapping (finish_reason 'length') op een niet-laatste schakel: een halve zin is nooit
      // goed, dus probeer één keer opnieuw met meer tokenruimte. Alleen de allerlaatste
      // (nood)schakel laten we ongemoeid — daar accepteren we liever een korter antwoord dan het
      // risico op de krappe TPM-limiet van dat model.
      if (!isLaatsteModel && laatste.choices[0].finish_reason === 'length' && Date.now() < deadline) {
        try {
          const ruimerTokens = Math.round(model.tokens * 1.6);
          const ruimer = await roepModelAan(model.provider, { model: model.naam, max_tokens: ruimerTokens, temperature: opties.temperatuur ?? model.temp, messages: passendVoor(model, berichten, ruimerTokens) }, { timeoutMs: tijdOver() });
          laatste = ruimer;
        } catch (_) {
          // Retry mislukt — ga door met het (mogelijk afgekapte) eerste antwoord.
        }
      }
      const r = afhandelen(laatste);
      if (r !== NEXT) return r;
      continue; // uit-karakter op niet-laatste model → volgend model
    } catch (error) {
      laatsteFout = error;
      // Bij rate limit (429): zet deze provider even in cooldown zodat de keten hem overslaat.
      if (error?.status === 429) providerCooldownTot.set(cooldownKey, Date.now() + PROVIDER_COOLDOWN_MS);
      // Overbelaste server (Gemini 503): kort uit de keten, voor alle sleutels tegelijk.
      if (error?.overbelast && model.overbelastMs) providerCooldownTot.set(cooldownKey, Date.now() + model.overbelastMs);
      // Stuk in plaats van druk: op de persistente bank, en één keer luid loggen zodat het opvalt
      // in plaats van weg te zakken tussen de gewone fallback-waarschuwingen.
      if (STUK_STATUSSEN.has(error?.status)) {
        const { nieuw, tot, trap } = bankStuk(cooldownKey, { status: error.status, reden: STUK_UITLEG[error.status], label: model.label });
        if (nieuw) {
          console.warn(`🚫 ${model.provider}/${model.naam} gaf ${error.status} — ${duurTekst(tot - Date.now())} uit de keten ` +
            `(trap ${trap}/${BANK_TRAPPEN_MS.length}). ${STUK_UITLEG[error.status]}`);
        }
      }
      // 413 ondanks het budget: de schatting (tekens/3,5) zat te ruim, bv. bij een dichte lijst
      // die slecht tokeniseert. Eén keer opnieuw met 70% van het budget — een 413 wordt geweigerd
      // vóór er quotum verbruikt is, dus die herkansing kost niets.
      if (error?.status === 413) {
        try {
          console.warn(`⚠️ 413 bij ${model.label} — opnieuw met een krapper budget.`);
          const krap = { ...model, budget: Math.floor(model.budget * 0.7) };
          const laatste = await roepModelAan(model.provider, { model: model.naam, max_tokens: model.tokens, temperature: opties.temperatuur ?? model.temp, messages: passendVoor(krap, berichten, model.tokens) }, { timeoutMs: tijdOver() });
          const r = afhandelen(laatste);
          if (r !== NEXT) return r;
          continue;
        } catch (e2) {
          laatsteFout = e2;
        }
      }
      if (!isLaatsteModel) {
        // Altijd doorgaan naar het volgende model — rate limits, netwerk, timeouts, alles
        console.warn(`⚠️ ${model.naam} faalde (${error?.status || error?.message || 'onbekend'}), fallback naar volgende model.`);
        continue;
      }
      throw laatsteFout;
    }
  }
  throw laatsteFout;
}

module.exports = {
  groq,
  GROQ_SLIM,
  GROQ_LICHT,
  geminiKeys,
  callGemini,
  callOpenAICompat,
  roepModelAan,
  telLlmCall,
  _draaiModellen,
  ketenDefinitie,
  providerCooldownTot,
  STUK_STATUSSEN,
  geminiKeyCooldownTot,
  geminiSleutelVrijOp,
  REDENEER_HEADROOM,
};
