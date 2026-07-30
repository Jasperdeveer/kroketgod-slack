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

// Per-key cooldown: een sleutel die 429 (quota/rate-limit) geeft slaan we even over, zodat we niet
// elk bericht opnieuw twee dode round-trips naar Google maken voordat we bij een werkende key zijn.
// Korte window: is het 'm een dag-quota, dan kost dat hooguit één probe per window; is het een
// tijdelijke rate-limit, dan komt de key vanzelf snel weer in de rotatie.
const geminiKeyCooldownTot = new Map();

const GEMINI_KEY_COOLDOWN_MS = 5 * 60_000;

async function callGemini({ model, messages, max_tokens, temperature }) {
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
  const teProberen = keys.filter(key => (geminiKeyCooldownTot.get(key) || 0) <= nu);
  if (teProberen.length === 0) {
    const err = new Error('Alle Gemini-keys in cooldown (dag-quota op) — Gemini overgeslagen');
    err.status = 429; err.skip = true;
    throw err;
  }

  let laatsteFout;
  // Roteer over de keys: bij rate limit/quota (429) of serverfout (5xx) de volgende key proberen.
  for (let i = 0; i < teProberen.length; i++) {
    const key = teProberen[i];
    const nr = keys.indexOf(key) + 1; // origineel sleutelnummer, voor herkenbare logging
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
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
      // Korte timeout: een gratis-tier Gemini die binnen 15s niets teruggeeft komt niet meer;
      // liever doorrouteren dan per key 60s blokkeren (× keys = minuten → bot onbereikbaar).
      timeout: 15000,
    });
    if (response.ok) {
      geminiKeyCooldownTot.delete(key); // weer gezond → uit cooldown halen
      if (nr > 1) console.log(`✓ Gemini via reservesleutel #${nr}`);
      return await response.json();
    }
    const errorText = await response.text();
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
    }
    // Alleen doorrouteren naar de volgende key bij quota/rate-limit of tijdelijke serverfout.
    const roteerbaar = response.status === 429 || response.status >= 500;
    if (!roteerbaar || i === teProberen.length - 1) throw laatsteFout;
    console.warn(`⚠️ Gemini-sleutel #${nr} gaf ${response.status} — volgende sleutel proberen.`);
  }
  throw laatsteFout;
}

// Generieke caller voor elke OpenAI-compatibele chat-completions API (Cerebras, OpenRouter, ...).
// Gate op de API-key: ontbreekt die, dan skip (de fallbackketen gaat door naar het volgende model).
async function callOpenAICompat({ url, apiKey, envNaam, body }) {
  if (!apiKey) {
    const err = new Error(`${envNaam} niet geconfigureerd`);
    err.status = 0; err.skip = true;
    throw err;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    // Korte timeout: trage gratis providers (bv. overbelaste OpenRouter-modellen) mogen de
    // keten niet 60s blokkeren — liever snel doorvallen naar het volgende model.
    timeout: 20000,
  });
  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`${envNaam} ${response.status}: ${errorText.substring(0, 200)}`);
    err.status = response.status;
    throw err;
  }
  return await response.json();
}

