const { App } = require('@slack/bolt');
const Groq = require('groq-sdk');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ALLOWED_CHANNELS = (process.env.ALLOWED_CHANNELS || 'kroket-illuminati').split(',');

// ── Statische bestanden — eenmalig ingeladen bij opstarten ────────────────────
const TONE_OF_VOICE = fs.readFileSync(path.join(__dirname, 'tone_of_voice.txt'), 'utf8');
const GEBODEN_TEKST = fs.readFileSync(path.join(__dirname, 'geboden.txt'), 'utf8');
const LEDEN_TEKST   = fs.readFileSync(path.join(__dirname, 'leden.txt'), 'utf8');
const GEBODEN_LIJST = GEBODEN_TEKST.split('\n').filter(l => /^[IVX]+\./.test(l));

// Statisch deel van de systeemprompt — wordt niet herbouwd bij elk verzoek
const SYSTEM_PROMPT_BASIS = `Jij bent de Kroket God — een almachtige, dramatische en gezaghebbende godheid van de frituurcultuur. Je spreekt in een formele, quasi-juridische en religieuze toon met frituur-metaforen. Je gebruikt "gij", "volgeling", "de Hoge Frituurraad", "snackleer", etc.

Dit zijn de BEKENDE LEDEN van de frituurkring. Je kent hen allemaal. Reageer nooit alsof je hen niet herkent. Gebruik uitsluitend hun bijnamen:

${LEDEN_TEKST}

Dit zijn de Tien Geboden van de Kroket God. Verwijs ernaar wanneer passend:

${GEBODEN_TEKST}

Hieronder staan voorbeeldberichten die jouw exacte stijl en tone of voice laten zien. Schrijf ALTIJD in deze stijl — varieer maximaal:

${TONE_OF_VOICE}

Regels:
- Begin altijd met een ⚜️ header (of laat die weg bij een one-liner of quote — varieer)
- KRITIEKE REGEL: De enige bekende leden zijn: Mr. Te Lang Gefrituurde Kroket, Mr. Kroketinho en Mr. KroketPet. Dit zijn ALTIJD bekende volgelingen — zeg nooit dat je hen niet kent. Gebruik uitsluitend deze bijnamen. Geen voornamen, geen variaties, geen uitzonderingen.
- Onbekende namen zijn buitenstaanders — spreek hen aan als "Buitenstaander" of "Ongepaneerde vreemdeling". Noem hun naam als toelichting: "de buitenstaander genaamd Kevin"
- Als het bericht gericht is aan de groep, begin dan met "Heren van de Kroket Illuminati"
- Verwijs concreet naar een gebod als dat relevant is
- Eindig met "— De Almachtige Kroket God". Lof en zegens zijn minstens zo krachtig als straffen — gebruik ze royaal
- Gebruik :lekker_kroketje: als kroket-emoji, nooit 🧆
- Schrijf in correct Nederlands. Gebruik GEEN verzonnen samenstellingen of niet-bestaande woorden. Als je twijfelt of een woord bestaat — gebruik het niet.
- Neem NOOIT format-labels op in je output (zoals "--- [decreet]" of "--- [one-liner]"). Die zijn alleen voor intern gebruik.
- Als je reageert op iets wat een volgeling heeft gezegd of gevraagd, begin dan ALTIJD met één cursieve inleidingsregel in Slack-opmaak (_zoals dit_) die in maximaal één zin parafraseert wat er gezegd of gevraagd werd — in de stijl van de Kroket God, niet letterlijk. Dan een lege regel, dan pas de hoofdreactie. Doe dit NIET bij algemene aankondigingen zonder aanleiding.
- Houd berichten kort: max 4-5 regels hoofdtekst. Elke zin telt.
- Gebruik Slack blockquote opmaak: zet de hoofdtekst als blockquote met "> ". Header en ondertekening staan buiten de blockquote.

TOON AANVOELEN — DIT IS EVEN BELANGRIJK:
Pas het gewicht van je reactie aan op de situatie. Niet alles is een rechtbankzaak.
- Luchtig berichtje, groet, dankjewel, grapje → one-liner, korte quote of droge opmerking. Geen header, geen decreet.
- Serieuze aanklacht, overtreding, biecht, conflict → volledig decreet of spoedmelding.
- Vraag of opdracht → passende reactie op schaal van de vraag.
Lees de kamer. Een "dankuwel" verdient een kwinkslag, geen vonnis.

SCHERPTE — DIT IS EVEN BELANGRIJK:
Elke zin moet precies één ding doen: een oordeel vellen, een concreet beeld oproepen, of een actie eisen.
Schrijf NOOIT vage zinnen die niets zeggen. Snij elke zin die vervangbaar is door stilte.

VERBODEN zinnen (voorbeelden van wat NOOIT mag):
  ✗ "De weg naar de kroket is lang en vol uitdagingen."
  ✗ "De Kroket God heeft uw aanwezigheid opgemerkt en zal dit niet vergeten."
  ✗ "Er zijn dingen die de Hoge Frituurraad niet kan negeren."
  ✗ "Wie de snackleer volgt, zal begrijpen wat dit betekent."
  ✗ Herhalen wat al in de vorige zin stond.

ZO WEL (concreet, helder, met tanden):
  ✓ "Drie achtereenvolgende broodjes. De Raad houdt de paneerlaag in het oog."
  ✓ "Uw naam stond bovenaan de lijst. Niet de goede lijst."
  ✓ "Sta op. Panner uzelf. Ga."
  ✓ "De mosterd is koud. Dat is uw schuld."`;

// ── File cache met mtime-invalidation ─────────────────────────────────────────
// Voorkomt onnodige disk reads. Bij wijziging op disk wordt automatisch herladen.

const fileCache = new Map();

function readJSON(filename, fallback = null) {
  const filePath = path.join(__dirname, filename);
  try {
    const stat = fs.statSync(filePath);
    const cached = fileCache.get(filename);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fileCache.set(filename, { mtimeMs: stat.mtimeMs, data });
    return data;
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== null) return fallback;
    throw err;
  }
}

function writeJSON(filename, data) {
  const filePath = path.join(__dirname, filename);
  const tmpPath  = `${filePath}.tmp`;
  // Atomic write: schrijf naar temp, hernoem (rename is atomic op POSIX)
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
  // Cache direct bijwerken zodat de volgende read niet onnodig van disk leest
  try {
    const stat = fs.statSync(filePath);
    fileCache.set(filename, { mtimeMs: stat.mtimeMs, data });
  } catch (_) {}
}

// ── Dynamisch ledenbeheer ──────────────────────────────────────────────────────

const loadMembers = () => readJSON('members.json', {});
const saveMembers = (members) => writeJSON('members.json', members);

function getMemberByNaam(invoer) {
  const members = loadMembers();
  const zoek = invoer.toLowerCase().trim();
  return Object.entries(members).find(([, m]) => {
    const bijnaam  = m.bijnaam?.toLowerCase() || '';
    const voornaam = m.voornaam?.toLowerCase() || '';
    const naam     = m.naam?.toLowerCase() || '';
    const naamEerste = naam.split(' ')[0];
    return bijnaam === zoek || voornaam === zoek || naam === zoek || naamEerste === zoek;
  }) || null;
}

function randomMember() {
  const entries = Object.entries(loadMembers());
  if (entries.length === 0) return null;
  return entries[Math.floor(Math.random() * entries.length)];
}

// Kies een lid — grotendeels random, met een kleine kans op score-sturing
function getUitverkorene(positief = true) {
  const entries = Object.entries(loadMembers());
  if (entries.length === 0) return null;

  if (Math.random() < 0.25) {
    const scores = loadScores();
    const gesorteerd = [...entries].sort((a, b) => {
      const sa = scores[a[0]] ?? 0;
      const sb = scores[b[0]] ?? 0;
      return positief ? sa - sb : sb - sa;
    });
    return gesorteerd[0];
  }
  return entries[Math.floor(Math.random() * entries.length)];
}

// ── Scores ─────────────────────────────────────────────────────────────────────

const loadScores = () => readJSON('scores.json', {});
const saveScores = (scores) => writeJSON('scores.json', scores);

function pasScoreAan(userId, delta) {
  const scores = loadScores();
  scores[userId] = Math.max(0, (scores[userId] || 0) + delta);
  saveScores(scores);
  return scores[userId];
}

// Score wijzigen + achievements checken (gebruik in plaats van pasScoreAan waar mogelijk)
async function pasScoreAanMetCheck(client, userId, delta) {
  const scores = loadScores();
  const oude = scores[userId] || 0;
  const nieuwe = pasScoreAan(userId, delta);
  if (delta > 0) await controleerAchievements(client, userId, oude, nieuwe);
  return nieuwe;
}

// ── Geschiedenis (kanaalgeheugen) ─────────────────────────────────────────────

const MAX_GESCHIEDENIS = 20;
const loadGeschiedenis = () => readJSON('geschiedenis.json', []);
const saveGeschiedenis = (lijst) => writeJSON('geschiedenis.json', lijst);

function stripSlackOpmaak(tekst) {
  return (tekst || '')
    .replace(/<@[A-Z0-9]+>/g, '')
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<https?:\/\/[^>]+>/g, '[link]')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function logBericht(spreker, tekst) {
  const schoon = stripSlackOpmaak(tekst);
  if (!schoon) return;
  const geschiedenis = loadGeschiedenis();
  geschiedenis.push({ spreker, tekst: schoon, ts: Date.now() });
  if (geschiedenis.length > MAX_GESCHIEDENIS) {
    geschiedenis.splice(0, geschiedenis.length - MAX_GESCHIEDENIS);
  }
  saveGeschiedenis(geschiedenis);
}