// Dispatcht één chat-completion naar de juiste provider. Alle providers zijn OpenAI-compatibel,
// dus `opts` ({ model, messages, max_tokens, temperature }) gaat ongewijzigd door.
async function roepModelAan(provider, opts) {
  switch (provider) {
    case 'gemini':   return callGemini(opts);
    case 'groq':     return groq.chat.completions.create(opts);
    case 'cerebras': return callOpenAICompat({
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
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY, envNaam: 'OPENROUTER_API_KEY', body: opts,
    });
    case 'sambanova': return callOpenAICompat({
      url: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY, envNaam: 'SAMBANOVA_API_KEY', body: opts,
    });
    case 'cloudflare': return callOpenAICompat({
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

// Laatste-redmiddel-krimp: voor een 413 ("request too large") op de slotschakel. Het noodmodel
// (Groq 8b) heeft een krappe TPM-limiet die één grote prompt al overschrijdt. Gooi de
// gespreksgeschiedenis weg (alleen system + laatste user-turn) en kap te lange inhoud hard af,
// zodat het verzoek zeker past. Liever een schraal antwoord dan de statische fallback.
const KRIMP_SYSTEM_MAX = 9000; // chars (~2250 tok)

const KRIMP_USER_MAX = 4000;   // chars (~1000 tok)

function krimpBerichten(berichten) {
  if (!Array.isArray(berichten) || !berichten.length) return null;
  const system = berichten.find(b => b.role === 'system');
  const laatsteUser = [...berichten].reverse().find(b => b.role === 'user');
  if (!laatsteUser) return null;
  const knip = (s, max) => (s && s.length > max ? `${s.slice(0, max)}\n…` : s);
  const nieuw = [];
  if (system) nieuw.push({ ...system, content: knip(system.content, KRIMP_SYSTEM_MAX) });
  if (laatsteUser !== system) nieuw.push({ ...laatsteUser, content: knip(laatsteUser.content, KRIMP_USER_MAX) });
  const orig = berichten.reduce((n, b) => n + (b.content?.length || 0), 0);
  const na = nieuw.reduce((n, b) => n + (b.content?.length || 0), 0);
  return na < orig ? nieuw : null; // geen winst → niet proberen
}

async function _draaiModellen(berichten, maxTokens = 400, niveau = 'slim') {
  // Spaarstand (dashboard): forceer het lichte niveau zodat Gemini/Cerebras gespaard worden.
  if (niveau === 'slim' && instelling('spaarstand')) niveau = 'licht';
  // Slimme modellen eerst, allemaal gratis tiers. Volgorde:
  // Gemini 2.5 Flash → Cerebras → SambaNova 70B → Groq 70B → Cloudflare 70B → OpenRouter
  // → Groq 8B-instant (dom laatste redmiddel, eigen quota-bucket).
  // SambaNova en Cloudflare zijn extra gratis dag-buckets (juni 2026) — env-gated, dus inert
  // tot hun keys in .env staan: SAMBANOVA_API_KEY resp. CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
  // Elke schakel is env-gated: zonder API-key wordt hij eruit gefilterd, zodat de laatste
  // schakel altijd echt beschikbaar is. Model-ID's zijn overschrijfbaar via env i.v.m. churn.
  const modellen = [
    {
      provider: 'gemini',
      naam: 'gemini-2.5-flash',
      temp: 1.1,
      tokens: maxTokens,
      tier: 'zwaar',
      beschikbaar: geminiKeys().length > 0,
    },
    {
      provider: 'cerebras',
      naam: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
      temp: 1.0,
      tokens: maxTokens,
      tier: 'zwaar',
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
      beschikbaar: !!process.env.SAMBANOVA_API_KEY,
    },
    {
      provider: 'groq',
      naam: 'llama-3.3-70b-versatile',
      temp: 1.2,
      tokens: maxTokens,
      tier: 'middel',
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
      beschikbaar: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    },
    {
      provider: 'openrouter',
      naam: process.env.OPENROUTER_MODEL || 'openrouter/free',
      temp: 1.0,
      tokens: maxTokens,
      tier: 'middel',
      beschikbaar: !!process.env.OPENROUTER_API_KEY,
    },
    {
      // Laatste redmiddel: dommer maar robuust. Groq's rate limits zijn PER MODEL, dus 8b-instant
      // heeft een eigen dag-quota los van de 70b hierboven — als álle slimme modellen op zijn is
      // deze vaak nog beschikbaar. Liever een simpel antwoord dan de statische "spoedberaad".
      provider: 'groq',
      naam: 'llama-3.1-8b-instant',
      temp: 1.15,
      tokens: maxTokens,
      tier: 'licht',
      beschikbaar: !!process.env.GROQ_API_KEY,
    },
  ]
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
  const deadline = Date.now() + KETEN_DEADLINE_MS;

  let laatsteFout;
  for (let i = 0; i < modellen.length; i++) {
    const model = modellen[i];
    const isLaatsteModel = i === modellen.length - 1;
    // Sla een net-ge429'de schakel over (behalve de laatste — die proberen we altijd).
    // Cooldown-key per provider+model: Groq's limits zijn per MODEL, dus een 429 op
    // 8b-instant mag de 70b niet buitenspel zetten.
    const cooldownKey = `${model.provider}:${model.naam}`;
    if (!isLaatsteModel && Date.now() < (providerCooldownTot.get(cooldownKey) || 0)) {
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
      if (isUitKarakter(inhoud)) {
        console.warn(`⚠️ Uit-karakter respons gedetecteerd (${model.naam}) — ${isLaatsteModel ? 'statisch fallback' : 'volgend model'}.`);
        if (!isLaatsteModel) return NEXT;
        return KARAKTER_FALLBACK[Math.floor(Math.random() * KARAKTER_FALLBACK.length)];
      }
      if (i > 0) console.log(`✓ Antwoord via fallback: ${model.naam}`);
      telLlmCall(model.provider);
      return inhoud;
    };

    try {
      let laatste = await roepModelAan(model.provider, { model: model.naam, max_tokens: model.tokens, temperature: model.temp, messages: berichten });
      // Afkapping (finish_reason 'length') op een niet-laatste schakel: een halve zin is nooit
      // goed, dus probeer één keer opnieuw met meer tokenruimte. Alleen de allerlaatste
      // (nood)schakel laten we ongemoeid — daar accepteren we liever een korter antwoord dan het
      // risico op de krappe TPM-limiet van dat model.
      if (!isLaatsteModel && laatste.choices[0].finish_reason === 'length' && Date.now() < deadline) {
        try {
          const ruimer = await roepModelAan(model.provider, { model: model.naam, max_tokens: Math.round(model.tokens * 1.6), temperature: model.temp, messages: berichten });
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
      // 413 op de slotschakel: het verzoek is te groot voor het noodmodel. Probeer één keer met
      // een ingekorte payload i.p.v. meteen naar de statische fallback te vallen.
      if (error?.status === 413 && isLaatsteModel) {
        const krimp = krimpBerichten(berichten);
        if (krimp) {
          try {
            console.warn(`⚠️ 413 op slotschakel (${model.naam}) — retry met ingekorte payload.`);
            const laatste = await roepModelAan(model.provider, { model: model.naam, max_tokens: Math.min(model.tokens, 300), temperature: model.temp, messages: krimp });
            const r = afhandelen(laatste);
            if (r !== NEXT) return r;
          } catch (e2) {
            laatsteFout = e2;
          }
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
  geminiKeys,
  callGemini,
  callOpenAICompat,
  roepModelAan,
  telLlmCall,
  krimpBerichten,
  _draaiModellen,
  providerCooldownTot,
  geminiKeyCooldownTot,
  REDENEER_HEADROOM,
};