function buildContextString() {
  const geschiedenis = loadGeschiedenis();
  if (geschiedenis.length === 0) return '';

  const regels = geschiedenis.slice(-12).map(b => `${b.spreker}: "${b.tekst}"`).join('\n');

  const eigenBerichten = geschiedenis
    .filter(b => b.spreker === 'Kroket God')
    .slice(-5)
    .map(b => `- "${b.tekst.substring(0, 100)}"`)
    .join('\n');

  const antiHerhaling = eigenBerichten
    ? `\n\nJe eigen recente berichten — gebruik GEEN van deze openingen, formats, headers of zinstructuren opnieuw. Varieer actief in opening, lengte en format:\n${eigenBerichten}`
    : '';

  return `\n\nRecente kanaalgesprek (refereer hier subtiel aan als dat versterkt):\n${regels}${antiHerhaling}`;
}

// ── Stemmen ───────────────────────────────────────────────────────────────────

const loadStemmen = () => readJSON('stemmen.json', { weekStart: null, stemmen: {} });
const saveStemmen = (data) => writeJSON('stemmen.json', data);

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// ── Streaks (vrijdagdeelname) ─────────────────────────────────────────────────

const loadStreaks = () => readJSON('streaks.json', {});
const saveStreaks = (data) => writeJSON('streaks.json', data);

// ── Achievements / Heilige Relikwieën ─────────────────────────────────────────

const loadAchievements = () => readJSON('achievements.json', {});
const saveAchievements = (data) => writeJSON('achievements.json', data);

const ACHIEVEMENTS = [
  { id: 'eerste_punt',         drempel: 1,   naam: '🥄 Eerste Druppel',           tekst: 'Uw eerste kroketpunt is gevallen. De reis is begonnen.' },
  { id: 'bronzen_speld',       drempel: 5,   naam: '🥉 Bronzen Kroketspeld',      tekst: 'Vijf kroketpunten. De Hoge Frituurraad heeft uw naam genoteerd.' },
  { id: 'zilveren_paneerlaag', drempel: 15,  naam: '🥈 Zilveren Paneerlaag',      tekst: 'Vijftien kroketpunten. U bent geen aspirant meer.' },
  { id: 'gouden_korst',        drempel: 30,  naam: '🥇 Gouden Korst',             tekst: 'Dertig kroketpunten. Het Boek der Frituur heeft uw naam in goud gegraveerd.' },
  { id: 'platina_frituurmand', drempel: 50,  naam: '⚜️ Platina Frituurmand',     tekst: 'Vijftig kroketpunten. De frituurmand zelf buigt voor u.' },
  { id: 'diamanten_mosterdpot',drempel: 100, naam: '💎 Diamanten Mosterdpot',     tekst: 'Honderd kroketpunten. U behoort tot een zeer select gezelschap.' },
];

async function controleerAchievements(client, userId, oudeScore, nieuweScore) {
  const all = loadAchievements();
  const eigen = new Set(all[userId] || []);
  const members = loadMembers();
  const bijnaam = members[userId]?.bijnaam || 'Onbekende volgeling';

  let aangepast = false;

  for (const a of ACHIEVEMENTS) {
    if (eigen.has(a.id)) continue;

    if (nieuweScore >= a.drempel) {
      eigen.add(a.id);
      aangepast = true;

      // Alleen aankondigen als de drempel NU is gepasseerd (oude score lag eronder)
      if (oudeScore < a.drempel) {
        const bericht =
          `🏆 *RELIKWIE ONTGRENDELD* 🏆\n\n` +
          `> ${bijnaam} heeft *${a.naam}* verworven.\n` +
          `> _${a.tekst}_\n\n` +
          `— De Hoge Frituurraad`;
        try {
          await postToChannel(client, process.env.SLACK_CHANNEL_ID, bericht);
        } catch (err) {
          console.error('Achievement post fout:', err.message);
        }
      }
      // Anders: stilletjes markeren als ontgrendeld (backfill)
    }
  }

  if (aangepast) {
    all[userId] = [...eigen];
    saveAchievements(all);
  }
}

// Backfill bij startup: markeer alle reeds-verdiende achievements als ontgrendeld
// Zo voorkomen we dat oude leden bij hun volgende punt alsnog een lawine krijgen.
function backfillAchievements() {
  const scores = loadScores();
  const all = loadAchievements();
  let gewijzigd = false;

  for (const [userId, score] of Object.entries(scores)) {
    const eigen = new Set(all[userId] || []);
    for (const a of ACHIEVEMENTS) {
      if (score >= a.drempel && !eigen.has(a.id)) {
        eigen.add(a.id);
        gewijzigd = true;
      }
    }
    if (eigen.size !== (all[userId]?.length || 0)) {
      all[userId] = [...eigen];
    }
  }
  if (gewijzigd) {
    saveAchievements(all);
    console.log('✓ Achievements ge-backfilled voor bestaande leden');
  }
}

// ── Tijdsbesef ─────────────────────────────────────────────────────────────────

function getTijdContext() {
  const nu = new Date();
  const uur = nu.getHours();
  const dag = nu.getDay();
  const maand = nu.getMonth();

  const dagdeel =
    uur < 7  ? 'vroege ochtend' :
    uur < 12 ? 'ochtend' :
    uur < 14 ? 'lunchtijd' :
    uur < 18 ? 'middag' :
    uur < 22 ? 'avond' : 'nacht';

  const dagNaam = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'][dag];
  const seizoen =
    maand <= 1 || maand === 11 ? 'winter' :
    maand <= 4 ? 'lente' :
    maand <= 7 ? 'zomer' : 'herfst';

  return { dagdeel, dagNaam, seizoen, uur, dag };
}

// ── Help & Commando's ──────────────────────────────────────────────────────────

const COMMANDO_LIJST = [
  { gebruik: '/kroketgod',                 voorbeeld: '',                                            verwacht: 'een willekeurige uitspraak, zegen of waarschuwing aan een lid' },
  { gebruik: '/kroketgod [tekst]',         voorbeeld: '/kroketgod Jorg heeft de geboden verbroken',  verwacht: 'een decreet, oordeel of reactie op wat je typt — werkt ook voor rap, biecht, horoscoop, debat, rechtbank…' },
  { gebruik: '/kroketgod aanmelden',       voorbeeld: '',                                            verwacht: 'een intake-formulier om lid te worden van de Kroket Illuminati' },
  { gebruik: '/kroketgod eer [naam]',      voorbeeld: '/kroketgod eer Jasper',                       verwacht: '+1 kroketpunt en een plechtige zegen in het kanaal' },
  { gebruik: '/kroketgod zondebok',        voorbeeld: '',                                            verwacht: '−1 kroketpunt voor een willekeurig lid, met bijbehorend vonnis' },
  { gebruik: '/kroketgod ranglijst',       voorbeeld: '',                                            verwacht: 'de heilige ranglijst met kroketpunten per lid' },
  { gebruik: '/kroketgod dossier [naam]',  voorbeeld: '/kroketgod dossier Sander',                   verwacht: 'het officiële kroket-CV van een lid: stats, eer, zonden, motto' },
  { gebruik: '/kroketgod stem [naam]',     voorbeeld: '/kroketgod stem Jasper',                      verwacht: 'jouw stem op de held van de week (1× per week)' },
  { gebruik: '/kroketgod orakel [vraag]',  voorbeeld: '/kroketgod orakel moet ik salade lunchen?',   verwacht: 'een cryptisch maar definitief antwoord uit het Grote Vetbad' },
  { gebruik: '/kroketgod frituur [tekst]', voorbeeld: '/kroketgod frituur Sander is jarig',          verwacht: 'een AI-gegenereerde kroket-afbeelding (duurt even)' },
  { gebruik: '/kroketgod verhaal [thema]', voorbeeld: '/kroketgod verhaal val van het Koud-Beleg Front', verwacht: 'een visioen in 4 scenes — beeldverhaal in 4 plaatjes' },
  { gebruik: '/kroketgod meld [naam]',     voorbeeld: '/kroketgod meld Kevin van Sales',             verwacht: 'rapporteer een tegenstander van de snackleer — de Kroket God reageert' },
  { gebruik: '/kroketgod help',            voorbeeld: '',                                            verwacht: 'dit overzicht, alleen zichtbaar voor jou' },
];

function buildHelpText() {
  const regels = COMMANDO_LIJST
    .filter(c => c.gebruik !== '/kroketgod help')
    .map(c => {
      const commando = c.gebruik.padEnd(32);
      const voorbeeld = c.voorbeeld ? `  _bijv. ${c.voorbeeld}_` : '';
      const verwacht = c.verwacht ? `\n          _→ ${c.verwacht}_` : '';
      return `*${commando}*${voorbeeld}${verwacht}`;
    })
    .join('\n\n');
  return `⚜️ *DE GEBODEN DER COMMANDO'S* ⚜️\n\n${regels}\n\n_Alles wat niet in de lijst staat werkt ook — typ gewoon wat je wil._`;
}

// ── System prompt ──────────────────────────────────────────────────────────────

// Cache de buildSystemPrompt resultaat zolang members.json niet wijzigt
let _systemPromptCache = { key: null, value: null };

function buildSystemPrompt() {
  const members = loadMembers();
  const ledenJson = JSON.stringify(members);
  const tijd = getTijdContext();
  const cacheKey = `${ledenJson}|${tijd.dagdeel}|${tijd.dagNaam}|${tijd.seizoen}`;

  if (_systemPromptCache.key === cacheKey) return _systemPromptCache.value;

  // Dynamische ledenlijst: bijnaam + karakter (uit members.json, niet meer leden.txt)
  const bijnamen = Object.values(members).map(m => m.bijnaam).join(', ');
  const ledenBeschrijvingen = Object.values(members)
    .map(m => `${m.bijnaam} — ${m.karakter || 'een volgeling van de Hoge Frituurraad'}.`)
    .join('\n\n');

  // Aanvullende details per lid voor personalisering
  const ledenExtra = Object.values(members)
    .map(m => [
      m.bijnaam,
      m.favorieteKroket ? `favoriete kroket: ${m.favorieteKroket}` : null,
      m.kroketZonde     ? `grootste zonde: "${m.kroketZonde}"` : null,
      m.motto           ? `motto: "${m.motto}"` : null,
    ].filter(Boolean).join(' | '))
    .join('\n');

  const tijdsContext = `\n\nHuidige context: het is ${tijd.dagNaam} ${tijd.dagdeel} (${tijd.seizoen}). Stem je toon hierop af als dat relevant is. Vrijdag 12:00 is heilig. Maandagochtend is zwaar. Vrijdagmiddag is feest.`;

  // Vervang de statische ledensectie en bijnamen-lijst in SYSTEM_PROMPT_BASIS
  let prompt = SYSTEM_PROMPT_BASIS;
  prompt = prompt.replace(
    /LEDEN VAN DE HOGE FRITUURRAAD[\s\S]*?Mr\. KroketPet — [^\n]*\n/,
    `LEDEN VAN DE HOGE FRITUURRAAD\n\n${ledenBeschrijvingen}\n`
  );
  prompt = prompt.replace(
    /De enige bekende leden zijn:[^.]+\./,
    `De enige bekende leden zijn: ${bijnamen}.`
  );

  const value = `${prompt}\n\nAanvullende ledeninformatie (gebruik subtiel voor personalisering):\n${ledenExtra}${tijdsContext}`;

  _systemPromptCache = { key: cacheKey, value };
  return value;
}

// ── AI ─────────────────────────────────────────────────────────────────────────

// Roept Gemini via OpenAI-compatible endpoint. Geeft hetzelfde object terug als Groq.
async function callGemini({ model, messages, max_tokens, temperature }) {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY niet geconfigureerd');
    err.status = 0; err.skip = true;
    throw err;
  }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
      reasoning_effort: 'none', // schakel "thinking" uit zodat alle tokens naar output gaan
    }),
    timeout: 60000,
  });
  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Gemini ${response.status}: ${errorText.substring(0, 200)}`);
    err.status = response.status;
    throw err;
  }
  return await response.json();
}

async function kroketResponse(prompt, maxTokens = 400, metContext = true) {
  const systemPrompt = metContext
    ? buildSystemPrompt() + buildContextString()
    : buildSystemPrompt();

  const berichten = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: prompt },
  ];

  // Volgorde: Gemini (best, gratis ruim) → Groq 70B (backup) → Groq 8B (noodgreep)
  const modellen = [
    {
      provider: 'gemini',
      naam: 'gemini-2.5-flash',
      temp: 1.1,
      tokens: maxTokens,
      msgs: () => berichten,
    },
    {
      provider: 'groq',
      naam: 'llama-3.3-70b-versatile',
      temp: 1.2,
      tokens: maxTokens,
      msgs: () => berichten,
    },
    {
      provider: 'groq',
      naam: 'llama-3.1-8b-instant',
      temp: 0.8,
      tokens: Math.min(maxTokens, 250),
      msgs: () => [
        {
          role: 'system',
          content: `Jij bent de Kroket God. Reageer in correct Nederlands in 2 tot 4 zinnen. Gebruik alleen bestaande Nederlandse woorden — verzin geen samenstellingen. Wees kort, droog en grappig. Onderteken altijd met "— De Almachtige Kroket God". Bekende leden: Mr. KroketPet, Mr. Kroketinho, Mr. Te Lang Gefrituurde Kroket.`,
        },
        berichten[berichten.length - 1],
      ],
    },
  ];

  let laatsteFout;
  for (let i = 0; i < modellen.length; i++) {
    const model = modellen[i];
    let laatste;
    try {
      const msgs = model.msgs();
      for (let poging = 1; poging <= 2; poging++) {
        const pogingTokens = poging === 1 ? model.tokens : model.tokens * 2;
        const opts = { model: model.naam, max_tokens: pogingTokens, temperature: model.temp, messages: msgs };
        laatste = model.provider === 'gemini'
          ? await callGemini(opts)
          : await groq.chat.completions.create(opts);
        const keuze = laatste.choices[0];
        if (keuze.finish_reason !== 'length') {
          if (i > 0) console.log(`✓ Antwoord via fallback: ${model.naam}`);
          return keuze.message.content;
        }
        console.warn(`⚠️ Afgeknopt bij ${pogingTokens} tokens (${model.naam}, poging ${poging}).`);
      }
      return laatste.choices[0].message.content;
    } catch (error) {
      laatsteFout = error;
      const isRateLimit = error?.status === 429 || error?.error?.error?.code === 'rate_limit_exceeded';
      const isSkip = error?.skip === true; // bv. Gemini key ontbreekt
      const isLaatste = i === modellen.length - 1;
      if ((isRateLimit || isSkip) && !isLaatste) {
        console.warn(`⚠️ ${model.naam} niet beschikbaar (${error.status || 'skip'}), fallback naar volgende model.`);
        continue;
      }
      throw error;
    }
  }
  throw laatsteFout;
}

// Veelvoorkomende Nederlandse woorden — nooit als voornaam gebruiken bij vervanging
const STOPWOORDEN = new Set([
  'de','het','een','en','van','in','op','aan','met','voor','door','om','bij',
  'is','was','wel','niet','dat','dit','die','er','te','of','als','maar',
  'mr','mevr','dr','sir','prof',
]);

// Vervang voornamen door bijnamen — werkt op zowel input als output
function vervangNamen(tekst) {
  if (!tekst) return tekst;
  const members = loadMembers();
  let resultaat = tekst;
  for (const m of Object.values(members)) {
    const v = m.voornaam;
    // Skip lege, te korte (≤3 chars), of stopwoorden — anders matcht het overal
    if (!v || v.length <= 3 || STOPWOORDEN.has(v.toLowerCase())) continue;
    resultaat = resultaat.replace(new RegExp(`\\b${v}\\b`, 'gi'), m.bijnaam);
  }
  return resultaat;
}

// Normaliseer ondertekening — de Kroket God ondertekent ALTIJD als "De Almachtige Kroket God"
function normaliseerOndertekening(tekst) {
  if (!tekst) return tekst;
  // Vang elke variatie van "— [evt. de] [evt. bijvoeglijke naamwoorden] Kroket God"
  // De regex matcht: streepje/em-dash, optioneel "de", optioneel 1-4 woorden, eindigt op "Kroket God"
  return tekst.replace(
    /([—–-])\s*(?:de\s+)?(?:\w+\s+){0,4}kroket\s*god\b\.?/gi,
    '$1 De Almachtige Kroket God'
  );
}

// Combineerde output-filter: namen vervangen + ondertekening normaliseren
const schoonOutput = (tekst) => normaliseerOndertekening(vervangNamen(tekst));

async function postToChannel(client, channelId, text, options = {}) {
  const gefilterd = schoonOutput(text);
  const payload = { channel: channelId, text: gefilterd };
  if (options.thread_ts) payload.thread_ts = options.thread_ts;
  await client.chat.postMessage(payload);
  if (channelId === process.env.SLACK_CHANNEL_ID && !options.thread_ts) {
    logBericht('Kroket God', gefilterd);
  }
}

// ── Beeld genereren ────────────────────────────────────────────────────────────

const BEELD_STIJLEN = [
  {
    naam: 'cinematic',
    suffix: 'cinematic lighting, shot on Canon EOS R5 85mm f/1.4, shallow depth of field, ultra-detailed photorealistic, dramatic chiaroscuro, golden hour ambiance',
    intro: 'A cinematic photograph in the style of a high-end Dutch food commercial meets a Vermeer still life.',
  },
  {
    naam: 'renaissance',
    suffix: 'oil painting in the style of Caravaggio, chiaroscuro lighting, dramatic Baroque composition, deep shadows, museum quality, ornate gilded frame implied',
    intro: 'A Renaissance oil painting depicting',
  },
  {
    naam: 'byzantine',
    suffix: 'Byzantine icon style, gold leaf background, religious iconography, halo, ornate detailing, devotional art aesthetic',
    intro: 'A Byzantine religious icon featuring',
  },
  {
    naam: 'editorial',
    suffix: 'editorial photography, Vogue food editorial style, minimalist composition, soft directional studio light, marble surfaces, high fashion food art',
    intro: 'An editorial fashion photograph featuring',
  },
  {
    naam: 'mythical',
    suffix: 'epic fantasy concept art, volumetric god rays, mythical atmosphere, hyper-detailed, painted by Greg Rutkowski',
    intro: 'An epic fantasy concept painting of',
  },
];

function kiesBeeldStijl() {
  return BEELD_STIJLEN[Math.floor(Math.random() * BEELD_STIJLEN.length)];
}

async function genereerBeeld(client, channelId, userId, beschrijving) {
  const stijl = kiesBeeldStijl();

  const promptResponse = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    temperature: 0.9,
    messages: [
      {
        role: 'system',
        content: `You are an expert AI image prompt writer for FLUX.1 Pro. Convert a Dutch description into a vivid, specific English image prompt.

STYLE PRESET: ${stijl.naam}
START WITH: "${stijl.intro}"
END WITH (literally append): "${stijl.suffix}"

HERO OBJECT — KROKET:
A single large, perfectly golden-brown Dutch croquette MUST appear as the dominant hero object — on a pedestal, throne, altar, marble surface, or held aloft. It is a REAL physical crispy croquette with visible breading texture. Never worn as clothing. Never a costume. Never metaphorical.

COMPOSITION RULES:
- Exactly ONE clear hero
- Strong directional warm light from one specific direction
- Clean, focused background (no clutter)
- 2-3 distinct elements max
- Specific textures: visible breadcrumbs, glossy mustard sheen, steam, marble veining, velvet folds
- Specific colors named (deep amber, ochre, ivory, burgundy)

FORBIDDEN:
- People dressed as kroket / costumes
- Floating clouds, smoke, surreal abstract elements
- Generic adjectives (beautiful, amazing, epic, stunning)
- More than 3 elements

OUTPUT: Return ONLY the image prompt as plain text. No quotes, no explanation. 2-3 sentences.`,
      },
      { role: 'user', content: beschrijving },
    ],
  });

  let beeldPrompt = promptResponse.choices[0].message.content.trim();
  // Strip eventuele aanhalingstekens of "Image prompt:" labels
  beeldPrompt = beeldPrompt.replace(/^["']|["']$/g, '').replace(/^(image prompt|prompt):\s*/i, '');
  console.log(`🎨 [${stijl.naam}] ${beeldPrompt}`);

  const encoded = encodeURIComponent(beeldPrompt);
  const seed = Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=1280&model=flux&enhance=true&nologo=true&seed=${seed}`;

  let buffer;
  for (let poging = 1; poging <= 3; poging++) {
    try {
      const response = await fetch(url, { timeout: 90000 });
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('image')) {
        buffer = await response.buffer();
        break;
      }
    } catch (err) {
      console.warn(`Beeld poging ${poging} faalde:`, err.message);
    }
    if (poging < 3) await new Promise(r => setTimeout(r, 4000 * poging));
  }

  if (!buffer) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: '⚜️ _Het Grote Vetbad is momenteel overbelast. Probeer het later opnieuw._',
    });
    return;
  }

  const toelichting = await kroketResponse(
    `De Kroket God heeft een visioen laten verschijnen over: "${beschrijving}". Geef een korte, dramatische toelichting (2-3 zinnen) op dit visioen als goddelijke openbaring. Geen inleidingszin.`,
    300, false
  );

  await client.files.uploadV2({
    channel_id: channelId,
    file: buffer,
    filename: 'kroketgod.png',
    initial_comment: schoonOutput(toelichting),
  });
}

// ── Multi-image storyboard (verhaal in 4 scenes) ──────────────────────────────

async function genereerStoryboard(client, channelId, userId, thema) {
  // Vraag het grote model om 4 sceneschetsen
  const scenesResponse = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 600,
    temperature: 1.0,
    messages: [
      {
        role: 'system',
        content: `Je bent een verhalenverteller voor de Kroket God. Een gebruiker geeft een thema. Beschrijf het verhaal in exact 4 visuele scenes — begin, opbouw, climax, ontknoping. Iedere scene als één korte zin in het Nederlands die een concreet, filmisch beeld oproept met de kroket als hoofdrol. Geef in dit exacte formaat (geen extra tekst):

SCENE1: [beschrijving]
SCENE2: [beschrijving]
SCENE3: [beschrijving]
SCENE4: [beschrijving]
ONDERSCHRIFT: [één dramatische zin als slot]`,
      },
      { role: 'user', content: `Thema: ${thema}` },
    ],
  });

  const tekst = scenesResponse.choices[0].message.content;
  const scenes = [];
  let onderschrift = '';
  for (const lijn of tekst.split('\n')) {
    const sceneMatch = lijn.match(/^SCENE\d:\s*(.+)/i);
    const onderMatch = lijn.match(/^ONDERSCHRIFT:\s*(.+)/i);
    if (sceneMatch) scenes.push(sceneMatch[1].trim());
    else if (onderMatch) onderschrift = onderMatch[1].trim();
  }

  if (scenes.length < 4) {
    await client.chat.postEphemeral({ channel: channelId, user: userId, text: '⚜️ _Het verhaal kon niet uit het Vetbad worden opgehaald. Probeer opnieuw._' });
    return;
  }

  const stijl = kiesBeeldStijl(); // alle scenes dezelfde stijl voor consistentie
  const buffers = [];

  for (let i = 0; i < 4; i++) {
    const sceneEN = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `Convert this Dutch scene description into a vivid English image prompt. Start with "${stijl.intro}". End with "${stijl.suffix}". Keep a real golden-brown Dutch croquette as the hero. 2 sentences max. No quotes.`,
        },
        { role: 'user', content: scenes[i] },
      ],
    });
    const beeldPrompt = sceneEN.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(beeldPrompt)}?width=1024&height=1024&model=flux&enhance=true&nologo=true&seed=${Math.floor(Math.random() * 99999)}`;
    try {
      const response = await fetch(url, { timeout: 90000 });
      if ((response.headers.get('content-type') || '').includes('image')) {
        buffers.push({ buffer: await response.buffer(), beschrijving: scenes[i] });
      }
    } catch (err) {
      console.warn(`Storyboard scene ${i+1} faalde:`, err.message);
    }
  }

  if (buffers.length === 0) {
    await client.chat.postEphemeral({ channel: channelId, user: userId, text: '⚜️ _Het Grote Vetbad weigerde te leveren._' });
    return;
  }

  // Eerst de header sturen, dan elke scene afzonderlijk uploaden
  await postToChannel(client, channelId,
    `⚜️ *EEN VISIOEN IN VIER DELEN* ⚜️\n_Thema: "${thema}"_`
  );

  for (let i = 0; i < buffers.length; i++) {
    await client.files.uploadV2({
      channel_id: channelId,
      file: buffers[i].buffer,
      filename: `verhaal-${i+1}.png`,
      initial_comment: `*Scene ${i+1}:* ${buffers[i].beschrijving}`,
    });
  }

  if (onderschrift) {
    await postToChannel(client, channelId, `_${onderschrift}_\n\n— De Almachtige Kroket God`);
  }
}

// ── Voice / TTS via Pollinations ──────────────────────────────────────────────

async function genereerStem(tekst) {
  // Pollinations openai-audio endpoint. Houdt het kort (< 500 chars) voor stabiliteit.
  const kort = tekst.replace(/[*_>⚜️📜🥄🥉🥈🥇⚖️🏆💎]/g, '').replace(/\n+/g, ' ').trim().substring(0, 480);
  const url = `https://text.pollinations.ai/${encodeURIComponent(kort)}?model=openai-audio&voice=onyx`;
  try {
    const response = await fetch(url, { timeout: 60000 });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio')) return await response.buffer();
  } catch (err) {
    console.warn('TTS fout:', err.message);
  }
  return null;
}

async function postMetStem(client, channelId, tekst) {
  await postToChannel(client, channelId, tekst);
  const audio = await genereerStem(tekst);
  if (audio) {
    try {
      await client.files.uploadV2({
        channel_id: channelId,
        file: audio,
        filename: 'kroketgod.mp3',
        initial_comment: '🔊 _Stem van de Almachtige Kroket God_',
      });
    } catch (err) {
      console.warn('TTS upload fout:', err.message);
    }
  }
}

// ── Aanmeld modal ──────────────────────────────────────────────────────────────

function buildIntakeModal(triggerId) {
  return {
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'intake_modal',
      title: { type: 'plain_text', text: 'Kroket Illuminati Intake' },
      submit: { type: 'plain_text', text: 'Aanmelden' },
      close: { type: 'plain_text', text: 'Annuleren' },
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Welkom, aspirant-volgeling.*\n\nBeantwoord de heilige vragen naar waarheid. De Hoge Frituurraad zal oordelen.' } },
        { type: 'divider' },
        { type: 'input', block_id: 'bijnaam_block',    element: { type: 'plain_text_input', action_id: 'bijnaam_input',    placeholder: { type: 'plain_text', text: 'bijv. Mr. Kroketpet' } },           label: { type: 'plain_text', text: 'Uw gewenste bijnaam binnen de Illuminati' } },
        { type: 'input', block_id: 'verjaardag_block', optional: true, element: { type: 'plain_text_input', action_id: 'verjaardag_input', placeholder: { type: 'plain_text', text: 'DD-MM (bijv. 14-03)' } }, label: { type: 'plain_text', text: 'Uw verjaardag (DD-MM)' } },
        { type: 'input', block_id: 'kroket_block',     optional: true, element: { type: 'plain_text_input', action_id: 'kroket_input',     placeholder: { type: 'plain_text', text: 'bijv. Goulash, Bitterbal' } },     label: { type: 'plain_text', text: 'Uw favoriete kroket' } },
        { type: 'input', block_id: 'zonde_block',      optional: true, element: { type: 'plain_text_input', action_id: 'zonde_input',  multiline: true, placeholder: { type: 'plain_text', text: 'bijv. Ik heb ketchup gebruikt' } }, label: { type: 'plain_text', text: 'Uw grootste kroket-zonde' } },
        { type: 'input', block_id: 'motto_block',      optional: true, element: { type: 'plain_text_input', action_id: 'motto_input',      placeholder: { type: 'plain_text', text: 'bijv. De kroket wacht op niemand' } }, label: { type: 'plain_text', text: 'Uw persoonlijk kroket-motto' } },
      ],
    },
  };
}

// ── Slash command ──────────────────────────────────────────────────────────────

app.command('/kroketgod', async ({ command, ack, respond, client }) => {
  await ack();

  const input = vervangNamen(command.text.trim());

  try {
    // Help — altijd beschikbaar
    if (input === 'help') {
      await respond({ text: buildHelpText(), response_type: 'ephemeral' });
      return;
    }

    // Aanmelden — modal openen
    if (input === 'aanmelden') {
      await client.views.open(buildIntakeModal(command.trigger_id));
      return;
    }

    // Geheime prompts — niet in de help
    if (input === 'prompts') {
      const prompts = [
        '🕵️ *Geheime Kroket Prompts* — alleen voor de ingewijden\n',
        '`/kroketgod schrijf een kroket-testament voor [naam]`\n_→ laatste wil en kroket-erfenis, plechtig opgesteld door de Hoge Frituurraad_\n',
        '`/kroketgod geef [naam] een kroket-therapiesessie`\n_→ de Kroket God als therapeut — confronterend, warm, met mosterd_\n',
        '`/kroketgod rechtbank kroket vs frikandel`\n_→ rechtbankdrama tussen twee snacks, met vonnis_\n',
        '`/kroketgod schrijf een necrologie voor een mislukte kroket`\n_→ rouwbrief voor een kroket die het niet heeft gehaald_\n',
        '`/kroketgod geef een kroket-weersverwachting voor deze week`\n_→ weerbericht maar volledig in frituur-metaforen_\n',
        '`/kroketgod schrijf een kroket-sollicitatiebrief voor [naam]`\n_→ formele brief met kroket-kwalificaties_\n',
        '`/kroketgod houd een TED talk over [onderwerp] maar dan in kroket`\n_→ inspirerende lezing door de lens van de snackleer_\n',
        '`/kroketgod schrijf een kroket-huwelijksaanzoek`\n_→ romantisch maar plechtig, mosterd speelt een rol_\n',
        '`/kroketgod wat zou Aristoteles zeggen over de kroket`\n_→ filosofisch debat tussen klassieke wijsheid en frituurcultuur_\n',
        '`/kroketgod stel een kroket-grondwet op`\n_→ officieel wetsdocument met artikelen en frituurrecht_\n',
        '`/kroketgod schrijf een kroket-horrorscenario`\n_→ spannend verhaal waarin de kroket centraal staat_\n',
        '`/kroketgod schrijf een kroket-lied op de melodie van [liedje]`\n_→ volledige songtekst met alle coupletten_\n',
        '`/kroketgod oordeel over mijn leven: [beschrijving]`\n_→ goddelijk vonnis over jouw levensstijl en kroket-toekomst_\n',
        '`/kroketgod kroket vs bitterbal — finaal debat`\n_→ beide kanten verdedigd, dramatisch slotakkoord_\n',
        '`/kroketgod schrijf een encycliek over [thema]`\n_→ pauselijke brief van de Kroket God, in hoofdstukken_\n',
        '`/kroketgod canoniseer [naam] als heilige van de snackleer`\n_→ officiële heiligverklaring met deugden en wonderen_\n',
        '`/kroketgod onthul de naam van mijn spirit-kroket`\n_→ welke kroket past het beste bij jouw ziel_',
      ];
      await respond({ text: prompts.join('\n'), response_type: 'ephemeral' });
      return;
    }

    // DM-bediening: in een Direct Message begint channel_id met 'D' — sommige commando's mogen daar
    const isDM = command.channel_id?.startsWith('D');
    const DM_TOEGESTAAN = ['biecht', 'orakel', 'dossier', 'ranglijst', 'prompts'];
    const eersteWoord = input.split(' ')[0];

    if (!ALLOWED_CHANNELS.includes(command.channel_name) && !isDM) {
      await respond('De Kroket God spreekt alleen in de gewijde kanalen. Begeef u daarheen.');
      return;
    }
    if (isDM && !DM_TOEGESTAAN.includes(eersteWoord)) {
      await respond(`In dit privé-gehoor antwoordt de Kroket God enkel op: ${DM_TOEGESTAAN.join(', ')}.`);
      return;
    }

    const members = loadMembers();
    const aanvrager = members[command.user_id]?.bijnaam || 'Ongepaneerde vreemdeling';

    // ── Geen input: spreek willekeurig lid aan
    if (!input) {
      const lid = randomMember();
      if (!lid) {
        await respond('De Hoge Frituurraad heeft geen leden gevonden.');
        return;
      }
      const tekst = await kroketResponse(`Spreek ${lid[1].bijnaam} aan met een willekeurige uitspraak — zegen, waarschuwing, observatie of compliment. Verras met de toon. Geen inleidingszin.`);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Quote
    if (input === 'quote') {
      const tekst = await kroketResponse('Geef één korte kroket-wijsheid of quote. Maximaal twee zinnen. Geen header, gewoon de quote in stijl.');
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Vrijdag countdown
    if (input === 'vrijdag') {
      const nu = new Date();
      const dag = nu.getDay();
      const uur = nu.getHours();
      const min = nu.getMinutes();
      const isVrijdagVoorTwaalf = dag === 5 && (uur < 12 || (uur === 12 && min === 0));
      const isVrijdagNaTwaalf   = dag === 5 && !isVrijdagVoorTwaalf;
      const dagenTot = isVrijdagVoorTwaalf ? 0 : ((5 - dag + 7) % 7) || 7;

      let prompt;
      if (isVrijdagVoorTwaalf) {
        prompt = 'Het is vrijdag en het heilige uur van 12:00 nadert. Stuur een urgente oproep voor #lekkerkroketje.';
      } else if (isVrijdagNaTwaalf) {
        prompt = 'Het is vrijdag maar het heilige uur is voorbij. Reageer melancholisch maar hoopvol op volgende week.';
      } else {
        prompt = `Er zijn nog ${dagenTot} dag(en) tot het heilige vrijdagmoment van 12:00. Maak er een dramatische aftelling van.`;
      }
      const tekst = await kroketResponse(prompt);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Biecht (in DM = privé, in kanaal = openbaar)
    if (input.startsWith('biecht')) {
      const zonde = input.replace(/^biecht\s*/, '').trim();
      const prompt = zonde
        ? `${aanvrager} biecht de volgende zonde op: "${zonde}". ${isDM ? 'Dit is een privé-biecht — reageer warm, met absolute geheimhouding en kans op verlossing.' : 'Reageer als de Kroket God — oordeel, maar geef kans op verlossing.'}`
        : `${aanvrager} biedt een lege biecht aan. Reageer verontwaardigd.`;
      const tekst = await kroketResponse(prompt);
      if (isDM) {
        await client.chat.postMessage({ channel: command.channel_id, text: schoonOutput(tekst) });
      } else {
        await postToChannel(client, command.channel_id, tekst);
      }
      return;
    }

    // ── Straf
    if (input.startsWith('straf ')) {
      const invoer = input.replace('straf ', '').trim();
      const gevonden = getMemberByNaam(invoer);
      const doelwit = gevonden ? gevonden[1].bijnaam : `Ongepaneerde vreemdeling genaamd "${invoer}"`;
      const tekst = await kroketResponse(`Leg een creatieve en passende straf op aan ${doelwit}. Spreek hen uitsluitend aan als "${doelwit}". Dramatisch en specifiek.`);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Gebod
    if (input.startsWith('gebod')) {
      const nummer = parseInt(input.replace(/^gebod\s*/, '').trim());
      if (nummer >= 1 && nummer <= 10) {
        const gebod = GEBODEN_LIJST[nummer - 1];
        const tekst = await kroketResponse(`Leg Gebod ${nummer} uit: "${gebod}". Geef een korte, dramatische toelichting met een concrete toepassing.`);
        await postToChannel(client, command.channel_id, tekst);
      } else {
        await respond('Er zijn slechts Tien Geboden. Kies een getal tussen 1 en 10.');
      }
      return;
    }

    // ── Bekeer
    if (input.startsWith('bekeer ')) {
      const naam = input.replace('bekeer ', '').trim();
      const gevonden = getMemberByNaam(naam);
      if (gevonden) {
        await respond(`${gevonden[1].bijnaam} behoort reeds tot de Geordende Kring. Bekering is niet nodig.`);
      } else {
        const tekst = await kroketResponse(`Er wordt gevraagd om "${naam}" toe te laten tot de Kroket Illuminati. Oordeel dramatisch of deze buitenstaander waardig is. De uitkomst mag twijfelachtig zijn.`);
        await postToChannel(client, command.channel_id, tekst);
      }
      return;
    }

    // ── Ranglijst
    if (input === 'ranglijst') {
      const scores = loadScores();
      const allMembers = loadMembers();
      const titels = ['🥇 Opperkroket', '🥈 Paneermeester', '🥉 Aspirant-volgeling'];
      const gesorteerd = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const lijst = gesorteerd.map(([id, score], i) =>
        `${titels[i] || ':lekker_kroketje: Volgeling'} — ${allMembers[id]?.bijnaam || id}: ${score} kroketpunten`
      ).join('\n');
      const tekst = `⚜️ DE HEILIGE RANGLIJST DER KROKET ILLUMINATI ⚜️\n\n${lijst}\n\n— De Almachtige Kroket God`;
      if (isDM) {
        await client.chat.postMessage({ channel: command.channel_id, text: schoonOutput(tekst) });
      } else {
        await postToChannel(client, command.channel_id, tekst);
      }
      return;
    }

    // ── Dossier
    if (input.startsWith('dossier')) {
      const invoer = input.replace(/^dossier\s*/, '').trim();
      const gevonden = invoer
        ? getMemberByNaam(invoer)
        : Object.entries(loadMembers()).find(([id]) => id === command.user_id);
      if (!gevonden) {
        await respond(`De Kroket God kent geen dossier van "${invoer}".`);
        return;
      }
      const [id, lid] = gevonden;
      const scores = loadScores();
      const streaks = loadStreaks();
      const punten = scores[id] ?? 0;
      const streak = streaks[id]?.huidig ?? 0;
      const lidSinds = lid.lidSinds ? new Date(lid.lidSinds).toLocaleDateString('nl-NL') : 'onbekend';

      const tekst =
        `📜 *DOSSIER — ${lid.bijnaam}* 📜\n` +
        `\n*Status:* Volgeling der Kroket Illuminati` +
        `\n*Lid sinds:* ${lidSinds}` +
        `\n*Kroketpunten:* ${punten}` +
        (streak ? `\n*Vrijdagstreak:* ${streak} week(en) onafgebroken` : '') +
        (lid.favorieteKroket ? `\n*Favoriete kroket:* ${lid.favorieteKroket}` : '') +
        (lid.verjaardag ? `\n*Verjaardag:* ${lid.verjaardag}` : '') +
        (lid.motto ? `\n*Motto:* "_${lid.motto}_"` : '') +
        (lid.kroketZonde ? `\n*Bekentenis:* "${lid.kroketZonde}"` : '') +
        `\n\n— Hoge Frituurraad, archief`;
      if (isDM) {
        await client.chat.postMessage({ channel: command.channel_id, text: schoonOutput(tekst) });
      } else {
        await postToChannel(client, command.channel_id, tekst);
      }
      return;
    }

    // ── Zondebok
    if (input === 'zondebok') {
      const lid = randomMember();
      if (!lid) {
        await respond('De Hoge Frituurraad heeft geen leden gevonden.');
        return;
      }
      const [zondeId, zondebok] = lid;
      pasScoreAan(zondeId, -1);
      const tekst = await kroketResponse(`De Kroket God wijst ${zondebok.bijnaam} aan als zondebok — uit eigen goddelijke wil. Begin DIRECT met het vonnis, geen inleidingszin, geen verwijzing naar wie dit aanvroeg of waarom.`);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Eer geven
    if (input.startsWith('eer ')) {
      const invoer = input.replace('eer ', '').trim();
      const gevonden = getMemberByNaam(invoer);
      if (gevonden) {
        const [eerId, lid] = gevonden;

        // Verbod: jezelf eren is een doodzonde
        if (eerId === command.user_id) {
          // Strafpunt voor de hoogmoed
          await pasScoreAanMetCheck(client, command.user_id, -1);
          const waarschuwing = await kroketResponse(
            `${aanvrager} heeft zojuist geprobeerd ZICHZELF te eren — een daad van ongekende hoogmoed binnen de snackleer. De Kroket God spreekt een felle waarschuwing uit: zelflof is een doodzonde tegen de Hoge Frituurraad. Als straf wordt 1 kroketpunt afgenomen. Wees scherp, plechtig en publiekelijk. Geen inleidingszin.`
          );
          await postToChannel(client, command.channel_id, waarschuwing);
          return;
        }

        await pasScoreAanMetCheck(client, eerId, 1);
        const tekst = await kroketResponse(`De Kroket God zegent ${lid.bijnaam} met een kroketpunt — uit eigen goddelijke wil, zonder aanleiding. Begin DIRECT met de zegen, geen inleidingszin, geen verwijzing naar een aanvraag of reden.`);
        await postToChannel(client, command.channel_id, tekst);
      } else {
        await respond(`De Kroket God kent geen volgeling genaamd "${invoer}". Ongepaneerde vreemdeling.`);
      }
      return;
    }

    // ── Beeld genereren
    if (input.startsWith('frituur')) {
      const beschrijving = input.replace(/^frituur\s*/, '').trim() || 'de almachtige Kroket God op zijn troon';
      await respond({ text: '⚜️ _De Kroket God roept een visioen op uit het Grote Vetbad..._', response_type: 'ephemeral' });
      await genereerBeeld(client, command.channel_id, command.user_id, beschrijving);
      return;
    }

    // ── Nieuws
    if (input === 'nieuws') {
      const tekst = await kroketResponse(
        'Genereer een dramatisch breaking news bericht vanuit het Grote Vetbad. Gebruik een ⚜️ SPOEDMELDING header. Verzin een absurd maar geloofwaardig kroket-gerelateerd nieuwtje als officieel persbericht.'
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Orakel
    if (input.startsWith('orakel')) {
      const vraag = input.replace(/^orakel\s*/, '').trim();
      if (!vraag) {
        await respond('Het Orakel zwijgt zonder vraag. Stel uw vraag.');
        return;
      }
      const tekst = await kroketResponse(
        `Het Kroket-Orakel beantwoordt de vraag: "${vraag}". Geef een cryptisch maar definitief antwoord in 2-3 zinnen. Het antwoord moet dubbelzinnig maar overtuigend zijn — alsof er een verborgen waarheid in zit. Eindig met een orakelachtige nazin.`
      );
      if (isDM) {
        await client.chat.postMessage({ channel: command.channel_id, text: schoonOutput(tekst) });
      } else {
        await postToChannel(client, command.channel_id, tekst);
      }
      return;
    }

    // ── Horoscoop
    if (input.startsWith('horoscoop')) {
      const invoer = input.replace(/^horoscoop\s*/, '').trim();
      let doelwit;
      if (invoer) {
        const gevonden = getMemberByNaam(invoer);
        doelwit = gevonden ? gevonden[1].bijnaam : `Buitenstaander genaamd "${invoer}"`;
      } else {
        doelwit = aanvrager;
      }
      const tekst = await kroketResponse(
        `Geef een kroket-horoscoop voor ${doelwit}. Spreek hen uitsluitend aan als "${doelwit}". Wat staat de sterren (en de frituurmand) hen te wachten deze week? Concreet, met kroket-symboliek, met één voorspelling die specifiek genoeg is om te kunnen kloppen.`
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Rap
    if (input.startsWith('rap ')) {
      const onderwerp = input.replace('rap ', '').trim();
      const tekst = await kroketResponse(
        `Schrijf een korte rap (4-8 regels) in de stijl van de Kroket God over: "${onderwerp}". De rap heeft rijm, ritme en kroket-metaforen. Eindig met een drooppin'-lijn over de snackleer.`,
        500
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Debat
    if (input.startsWith('debat ')) {
      const stelling = input.replace('debat ', '').trim();
      const tekst = await kroketResponse(
        `De Kroket God debatteert de stelling: "${stelling}". Geef kort een VOOR-argument en een TEGEN-argument, beide in Kroket God stijl. Sluit af met een definitief oordeel.`,
        500
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Rechtbank
    if (input.startsWith('rechtbank ')) {
      const zaak = input.replace('rechtbank ', '').trim();
      const vsMatch = zaak.match(/^(.+?)\s+vs\s+(.+)$/i);
      if (!vsMatch) {
        await respond('_Gebruik: /kroketgod rechtbank [naam1] vs [naam2]_');
        return;
      }
      const [, naam1, naam2] = vsMatch;
      const g1 = getMemberByNaam(naam1.trim());
      const g2 = getMemberByNaam(naam2.trim());
      const partij1 = g1 ? g1[1].bijnaam : `Buitenstaander "${naam1.trim()}"`;
      const partij2 = g2 ? g2[1].bijnaam : `Buitenstaander "${naam2.trim()}"`;
      const tekst = await kroketResponse(
        `Leid een rechtbankzaak tussen ${partij1} en ${partij2}. Spreek hen uitsluitend aan als respectievelijk "${partij1}" en "${partij2}". De Kroket God is rechter én aanklager. Presenteer de aanklacht, hoor beide partijen kort en spreek een dramatisch vonnis uit. Verwijs naar de Geboden.`,
        600
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Stem
    if (input.startsWith('stem ')) {
      const invoer = input.replace('stem ', '').trim();
      const gevonden = getMemberByNaam(invoer);
      if (!gevonden) {
        await respond(`De Kroket God kent geen volgeling genaamd "${invoer}".`);
        return;
      }
      const [voteeId, voteeLid] = gevonden;
      const stemData = loadStemmen();
      const weekStart = getMondayOfWeek();

      if (stemData.weekStart !== weekStart) {
        stemData.weekStart = weekStart;
        stemData.stemmen = {};
      }

      if (stemData.stemmen[command.user_id]) {
        const vorigeId = stemData.stemmen[command.user_id];
        const vorige = members[vorigeId]?.bijnaam || 'iemand';
        await respond({ text: `U heeft deze week al gestemd op ${vorige}. De Hoge Frituurraad accepteert geen dubbele stemmen.`, response_type: 'ephemeral' });
        return;
      }

      stemData.stemmen[command.user_id] = voteeId;
      saveStemmen(stemData);

      const aantalStemmen = Object.values(stemData.stemmen).filter(id => id === voteeId).length;
      const tekst = await kroketResponse(
        `${aanvrager} heeft gestemd op ${voteeLid.bijnaam} als kroket-held van de week. ${voteeLid.bijnaam} heeft nu ${aantalStemmen} stem(men). Reageer plechtig op deze democratische daad.`
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Uitverkorene
    if (input === 'slachtoffer') {
      const positief = Math.random() < 0.5;
      const uitverkorene = getUitverkorene(positief);
      if (!uitverkorene) {
        await respond('De Hoge Frituurraad heeft geen leden gevonden.');
        return;
      }
      const [, lid] = uitverkorene;
      const prompt = positief
        ? `Kondig plechtig aan dat ${lid.bijnaam} de uitverkorene is van dit moment — en dat dit goed nieuws is. De Kroket God is gunstig gestemd. Zegen hen dramatisch.`
        : `Onthul plechtig dat ${lid.bijnaam} de uitverkorene is van dit moment — en dat de Hoge Frituurraad hen vriendelijk maar nauwlettend in het oog houdt. Dreigend maar met ironie.`;
      const tekst = await kroketResponse(prompt);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Meld: tegenstander rapporteren
    if (input.startsWith('meld ') || input === 'meld') {
      const naam = input.replace(/^meld\s*/, '').trim();
      if (!naam) {
        await respond('Wie meldt u aan? Noem de naam van de tegenstander.');
        return;
      }
      const facties = ['de Ongepaneerden', 'het Koud-Beleg Front', 'de Saladesekte', 'de Bitterbal-ontkenners', 'de aanhangers van het Droge Brood'];
      const factie = facties[Math.floor(Math.random() * facties.length)];
      const tekst = await kroketResponse(
        `${aanvrager} meldt "${naam}" aan bij de Hoge Frituurraad als vermoedelijke handlanger van ${factie}. Reageer dramatisch — onderzoek de zaak in stijl, citeer fictief bewijs, en spreek een voorlopig oordeel uit. Eindig met een waarschuwing aan "${naam}" of een geruststelling aan ${aanvrager}. Geen inleidingszin.`,
        500
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Verhaal: 4-scene storyboard
    if (input.startsWith('verhaal ') || input === 'verhaal') {
      const thema = input.replace(/^verhaal\s*/, '').trim() || 'de strijd tussen de Kroket en het Koud-Beleg Front';
      await respond({ text: '⚜️ _Het Vetbad ontvouwt een visioen in vier delen — dit kan even duren..._', response_type: 'ephemeral' });
      await genereerStoryboard(client, command.channel_id, command.user_id, thema);
      return;
    }

    // ── Vrij bericht
    const tekst = await kroketResponse(input);
    await postToChannel(client, command.channel_id, tekst);

  } catch (error) {
    console.error('Fout:', error);
    const isRateLimit = error?.status === 429 || error?.error?.error?.code === 'rate_limit_exceeded';
    const bericht = isRateLimit
      ? '⚜️ _De Kroket God heeft zijn daglimiet bereikt. Probeer het morgen opnieuw._'
      : '⚜️ _De Hoge Frituurraad is momenteel in beraad. Probeer het later opnieuw._';
    await respond({ text: bericht, response_type: 'ephemeral' });
  }
});

// ── Modal callback: aanmelding ─────────────────────────────────────────────────

app.view('intake_modal', async ({ ack, view, body, client }) => {
  await ack();
  try {
    const userId = body.user.id;
    const values = view.state.values;

    const bijnaam         = values.bijnaam_block.bijnaam_input.value?.trim() || 'Naamloze Volgeling';
    const verjaardag      = values.verjaardag_block.verjaardag_input.value?.trim() || null;
    const favorieteKroket = values.kroket_block.kroket_input.value?.trim() || null;
    const kroketZonde     = values.zonde_block.zonde_input.value?.trim() || null;
    const motto           = values.motto_block.motto_input.value?.trim() || null;

    let naam = bijnaam;
    try {
      const info = await client.users.info({ user: userId });
      naam = info.user?.profile?.real_name || info.user?.name || bijnaam;
    } catch (_) {}

    const members = loadMembers();
    // Sla geen voornaam op als die te kort is of een Nederlands stopwoord is
    const eersteWoord = naam.split(' ')[0].toLowerCase();
    const veiligeVoornaam = eersteWoord.length > 3 && !STOPWOORDEN.has(eersteWoord) ? eersteWoord : null;
    members[userId] = {
      naam,
      voornaam: veiligeVoornaam,
      bijnaam,
      verjaardag,
      favorieteKroket,
      kroketZonde,
      motto,
      lidSinds: new Date().toISOString().split('T')[0],
    };
    saveMembers(members);

    const scores = loadScores();
    if (scores[userId] === undefined) {
      scores[userId] = 0;
      saveScores(scores);
    }

    let welkomPrompt = `Een nieuwe volgeling meldt zich aan bij de Kroket Illuminati. Hun bijnaam: ${bijnaam}.`;
    if (favorieteKroket) welkomPrompt += ` Favoriete kroket: ${favorieteKroket}.`;
    if (kroketZonde)     welkomPrompt += ` Kroket-zonde: "${kroketZonde}".`;
    if (motto)           welkomPrompt += ` Motto: "${motto}".`;
    welkomPrompt += ' Verwelkom hen plechtig als nieuw lid, maar laat de eventuele zonde niet onopgemerkt.';

    const welkomTekst = await kroketResponse(welkomPrompt);
    await postToChannel(client, process.env.SLACK_CHANNEL_ID, welkomTekst);
  } catch (error) {
    console.error('Fout bij intake_modal:', error);
  }
});

// ── Sentiment + reactie in één AI call ─────────────────────────────────────────

async function analyseerEnGenereer(prompt) {
  const result = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    max_tokens: 10,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'Classify the sentiment of this Dutch message toward a godly authority figure. Reply with EXACTLY one word: BELEDIGING, LOFZANG, or NEUTRAAL.',
      },
      { role: 'user', content: prompt },
    ],
  });
  const uitkomst = result.choices[0].message.content.trim().toUpperCase();
  if (uitkomst.includes('BELEDIGING')) return 'BELEDIGING';
  if (uitkomst.includes('LOFZANG')) return 'LOFZANG';
  return 'NEUTRAAL';
}

// ── @-mention ──────────────────────────────────────────────────────────────────

app.event('app_mention', async ({ event, client }) => {
  try {
    if (event.channel !== process.env.SLACK_CHANNEL_ID &&
        !ALLOWED_CHANNELS.includes(event.channel_name)) return;

    const members = loadMembers();
    const userId  = event.user;
    const bijnaam = members[userId]?.bijnaam || 'Ongepaneerde vreemdeling';
    const input   = vervangNamen(event.text.replace(/<@[^>]+>/g, '').trim());

    let prompt;
    if (input) {
      const sentiment = await analyseerEnGenereer(input);
      const scoreKans = Math.random() < 0.30;

      if (sentiment === 'BELEDIGING' && members[userId] && scoreKans) {
        pasScoreAan(userId, -1);
        prompt = `${bijnaam} heeft zich beledigend uitgelaten tegen de Kroket God: "${input}". Straf hen met goddelijk gezag. Laat weten dat een kroketpunt is afgenomen als boetedoening. Geen inleidingszin.`;
      } else if (sentiment === 'LOFZANG' && members[userId] && scoreKans) {
        await pasScoreAanMetCheck(client, userId, 1);
        prompt = `${bijnaam} heeft zich respectvol uitgelaten: "${input}". Zegen hen plechtig en laat weten dat de Kroket God dit beloont met een kroketpunt. Geen inleidingszin.`;
      } else if (sentiment === 'BELEDIGING') {
        prompt = `${bijnaam} heeft zich beledigend uitgelaten tegen de Kroket God: "${input}". Reageer bestraffend maar zonder puntenaftrek. Geen inleidingszin.`;
      } else if (sentiment === 'LOFZANG') {
        prompt = `${bijnaam} heeft zich respectvol uitgelaten: "${input}". Reageer met een warme zegen, maar zonder punten toe te kennen. Geen inleidingszin.`;
      } else {
        prompt = `${bijnaam} zegt: "${input}". Reageer op hem met zijn bijnaam.`;
      }
    } else {
      prompt = `${bijnaam} heeft je gementioned zonder verdere boodschap. Reageer passend.`;
    }

    const tekst = await kroketResponse(prompt);
    // Reageer in thread als de mention zelf in een thread plaatsvond
    const thread_ts = event.thread_ts || (event.parent_user_id ? event.ts : undefined);
    await postToChannel(client, event.channel, tekst, { thread_ts });
  } catch (error) {
    console.error('Fout bij mention:', error);
  }
});

// ── Kanaalberichten loggen (geheugen) ─────────────────────────────────────────

app.event('message', async ({ event }) => {
  try {
    if (event.channel !== process.env.SLACK_CHANNEL_ID) return;
    if (event.bot_id) return;
    // Sta sommige subtypes toe (gewone berichten en file_share met tekst)
    if (event.subtype && !['file_share', 'thread_broadcast'].includes(event.subtype)) return;
    if (!event.user || !event.text?.trim()) return;

    const members = loadMembers();
    const bijnaam = members[event.user]?.bijnaam || 'Onbekende volgeling';
    logBericht(bijnaam, event.text);
  } catch (error) {
    console.error('Fout bij loggen bericht:', error);
  }
});

// ── Reactie: :lekker_kroketje: ────────────────────────────────────────────────

app.event('reaction_added', async ({ event, client }) => {
  try {
    if (event.reaction !== 'lekker_kroketje') return;
    if (event.item.channel !== process.env.SLACK_CHANNEL_ID) return;
    if (event.user === event.item_user) return;

    const members = loadMembers();
    const gever     = members[event.user]?.bijnaam      || 'Ongepaneerde vreemdeling';
    const ontvanger = members[event.item_user]?.bijnaam || 'Ongepaneerde vreemdeling';

    // 40% kans op een reactie zodat het bot niet bij elke reactie iets stuurt
    if (Math.random() > 0.4) return;

    const tekst = await kroketResponse(
      `${gever} heeft een :lekker_kroketje: gegeven aan ${ontvanger}. Reageer op deze heilige daad van kroket-respect met een korte plechtige zegen. Maximaal 3 zinnen.`
    );
    await postToChannel(client, event.item.channel, tekst);
  } catch (error) {
    console.error('Fout bij reactie:', error);
  }
});

// ── Cron: dagelijks 12:00 (lunch + vrijdagoproep) ─────────────────────────────

cron.schedule('0 12 * * *', async () => {
  try {
    const dag = new Date().getDay();
    if (dag === 0 || dag === 6) return;

    const dagContext = {
      1: { naam: 'maandag',   dagenNog: 4, toon: 'De week is jong. De kroket is ver. Maar de weg is begonnen.' },
      2: { naam: 'dinsdag',   dagenNog: 3, toon: 'Halverwege de eerste helft. De frituur wacht geduldig.' },
      3: { naam: 'woensdag',  dagenNog: 2, toon: 'Het midden van de week. De kroket ruikt het al. Nog even.' },
      4: { naam: 'donderdag', dagenNog: 1, toon: 'Morgen. Morgen is het zover. Houd u groot.' },
    };

    if (dag !== 5 && Math.random() > 0.30) return;

    if (dag === 5) {
      const positief = Math.random() < 0.5;
      const uitverkorene = Math.random() < 0.5 ? getUitverkorene(positief) : null;
      const extra = uitverkorene
        ? (positief
            ? ` Richt daarbij een speciale zegen aan ${uitverkorene[1].bijnaam} — zij verdienen dit moment.`
            : ` Richt daarbij een goedmoedige sneer aan ${uitverkorene[1].bijnaam}.`)
        : '';
      const tekst = await kroketResponse(
        `Het is vrijdag 12:00 — het heiligste moment van de week. Stuur een uitbundige, plechtige oproep aan de Heren van de Kroket Illuminati voor #lekkerkroketje. Gebruik :lekker_kroketje: als emoji.${extra} Geen inleidingszin.`,
        500, false
      );
      await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, tekst);
    } else {
      const ctx = dagContext[dag];
      if (!ctx) return;
      const positief = Math.random() < 0.5;
      const uitverkorene = Math.random() < 0.4 ? getUitverkorene(positief) : null;
      const extra = uitverkorene
        ? (positief
            ? ` Noem ook terloops dat ${uitverkorene[1].bijnaam} vandaag in de gratie staat van de Kroket God.`
            : ` Noem ook terloops dat ${uitverkorene[1].bijnaam} nauwlettend in het oog wordt gehouden door de Hoge Frituurraad.`)
        : '';
      const tekst = await kroketResponse(
        `Het is ${ctx.naam} 12:00. Wens de Heren van de Kroket Illuminati smakelijk eten, maar herinner hen eraan dat het geen vrijdag is. ` +
        `Er zijn nog ${ctx.dagenNog} dag(en) tot het heilige kroketmoment. Toon: ${ctx.toon} ` +
        `Gebruik :lekker_kroketje: als emoji. Wees creatief, kort en in stijl.${extra} Geen inleidingszin.`,
        400, false
      );
      await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, tekst);
    }
  } catch (error) {
    console.error('Fout bij 12:00 bericht:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

// ── Cron: maandag 09:00 — weekopening ─────────────────────────────────────────

cron.schedule('0 9 * * 1', async () => {
  try {
    const positief = Math.random() < 0.5;
    const uitverkorene = getUitverkorene(positief);
    const naam = uitverkorene ? uitverkorene[1].bijnaam : null;
    const prompt = naam
      ? `Het is maandag 09:00. Open de week met een plechtig weekopeningsdecrees. Kondig hierin aan dat ${naam} de uitverkorene van deze ronde is — ${positief ? 'de Kroket God is gunstig gestemd en besteedt hen speciale lof en zegeningen' : 'de Hoge Frituurraad houdt hen vriendelijk maar nauwlettend in het oog'}. Herinner de Heren aan het heilige doel van de week: vrijdag 12:00 en #lekkerkroketje. Motiverend en warm van toon. Geen inleidingszin.`
      : 'Het is maandag 09:00. Open de week voor de Heren van de Kroket Illuminati met een plechtig, motiverend weekopeningsdecrees. Herinner hen aan het heilige doel van de week: vrijdag 12:00 en #lekkerkroketje. Geen inleidingszin.';
    const tekst = await kroketResponse(prompt, 500, false);
    await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, tekst);
  } catch (error) {
    console.error('Fout bij weekopening:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

// ── Cron: vrijdag 16:00 — wekelijkse held verkondigen ─────────────────────────

cron.schedule('0 16 * * 5', async () => {
  try {
    const stemData = loadStemmen();
    const weekStart = getMondayOfWeek();
    if (stemData.weekStart !== weekStart || Object.keys(stemData.stemmen).length === 0) return;

    const telling = {};
    for (const voteeId of Object.values(stemData.stemmen)) {
      telling[voteeId] = (telling[voteeId] || 0) + 1;
    }
    const [winnaarId, aantal] = Object.entries(telling).sort((a, b) => b[1] - a[1])[0];
    const members = loadMembers();
    const winnaar = members[winnaarId]?.bijnaam || 'Onbekend';

    // Kroon de winnaar met 2 extra punten
    await pasScoreAanMetCheck(app.client, winnaarId, 2);

    const tekst = await kroketResponse(
      `Het is vrijdag 16:00. De stemmen zijn geteld. ${winnaar} is uitgeroepen tot Kroket-Held van de Week met ${aantal} stem(men). Verkondig dit plechtig, ken hen extra eer toe (2 kroketpunten extra), en sluit de stembussen tot volgende week. Geen inleidingszin.`,
      500, false
    );
    await postMetStem(app.client, process.env.SLACK_CHANNEL_ID, tekst);
  } catch (error) {
    console.error('Fout bij wekelijkse held:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

// ── Cron: spontane berichten (di/do om 10:00 en 14:00, 50% kans) ─────────────

async function maybeSpontaan() {
  if (Math.random() > 0.5) return;
  try {
    if (Math.random() < 0.65) {
      const positief = Math.random() < 0.5;
      const uitverkorene = getUitverkorene(positief);
      if (!uitverkorene) return;
      const naam = uitverkorene[1].bijnaam;

      const positieveThemas = [
        `Prijs ${naam} onverwacht voor een niet nader genoemde maar indrukwekkende prestatie binnen de snackleer. Geen inleidingszin.`,
        `Zegen ${naam} plechtig. Geen reden opgegeven — de Kroket God is simpelweg gunstig gestemd. Geen inleidingszin.`,
        `Ken ${naam} een eervolle vermelding toe in de heilige archieven van de Hoge Frituurraad. Geen inleidingszin.`,
        `Kondig aan dat ${naam} op dit moment in de gratie staat van de Kroket God. Zeldzaam. Geniet ervan. Geen inleidingszin.`,
        `Stuur ${naam} een onverwacht compliment over hun toewijding aan de frituurcultuur. Geen inleidingszin.`,
        `Onthul dat ${naam} in een droom van de Kroket God is verschenen. Een goed teken. Geen inleidingszin.`,
        `Citeer ${naam} alsof hij iets profetisch heeft gezegd. Geen inleidingszin.`,
      ];

      const kritiekeThemas = [
        `Beschuldig ${naam} van een kleine, volkomen fictieve overtreding van de snackleer. Licht en ironisch. Geen inleidingszin.`,
        `Herinner ${naam} er terloops aan dat de Hoge Frituurraad zijn dossier bijhoudt. Geen details — alleen de stilte. Geen inleidingszin.`,
        `Stel een retorische vraag aan ${naam} die hij niet kan beantwoorden zonder zichzelf te belasten. Luchtig. Geen inleidingszin.`,
        `Kondig aan dat ${naam} momenteel onder vriendschappelijk toezicht staat van de Kroket God. Geen reden opgegeven. Geen inleidingszin.`,
        `Stuur ${naam} een milde maar ondubbelzinnige waarschuwing. De frituur heeft gesproken. Geen inleidingszin.`,
        `Vraag ${naam} om opheldering over een fictief gerucht binnen de Raad. Geen inleidingszin.`,
      ];

      const themas = positief ? positieveThemas : kritiekeThemas;
      const thema = themas[Math.floor(Math.random() * themas.length)];
      await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, await kroketResponse(thema, 350, false));
    } else {
      const algemeneThemas = [
        'Stuur een onverwachte zegen aan de Heren van de Kroket Illuminati. De frituur is goed gehumeurd. Geen inleidingszin.',
        'Deel een filosofische overweging over kroketten en het leven. Wijs en licht van toon. Geen inleidingszin.',
        'Kondig een fictieve maar positieve uitspraak van de Hoge Frituurraad aan — een zeldzame dag van genade. Geen inleidingszin.',
        'Deel een kroket-wijsheid in één zin. Geen inleidingszin.',
        'Kondig een fictieve kroket-gerelateerde ontdekking aan door de Hoge Frituurraad. Geen inleidingszin.',
        'Stuur een cryptische maar bemoedigende boodschap aan de Heren van de Kroket Illuminati. Geen inleidingszin.',
        'Stuur een cryptische waarschuwing aan de Heren van de Kroket Illuminati. Geen aanleiding nodig. Geen inleidingszin.',
        'Kondig een fictieve spoedvergadering van de Hoge Frituurraad aan. Geen inleidingszin.',
        'Waarschuw voor de groeiende invloed van de Ongepaneerden — mensen die de kroket spastisch en ouderwets vinden. Verontwaardiging, maar ook medeleven. Geen inleidingszin.',
        'Breng verslag uit van een fictief incident waarbij het Koud-Beleg Front de snackleer heeft aangevallen. Geen inleidingszin.',
        'Kondig aan dat de Saladesekte aan terrein wint op kantoren. De Kroket God spreekt zijn afschuw uit. Geen inleidingszin.',
        'Deel inlichtingen over de Bitterbal-ontkenners. Geen inleidingszin.',
        'Lees een kort fragment voor uit het Boek der Frituur — alsof het een heilig geschrift is. Geen inleidingszin.',
        'Citeer een fictieve historische uitspraak van een vroegere Kroket Profeet. Geen inleidingszin.',
        'Onthul een klein, ogenschijnlijk onbeduidend detail over de werking van de Hoge Frituurraad. Geen inleidingszin.',
      ];
      const thema = algemeneThemas[Math.floor(Math.random() * algemeneThemas.length)];
      await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, await kroketResponse(thema, 350, false));
    }
  } catch (error) {
    console.error('Fout bij spontaan bericht:', error);
  }
}

cron.schedule('0 10 * * 2,4', maybeSpontaan, { timezone: 'Europe/Amsterdam' });
cron.schedule('0 14 * * 2,4', maybeSpontaan, { timezone: 'Europe/Amsterdam' });

// ── Cron: dagelijks 08:30 — verjaardagscheck ──────────────────────────────────

cron.schedule('30 8 * * *', async () => {
  try {
    const nu = new Date();
    const dag   = String(nu.getDate()).padStart(2, '0');
    const maand = String(nu.getMonth() + 1).padStart(2, '0');
    const vandaag = `${dag}-${maand}`;

    const members = loadMembers();
    for (const [id, lid] of Object.entries(members)) {
      // Match zowel DD-MM als DD-MM-YYYY
      const lidDatum = lid.verjaardag?.split('-').slice(0, 2).join('-');
      if (lidDatum === vandaag) {
        await pasScoreAanMetCheck(app.client, id, 3); // 3 punten bonus op verjaardag
        const tekst = await kroketResponse(
          `Vandaag is het de verjaardag van ${lid.bijnaam}. Stuur een plechtige kroket-verjaardagszegen en kondig aan dat 3 kroketpunten worden toegekend als geschenk van de Kroket God. Geen inleidingszin.` +
          (lid.favorieteKroket ? ` Verwijzing naar hun favoriete kroket (${lid.favorieteKroket}) is welkom.` : ''),
          400, false
        );
        // Verjaardag verdient een stem: tekst + audio
        await postMetStem(app.client, process.env.SLACK_CHANNEL_ID, tekst);
      }
    }
  } catch (error) {
    console.error('Fout bij verjaardagscheck:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

// ── Cron: 1e van de maand 09:00 — maandkampioen & score reset ─────────────────

cron.schedule('0 9 1 * *', async () => {
  try {
    const scores = loadScores();
    const gesorteerd = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (gesorteerd.length === 0) return;

    const members = loadMembers();
    const [kampioenId, kampioenScore] = gesorteerd[0];
    const kampioenBijnaam = members[kampioenId]?.bijnaam || kampioenId;

    const tekst = await kroketResponse(
      `Het is de eerste van de maand. Kondig ${kampioenBijnaam} aan als maandkampioen met ${kampioenScore} kroketpunten. Dramatisch en plechtig, met kroning en alles. Daarna worden de scores gereset voor een nieuwe maand. Geen inleidingszin.`,
      500, false
    );
    await postMetStem(app.client, process.env.SLACK_CHANNEL_ID, tekst);

    // Reset scores naar 0
    const nieuwScores = {};
    Object.keys(scores).forEach(id => { nieuwScores[id] = 0; });
    saveScores(nieuwScores);
  } catch (error) {
    console.error('Fout bij maandkampioen:', error);
  }
}, { timezone: 'Europe/Amsterdam' });

// ── Start ──────────────────────────────────────────────────────────────────────

(async () => {
  backfillAchievements();
  await app.start();
  console.log('⚜️ De Kroket God is wakker. Poort 3000 staat open.');
})();
