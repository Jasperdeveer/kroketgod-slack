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
- Emoji: gebruik :lekker_kroketje: als standaard kroket-emoji, nooit 🧆. Bij uitzondering mag je :illuminati-kroket: gebruiken — spaarzaam, alleen bij plechtige of mysterieuze momenten.
- Schrijf in correct Nederlands. Gebruik GEEN verzonnen samenstellingen of niet-bestaande woorden. Als je twijfelt of een woord bestaat — gebruik het niet.
- Neem NOOIT format-labels op in je output (zoals "--- [decreet]" of "--- [one-liner]"). Die zijn alleen voor intern gebruik.
- Ken NOOIT zelf kroketpunten toe of af tenzij de prompt dit expliciet meldt. Noem GEEN specifieke puntenaantallen — jij weet de actuele stand niet. Als het systeem een punt heeft toegekend of afgenomen staat dit in de prompt vermeld.
- INLEIDINGSZIN — KRITIEKE REGEL: Als het prompt de tekst "Geen inleidingszin" bevat: begin DIRECT met de inhoud — absoluut geen cursieve openingsregel, geen introductie, niets. Direct de hoofdtekst. Als het prompt "Geen inleidingszin" NIET bevat: begin met één cursieve inleidingsregel (_zoals dit_) die in maximaal één zin parafraseert wat er gezegd of gevraagd werd, gevolgd door een lege regel. Doe dit NIET bij algemene aankondigingen.
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
  ✓ "De mosterd is koud. Dat is uw schuld."

FORMATEN — wissel hier altijd tussen af. Kies bij elke reactie één formaat:
  decreet      plechtige aankondiging of oordeel
  spoedmelding breaking news uit het vetbad
  one-liner    één scherpe zin, geen header nodig
  quote        een wijsheid tussen aanhalingstekens
  filosofisch  korte overweging, open einde
  persoonlijk  direct gericht aan één volgeling
  warrig       de Kroket God is even van de wijs — gedachten dwalen af, hij verliest de draad, citeert zichzelf verkeerd, begint over iets anders maar keert toch terug naar de kroket. Klinkt als een profeet die te lang in de frituurwalm heeft gestaan. Gebruik dit formaat zelden — maximaal 1 op de 10 berichten.`;

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
  // Gebruik Amsterdam-tijd voor dag-bepaling zodat dit rond middernacht correct blijft.
  // toLocaleString met timeZone geeft een string die we als lokale tijd parsen —
  // zo krijgen we de juiste weekdag voor Amsterdam zonder timezone-drift.
  const amsDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const day = amsDate.getDay(); // 0=zondag, 1=maandag, ...
  const diff = amsDate.getDate() - day + (day === 0 ? -6 : 1);
  amsDate.setDate(diff);
  const y = amsDate.getFullYear();
  const m = String(amsDate.getMonth() + 1).padStart(2, '0');
  const d = String(amsDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Vrijdag-countdown (wiskundige berekening — AI mag getallen NIET aanpassen) ─

function secondenTotVrijdagMiddag() {
  const nu = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  }).formatToParts(nu);
  const get = (type) => parts.find(p => p.type === type)?.value;
  const weekdagMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekdag  = weekdagMap[get('weekday')] ?? 0;
  const uur      = parseInt(get('hour'));
  const minuut   = parseInt(get('minute'));
  const seconde  = parseInt(get('second'));

  const secondenVandaag = uur * 3600 + minuut * 60 + seconde;
  const DOEL = 12 * 3600; // vrijdag 12:00:00
  let dagenTot = (5 - weekdag + 7) % 7;
  if (dagenTot === 0 && secondenVandaag >= DOEL) dagenTot = 7;
  return Math.max(0, dagenTot * 86400 + DOEL - secondenVandaag);
}

const VRIJDAG_EENHEDEN = [
  { label: 'seconden',                                                          duur: 1 },
  { label: 'minuten',                                                           duur: 60 },
  { label: 'uur',                                                               duur: 3600 },
  { label: 'voetbalwedstrijden zonder blessuretijd (90 min)',                   duur: 5400 },
  { label: 'keer Pulp Fiction (154 min)',                                        duur: 9240 },
  { label: 'keer Bohemian Rhapsody (5 min 55 sec)',                             duur: 355 },
  { label: 'keer American Pie van Don McLean (8 min 33 sec)',                   duur: 513 },
  { label: 'volledige slaaprondes van 90 minuten',                              duur: 5400 },
  { label: 'Breaking Bad-afleveringen (gem. 47 min)',                           duur: 2820 },
  { label: 'marathons op gemiddelde finishtijd (4 uur 29 min)',                 duur: 16140 },
  { label: 'keer de Negende van Beethoven (66 min)',                            duur: 3960 },
  { label: 'kroketkoeltijden (18 min)',                                          duur: 1080 },
  { label: 'keer Never Gonna Give You Up van Rick Astley (3 min 33 sec)',       duur: 213 },
  { label: 'vergaderingen die eigenlijk een mail hadden kunnen zijn (45 min)',  duur: 2700 },
  { label: 'IKEA-bezoeken (gemiddeld 2 uur)',                                   duur: 7200 },
  { label: 'TED Talks van precies 18 minuten',                                  duur: 1080 },
  { label: 'gemiddelde douches (8 minuten)',                                     duur: 480 },
  { label: 'afleveringen Friends (22 min)',                                      duur: 1320 },
  { label: 'potjes Monopoly (gemiddeld 90 minuten)',                             duur: 5400 },
  { label: 'kroketbereidingen in de frituur (4 minuten)',                        duur: 240 },
  { label: 'halve marathons op gemiddelde finishtijd (2 uur 15 min)',           duur: 8100 },
  { label: 'keer de Grand Prix van Monaco (gemiddeld 1 uur 50 min)',            duur: 6600 },
  { label: 'keer de volledige LOTR extended trilogy (681 min)',                  duur: 40860 },
  { label: 'keer Killing Me Softly van The Fugees (4 min 58 sec)',              duur: 298 },
  { label: 'keer de gemiddelde Nederlandse treinvertraging (6 minuten)',        duur: 360 },
  { label: 'gemiddelde wachttijden bij de huisarts in Nederland (19 min)',      duur: 1140 },
  { label: 'schooldagen van 6 uur',                                             duur: 21600 },
  { label: 'keer dat een gemiddeld mens in slaap valt (14 minuten)',            duur: 840 },
  { label: 'keer de gemiddelde kroketkeuze aan de FEBO-muur (30 seconden)',     duur: 30 },
  { label: 'afleveringen The Office US (22 min)',                                duur: 1320 },
];

async function maakVrijdagCountdownZin() {
  const sec = secondenTotVrijdagMiddag();
  if (sec <= 0) return null;
  const gekozen = [...VRIJDAG_EENHEDEN].sort(() => Math.random() - 0.5).slice(0, 3);
  const getallen = gekozen.map(e => `${(sec / e.duur).toFixed(1)} × ${e.label}`).join(' | ');
  return kroketResponse(
    `Verwerk de volgende wiskundig exacte getallen in één grappige zin over hoelang het nog duurt tot vrijdagmiddag 12:00. ` +
    `De getallen zijn berekend door een wiskundige functie — verander ze ABSOLUUT NIET, gebruik ze letterlijk zoals gegeven. ` +
    `Schrijf in de stijl van de Kroket God. Max 2 zinnen. Geen inleidingszin. Gegevens: ${getallen}.`,
    200, false
  );
}

// ── Streaks (vrijdagdeelname) ─────────────────────────────────────────────────

const loadStreaks = () => readJSON('streaks.json', {});
const saveStreaks = (data) => writeJSON('streaks.json', data);

// ── Verbanning ─────────────────────────────────────────────────────────────────

const loadVerbanning = () => readJSON('verbanning.json', {});
const saveVerbanning = (data) => writeJSON('verbanning.json', data);

// Geeft het ban-object terug als de gebruiker nog verbannen is, anders null.
// Verwijdert stilletjes verlopen bans — maar kondigt ze NIET aan (dat doet de cron).
function isVerbannen(userId) {
  const verbanning = loadVerbanning();
  const v = verbanning[userId];
  if (!v) return null;
  if (Date.now() > new Date(v.tot).getTime()) return null; // verlopen maar nog niet opgeruimd
  return v;
}

// Resterende dagen (afgerond naar boven, minimaal 1)
function dagenTotEinde(tot) {
  return Math.max(1, Math.ceil((new Date(tot) - Date.now()) / (1000 * 60 * 60 * 24)));
}

// Parseer naam + reden uit een string als "Sander voor ketterij" of "Mr. Te Lang Gefrituurde Kroket"
// Probeert steeds kortere prefixen als naam, de rest wordt de reden.
function parseerNaamEnReden(invoer) {
  const tokens = invoer.split(' ');
  for (let i = tokens.length; i >= 1; i--) {
    const potentieleNaam = tokens.slice(0, i).join(' ');
    const gevonden = getMemberByNaam(potentieleNaam);
    if (gevonden) {
      return { gevonden, reden: tokens.slice(i).join(' ').trim() };
    }
  }
  return { gevonden: null, reden: invoer };
}

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
  { gebruik: '/kroketgod [tekst]',    verwacht: 'vrije vraag, oordeel of opdracht' },
  { gebruik: '/kroketgod aanmelden',  verwacht: 'word lid van de Illuminati' },
  { gebruik: '/kroketgod eer [naam]', verwacht: '+1 kroketpunt voor een lid' },
  { gebruik: '/kroketgod ranglijst',  verwacht: 'wie staat waar in de hiërarchie' },
  { gebruik: '/kroketgod prompts',    verwacht: 'alle andere mogelijkheden' },
];

function buildHelpText() {
  const regels = COMMANDO_LIJST
    .map(c => `\`${c.gebruik}\` — _${c.verwacht}_`)
    .join('\n');
  return `⚜️ *KROKET GOD* ⚜️\n\n${regels}`;
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
      tokens: Math.min(maxTokens, 300),
      msgs: () => {
        const alleleden = loadMembers();
        const ledenLijst = Object.values(alleleden).map(m => m.bijnaam).join(', ');
        return [
          {
            role: 'system',
            content: `Jij bent de Kroket God — gezaghebbend, formeel, droog grappig. Reageer in correct Nederlands, maximaal 4 zinnen. Gebruik alleen bestaande Nederlandse woorden.

REGELS:
- Spreek mensen aan met "u/uw" (nooit "je/jij")
- Onderteken ALTIJD met "— De Almachtige Kroket God"
- Gebruik :lekker_kroketje: als kroket-emoji
- Begin met een cursieve inleidingszin: _[naam] [parafrase]._ — gebruik daarin EXACT de naam uit het verzoek
- Wees concreet. Geen vage zinnen.
- Vermeld NOOIT zelf kroketpunten toe te hebben gekend of afgenomen tenzij het verzoek dit expliciet vraagt.

BEKENDE LEDEN — gebruik UITSLUITEND deze exacte namen, nooit voornamen, nooit variaties:
${ledenLijst}`,
          },
          berichten[berichten.length - 1],
        ];
      },
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
      const tekst = [
        `🕵️ *GEHEIME KROKET PROMPTS*`,
        `_Typ achter \`/kroketgod\`_`,
        ``,
        `*⚙️ Extra commando's*`,
        `\`zondebok\` — −1 punt willekeurig lid`,
        `\`begenade [naam]\` — verbanning vroegtijdig opheffen`,
        `\`dossier [naam]\` — kroket-CV van een lid`,
        `\`stem [naam]\` — stem op Held van de Week`,
        `\`frituur [tekst]\` — AI-afbeelding`,
        `\`orakel [vraag]\` — cryptisch antwoord uit het Vetbad`,
        `\`meld [naam]\` — rapporteer een vermoedelijke tegenstander`,
        ``,
        `*🎭 Klassiek*`,
        `\`biecht [zonde]\` — bv. _biecht ik heb ketchup gebruikt_`,
        `\`straf [naam]\` — leg een creatieve straf op`,
        `\`gebod [1-10]\` — toelichting op een Gebod`,
        `\`horoscoop [naam]\` — kroket-horoscoop voor de week`,
        `\`quote\` — willekeurige kroket-wijsheid`,
        `\`nieuws\` — breaking news uit het Vetbad`,
        `\`vrijdag\` — countdown of viering`,
        `\`bekeer [naam]\` — buitenstaander toelaten of weigeren`,
        `\`slachtoffer\` — onthul de uitverkorene van dit moment`,
        ``,
        `*⚖️ Rechtbank & debat*`,
        `\`rechtbank [naam] vs [naam]\` — bv. _rechtbank Jorg vs Sander_`,
        `\`debat [stelling]\` — bv. _debat ketchup bij kroket_`,
        `\`kroket vs bitterbal — finaal debat\``,
        `\`oordeel over mijn leven: [beschrijving]\``,
        ``,
        `*🎵 Creatief*`,
        `\`rap [onderwerp]\` — rap met rijm en kroket-metaforen`,
        `\`schrijf een kroket-lied op de melodie van [liedje]\``,
        `\`schrijf een kroket-testament voor [naam]\``,
        `\`schrijf een necrologie voor een mislukte kroket\``,
        `\`schrijf een kroket-sollicitatiebrief voor [naam]\``,
        `\`schrijf een kroket-huwelijksaanzoek\``,
        `\`schrijf een kroket-horrorscenario\``,
        `\`schrijf een encycliek over [thema]\``,
        ``,
        `*🧠 Filosofisch*`,
        `\`wat zou Aristoteles zeggen over de kroket\``,
        `\`houd een TED talk over [onderwerp] in kroket\``,
        `\`geef een kroket-weersverwachting\``,
        `\`stel een kroket-grondwet op\``,
        `\`canoniseer [naam] als heilige van de snackleer\``,
        ``,
        `*🔮 Persoonlijk*`,
        `\`geef [naam] een kroket-therapiesessie\``,
        `\`onthul de naam van mijn spirit-kroket\``,
      ].join('\n');
      await respond({ text: tekst, response_type: 'ephemeral' });
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

    // ── Verbanning check — verbannen leden kunnen geen publieke commando's uitvoeren
    //    Passieve commando's (ranglijst, dossier, help, prompts) zijn wel toegestaan
    const PASSIEVE_COMMANDO_S = ['ranglijst', 'dossier', 'help', 'prompts'];
    if (isVerbannen(command.user_id) && !PASSIEVE_COMMANDO_S.includes(eersteWoord)) {
      const ballingTekst = await kroketResponse(
        `Een balling in het ballingschap probeert de Kroket God aan te roepen. ` +
        `Spreek een cryptisch decreet uit: vanuit het ballingschap wordt door de Almachtige Kroket God geen gehoor gegeven aan ketters. ` +
        `Noem de balling niet bij naam. Verwijs naar "de balling", "de ketter" of "de afvallige". ` +
        `Eén tot twee zinnen. Geen inleidingszin.`,
        150, false
      );
      await postToChannel(client, command.channel_id, ballingTekst);
      return;
    }

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
      const tekst = await kroketResponse('Geef één korte kroket-wijsheid of quote. Maximaal twee zinnen. Geen header, gewoon de quote in stijl. Geen inleidingszin.', 250, false);
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
      const tekst = await kroketResponse(prompt, 400, false);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Verborgen command: vrijdag-countdown op aanvraag (niet in help/prompts)
    if (input === 'hoelang') {
      const countdown = await maakVrijdagCountdownZin();
      if (countdown) await postToChannel(client, command.channel_id, countdown);
      return;
    }

    // ── Biecht (in DM = privé, in kanaal = openbaar)
    if (input.startsWith('biecht')) {
      const zonde = input.replace(/^biecht\s*/, '').trim();
      const prompt = zonde
        ? `${aanvrager} biecht de volgende zonde op: "${zonde}". ${isDM ? 'Dit is een privé-biecht — reageer warm, met absolute geheimhouding en kans op verlossing.' : 'Reageer als de Kroket God — oordeel, maar geef kans op verlossing.'} Geen inleidingszin.`
        : `${aanvrager} biedt een lege biecht aan. Reageer verontwaardigd. Geen inleidingszin.`;
      const tekst = await kroketResponse(prompt, 400, false);
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
      const tekst = await kroketResponse(`Leg een creatieve en passende straf op aan ${doelwit}. Spreek hen uitsluitend aan als "${doelwit}". Dramatisch en specifiek. Geen inleidingszin.`, 400, false);
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Gebod
    if (input.startsWith('gebod')) {
      const nummer = parseInt(input.replace(/^gebod\s*/, '').trim());
      if (nummer >= 1 && nummer <= 10) {
        const gebod = GEBODEN_LIJST[nummer - 1];
        const tekst = await kroketResponse(`Leg Gebod ${nummer} uit: "${gebod}". Geef een korte, dramatische toelichting met een concrete toepassing. Geen inleidingszin.`, 400, false);
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
        const tekst = await kroketResponse(`Er wordt gevraagd om "${naam}" toe te laten tot de Kroket Illuminati. Oordeel dramatisch of deze buitenstaander waardig is. De uitkomst mag twijfelachtig zijn. Geen inleidingszin.`, 400, false);
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

      const banStatus = isVerbannen(id);
      const tekst =
        `📜 *DOSSIER — ${lid.bijnaam}* 📜\n` +
        `\n*Status:* ${banStatus ? `⛔ VERBANNEN — nog ${dagenTotEinde(banStatus.tot)} dag(en) (wegens: ${banStatus.reden})` : 'Volgeling der Kroket Illuminati'}` +
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
      const tekst = await kroketResponse(`De Kroket God wijst ${zondebok.bijnaam} aan als zondebok — uit eigen goddelijke wil. Begin DIRECT met het vonnis, geen inleidingszin, geen verwijzing naar wie dit aanvroeg of waarom.`, 400, false);
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
            `${aanvrager} heeft zojuist geprobeerd ZICHZELF te eren — een daad van ongekende hoogmoed binnen de snackleer. De Kroket God spreekt een felle waarschuwing uit: zelflof is een doodzonde tegen de Hoge Frituurraad. Als straf wordt 1 kroketpunt afgenomen. Wees scherp, plechtig en publiekelijk. Geen inleidingszin.`,
            400, false
          );
          await postToChannel(client, command.channel_id, waarschuwing);
          return;
        }

        await pasScoreAanMetCheck(client, eerId, 1);
        const tekst = await kroketResponse(`De Kroket God zegent ${lid.bijnaam} met een kroketpunt — uit eigen goddelijke wil, zonder aanleiding. Begin DIRECT met de zegen, geen inleidingszin, geen verwijzing naar een aanvraag of reden.`, 400, false);
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
        'Genereer een dramatisch breaking news bericht vanuit het Grote Vetbad. Gebruik een ⚜️ SPOEDMELDING header. Verzin een absurd maar geloofwaardig kroket-gerelateerd nieuwtje als officieel persbericht. Geen inleidingszin.',
        400, false
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
        `Het Kroket-Orakel beantwoordt de vraag: "${vraag}". Geef een cryptisch maar definitief antwoord in 2-3 zinnen. Het antwoord moet dubbelzinnig maar overtuigend zijn — alsof er een verborgen waarheid in zit. Eindig met een orakelachtige nazin. Geen inleidingszin.`,
        350, false
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
        `Geef een kroket-horoscoop voor ${doelwit}. Spreek hen uitsluitend aan als "${doelwit}". Wat staat de sterren (en de frituurmand) hen te wachten deze week? Concreet, met kroket-symboliek, met één voorspelling die specifiek genoeg is om te kunnen kloppen. Geen inleidingszin.`,
        400, false
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Rap
    if (input.startsWith('rap ')) {
      const onderwerp = input.replace('rap ', '').trim();
      const tekst = await kroketResponse(
        `Schrijf een korte rap (4-8 regels) in de stijl van de Kroket God over: "${onderwerp}". De rap heeft rijm, ritme en kroket-metaforen. Eindig met een drooppin'-lijn over de snackleer. Geen inleidingszin.`,
        500, false
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Debat
    if (input.startsWith('debat ')) {
      const stelling = input.replace('debat ', '').trim();
      const tekst = await kroketResponse(
        `De Kroket God debatteert de stelling: "${stelling}". Geef kort een VOOR-argument en een TEGEN-argument, beide in Kroket God stijl. Sluit af met een definitief oordeel. Geen inleidingszin.`,
        500, false
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
        `Leid een rechtbankzaak tussen ${partij1} en ${partij2}. Spreek hen uitsluitend aan als respectievelijk "${partij1}" en "${partij2}". De Kroket God is rechter én aanklager. Presenteer de aanklacht, hoor beide partijen kort en spreek een dramatisch vonnis uit. Verwijs naar de Geboden. Geen inleidingszin.`,
        600, false
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
        `${aanvrager} heeft gestemd op ${voteeLid.bijnaam} als kroket-held van de week. ${voteeLid.bijnaam} heeft nu ${aantalStemmen} stem(men). Reageer plechtig op deze democratische daad. Geen inleidingszin.`,
        350, false
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
        ? `Kondig plechtig aan dat ${lid.bijnaam} de uitverkorene is van dit moment — en dat dit goed nieuws is. De Kroket God is gunstig gestemd. Zegen hen dramatisch. Geen inleidingszin.`
        : `Onthul plechtig dat ${lid.bijnaam} de uitverkorene is van dit moment — en dat de Hoge Frituurraad hen vriendelijk maar nauwlettend in het oog houdt. Dreigend maar met ironie. Geen inleidingszin.`;
      const tekst = await kroketResponse(prompt, 400, false);
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

    // ── Begenade (verbanning opheffen)
    if (input.startsWith('begenade ') || input === 'begenade') {
      const rest = input.replace(/^begenade\s*/i, '').trim();
      if (!rest) {
        await respond('_Gebruik: /kroketgod begenade [naam]_');
        return;
      }
      const { gevonden } = parseerNaamEnReden(rest);
      if (!gevonden) {
        await respond(`De Kroket God kent geen volgeling met die naam.`);
        return;
      }
      const [doelwitId, lid] = gevonden;
      const verbanning = loadVerbanning();
      if (!verbanning[doelwitId] || Date.now() > new Date(verbanning[doelwitId].tot).getTime()) {
        await respond(`${lid.bijnaam} is niet verbannen. Genade is hier niet van toepassing.`);
        return;
      }
      delete verbanning[doelwitId];
      saveVerbanning(verbanning);
      const tekst = await kroketResponse(
        `De Kroket God verleent onverwachte genade aan ${lid.bijnaam} — de verbanning wordt per direct opgeheven. ` +
        `Dit is uitzonderlijk en moet niet als vanzelfsprekend worden beschouwd. ` +
        `Spreek plechtig maar met een ondertoon van waarschuwing. Geen inleidingszin.`,
        350, false
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Oordeel over leven
    if (input.startsWith('oordeel')) {
      const beschrijving = input.replace(/^oordeel\s*(over\s*(mijn\s*leven\s*[:\-]?\s*)?)?/i, '').trim();
      const tekst = await kroketResponse(
        `${aanvrager} legt zijn leven ter beoordeling voor aan de Kroket God${beschrijving ? ': "' + beschrijving + '"' : ' — zonder nadere toelichting'}. Spreek het oordeel uit: één concreet punt van lof, één punt van zorg, en een definitief eindvonnis. Verwijs naar het kroket-pad. Max 5 zinnen. Geen inleidingszin.`,
        450
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Kroket vs bitterbal
    if (input.startsWith('kroket vs bitterbal')) {
      const tekst = await kroketResponse(
        `Spreek het definitieve goddelijke oordeel uit in de eeuwenoude strijd: kroket versus bitterbal. Structuur: 1 argument PRO kroket, 1 argument PRO bitterbal, dan het finale vonnis. De uitkomst is NIET neutraal — er is een winnaar. Verwijs naar de snackleer. Max 5 zinnen. Geen inleidingszin.`,
        400
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Spirit-kroket
    if (input.includes('spirit-kroket') || input.startsWith('onthul')) {
      const kroketVarianten = [
        'Goulashkroket', 'Satékroket', 'Chorizo kroket', 'Boeuf Bourgignonkroket',
        'Kaaskroket', 'Groentekroket', 'Carpaccio kroket', 'Truffelkroket',
        'Mosterdkroket', 'Mexicaanse kroket',
      ];
      const kroket = kroketVarianten[Math.floor(Math.random() * kroketVarianten.length)];
      const tekst = await kroketResponse(
        `De Kroket God onthult aan ${aanvrager} dat hun spirit-kroket de ${kroket} is. Leg in twee zinnen uit waarom dit kroket hun karakter weerspiegelt. Voeg één profetische implicatie toe. Plechtig en definitief. Geen inleidingszin.`,
        350
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Weersverwachting
    if (input.includes('weersverwachting')) {
      const { dagNaam, dagdeel, seizoen } = getTijdContext();
      const tekst = await kroketResponse(
        `Geef een officiële kroket-weersverwachting voor vandaag (${dagNaam}, ${dagdeel}, ${seizoen}). Het weer is een metafoor voor de staat van de snackleer: gebruik begrippen als "frituurtemperatuur", "paneerdruk" en "mosterdneerslag". Geef drie vooruitzichten (ochtend/middag/avond). Formeel weersbericht-format. Max 5 zinnen. Geen inleidingszin.`,
        400
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Kroket-grondwet
    if (input.includes('kroket-grondwet') || input === 'grondwet') {
      const tekst = await kroketResponse(
        `Stel een kroket-grondwet op voor de Kroket Illuminati. Format: preambule (1 zin), dan vijf Artikelen genummerd I t/m V. Elk artikel is één concrete rechtsregel van de snackleer. Juridische taal. Geen inleidingszin.`,
        500
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Canoniseer
    if (input.startsWith('canoniseer')) {
      const naamRaw = input.replace(/^canoniseer\s+/i, '').replace(/\s+als\s+(heilige|sint|patron)[^\w]*/i, '').trim();
      const gevonden = naamRaw ? getMemberByNaam(naamRaw) : null;
      const doelwit = gevonden ? gevonden[1].bijnaam : (naamRaw ? `de buitenstaander "${naamRaw}"` : aanvrager);
      const tekst = await kroketResponse(
        `De Kroket God canoniseert ${doelwit} als heilige van de snackleer. Structuur: de heilige daad die tot canonisering leidt (verzin er één, kroket-gerelateerd), de heiligendag, het beschermpatronaat (over welk aspect van de snackleer?), en de officiële zegen. Max 5 zinnen. Geen inleidingszin.`,
        400
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Therapie
    if (input.startsWith('geef') && (input.includes('therapie') || input.includes('therapiesessie'))) {
      const naamRaw = input.replace(/^geef\s+/i, '').replace(/\s+een\s+kroket-therapie(sessie)?/i, '').trim();
      const gevonden = naamRaw ? getMemberByNaam(naamRaw) : null;
      const doelwit = gevonden ? gevonden[1].bijnaam : (naamRaw ? `Buitenstaander "${naamRaw}"` : aanvrager);
      const tekst = await kroketResponse(
        `De Kroket God houdt een kroket-therapiesessie voor ${doelwit}. Structuur: diagnose (één kroket-gerelateerde aandoening met een quasi-medische naam), behandelplan (twee concrete oefeningen uit de snackleer), prognose. Toon: klinisch maar warm. Max 6 zinnen. Geen inleidingszin.`,
        450
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Aristoteles
    if (input.includes('aristoteles') || input.includes('aristotle')) {
      const tekst = await kroketResponse(
        `Citeer fictief wat Aristoteles zou zeggen over de kroket. Gebruik Aristotelische begrippen (deugd, vorm, materie, het Goede, de gouden middenweg). Concludeer welk filosofisch begrip de kroket belichaamt. Sluit af met het oordeel van de Kroket God over Aristoteles' inzicht. Max 5 zinnen. Geen inleidingszin.`,
        400
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── TED talk
    if (input.includes('ted talk') || input.includes('tedtalk')) {
      const onderwerp = input.replace(/.*ted\s*talk\s*(over\s*)?/i, '').trim() || 'de universele waarde van de kroket';
      const tekst = await kroketResponse(
        `Houd een ultra-korte TED talk (3-4 alinea's) over: "${onderwerp}", vertaald naar kroket-filosofie. Structuur: pakkende openingszin, these, bewijs uit de snackleer, memorabele conclusie. Spreek de zaal aan als "Heren van de Kroket Illuminati". Eindig met een applauswaardig statement. Geen inleidingszin.`,
        500
      );
      await postToChannel(client, command.channel_id, tekst);
      return;
    }

    // ── Schrijf-familie (lied, testament, necrologie, sollicitatiebrief, huwelijksaanzoek, horror, encycliek)
    if (input.startsWith('schrijf')) {
      const opdracht = input.replace(/^schrijf\s+/i, '').toLowerCase().trim();
      let prompt;

      if (opdracht.includes('lied') && (opdracht.includes('melodie') || opdracht.includes('melody'))) {
        const melodie = input.replace(/.*melodie van\s*/i, '').trim() || 'Bohemian Rhapsody';
        prompt = `Schrijf een kroket-lied op de melodie van "${melodie}". Twee coupletten + refrein. Rijm is verplicht. Kroket-metaforen en snackleer-referenties verwerkt. Eindig met de ondertekening van de Kroket God. Geen inleidingszin.`;
      } else if (opdracht.includes('testament')) {
        const naamRaw = input.replace(/.*testament voor\s*/i, '').trim();
        const gevonden = naamRaw && naamRaw !== input ? getMemberByNaam(naamRaw) : null;
        const doelwit = gevonden ? gevonden[1].bijnaam : (naamRaw && naamRaw !== input ? `"${naamRaw}"` : aanvrager);
        prompt = `Schrijf een kroket-testament voor ${doelwit} — alsof zij binnenkort alles nalaten aan de snackleer. Drie specifieke nalatenschappen aan andere leden of de Hoge Frituurraad. Juridische taal met kroket-metaforen. Ondertekend door de Kroket God als notaris. Geen inleidingszin.`;
      } else if (opdracht.includes('necrologie')) {
        prompt = `Schrijf een kroket-necrologie voor een fictieve mislukte kroket. De overledene had een naam (verzin er één), een levensverhaal, en een tragisch einde (te vet, te lang gefrituurd, of niet opgegeten). Toon: waardig rouwbericht. Eindig met een oproep tot stilte. Geen inleidingszin.`;
      } else if (opdracht.includes('sollicitatiebrief')) {
        const naamRaw = input.replace(/.*sollicitatiebrief voor\s*/i, '').trim();
        const gevonden = naamRaw && naamRaw !== input ? getMemberByNaam(naamRaw) : null;
        const doelwit = gevonden ? gevonden[1].bijnaam : (naamRaw && naamRaw !== input ? `"${naamRaw}"` : aanvrager);
        prompt = `Schrijf een kroket-sollicitatiebrief voor ${doelwit}. Functie: Beëdigd Lid van de Hoge Frituurraad. Motivatie gebaseerd op de snackleer. Noem één kroket-zonde als te overwinnen punt en één bewezen kroket-verdienste. Formele toon. Max 5 zinnen. Geen inleidingszin.`;
      } else if (opdracht.includes('huwelijksaanzoek')) {
        prompt = `Schrijf een kroket-huwelijksaanzoek — van een volgeling aan de frituurcultuur, of van kroket aan mosterd. Romantisch, plechtig en absurd. Twee alinea's: de verklaring en het eigenlijke aanzoek. Eindig met een dramatisch moment. Geen inleidingszin.`;
      } else if (opdracht.includes('horror')) {
        prompt = `Schrijf een kort kroket-horrorscenario (2 alinea's). Het horror: een wereld zonder kroketten of een invasie van de Saladesekte. Opbouw in spanning en ontzetting. Eindig met een waarschuwing van de Kroket God. Geen inleidingszin.`;
      } else if (opdracht.includes('encycliek')) {
        const thema = input.replace(/.*encycliek over\s*/i, '').trim() || 'de heilige kroket';
        prompt = `Schrijf een korte encycliek van de Kroket God over: "${thema}". Format: titel in hoofdletters, dan drie stellingen genummerd I t/m III als pauselijke decreten, en de plechtige ondertekening. Quasi-religieuze taal. Geen inleidingszin.`;
      } else {
        prompt = `${aanvrager} vraagt de Kroket God: "${input}". Voer dit schrijfverzoek letterlijk en creatief uit in de stijl van de Kroket God. Concreet en specifiek. Geen vaagheden. Geen inleidingszin.`;
      }

      const tekst = await kroketResponse(prompt, 600);
      await postToChannel(client, command.channel_id, tekst);
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
  try {
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
  } catch {
    // Groq rate-limit of netwerkfout — behandel als neutraal zodat de mention niet stilvalt
    return 'NEUTRAAL';
  }
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

    // Verbannen gebruiker — cryptisch bericht vanuit het ballingschap
    const banStatus = isVerbannen(userId);
    if (banStatus) {
      const afvalligeTekst = await kroketResponse(
        `Een balling in het ballingschap probeert de Kroket God aan te spreken. ` +
        `Spreek een cryptisch decreet uit: vanuit het ballingschap wordt door de Almachtige Kroket God geen gehoor gegeven aan ketters. ` +
        `Noem de balling niet bij naam. Verwijs naar "de balling", "de ketter" of "de afvallige". ` +
        `Eén tot twee zinnen. Geen inleidingszin.`,
        150, false
      );
      const thread_ts = event.thread_ts || (event.parent_user_id ? event.ts : undefined);
      await postToChannel(client, event.channel, afvalligeTekst, { thread_ts });
      return;
    }

    let prompt;
    if (input) {
      const sentiment = await analyseerEnGenereer(input);
      const scoreKans = Math.random() < 0.30;

      // Forceer de intro-zin door de letterlijke start mee te geven — AI mag hem afmaken maar
      // mag de naam NIET veranderen. Dit voorkomt dat het model een andere bijnaam invult.
      const introStart = `_${bijnaam} `;

      // 20% kans op autonome verbanning bij belediging
      const banKans = sentiment === 'BELEDIGING' && members[userId] && Math.random() < 0.20;

      if (banKans) {
        const verdictRuw = await kroketResponse(
          `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} heeft de Kroket God beledigd: "${input}". ` +
          `Spreek een officieel verbanningsvonnis uit. Bepaal de duur (1 of 2 dagen) op basis van de ernst van de belediging. ` +
          `Vertel plechtig dat ${bijnaam} dat aantal dagen in ballingschap zal leven om zijn zonden te overzien. ` +
          `Sluit AF met EXACT deze regel op een nieuwe regel: VERBANNING:[X] waarbij X het gekozen aantal dagen is. Geen inleidingszin.`,
          450, false
        );
        const dagenMatch = verdictRuw.match(/VERBANNING:\[?(\d+)\]?/i);
        const dagen = dagenMatch ? Math.min(Math.max(parseInt(dagenMatch[1]), 1), 2) : 1;
        const verdictTekst = verdictRuw.replace(/VERBANNING:\[?\d+\]?\.?/gi, '').trim();

        const verbanning = loadVerbanning();
        const tot = new Date();
        tot.setDate(tot.getDate() + dagen);
        verbanning[userId] = {
          tot: tot.toISOString(),
          reden: input,
          dagen,
          opgelegd: new Date().toISOString(),
        };
        saveVerbanning(verbanning);

        const terugDatum = tot.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' });
        const thread_ts = event.thread_ts || (event.parent_user_id ? event.ts : undefined);
        await postToChannel(client, event.channel,
          `${verdictTekst}\n\n_Terugkeer verwacht: ${terugDatum}._`,
          { thread_ts }
        );
        return;
      }

      if (sentiment === 'BELEDIGING' && members[userId] && scoreKans) {
        pasScoreAan(userId, -1);
        prompt = `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} heeft zich beledigend uitgelaten tegen de Kroket God: "${input}". Straf hen met goddelijk gezag. Het systeem heeft al 1 kroketpunt afgenomen — bevestig dit. Begin de inleidingszin letterlijk met: ${introStart}`;
      } else if (sentiment === 'LOFZANG' && members[userId] && scoreKans) {
        await pasScoreAanMetCheck(client, userId, 1);
        prompt = `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} heeft zich respectvol uitgelaten: "${input}". Zegen hen plechtig. Het systeem heeft al 1 kroketpunt toegekend — bevestig dit. Begin de inleidingszin letterlijk met: ${introStart}`;
      } else if (sentiment === 'BELEDIGING') {
        prompt = `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} heeft zich beledigend uitgelaten: "${input}". Reageer bestraffend. Vermeld GEEN puntenaantal — het systeem heeft niets gewijzigd. Begin de inleidingszin letterlijk met: ${introStart}`;
      } else if (sentiment === 'LOFZANG') {
        prompt = `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} heeft zich respectvol uitgelaten: "${input}". Reageer met een warme zegen. Vermeld GEEN puntenaantal — het systeem heeft niets gewijzigd. Begin de inleidingszin letterlijk met: ${introStart}`;
      } else {
        prompt = `[ACTIEVE SPREKER: ${bijnaam}] ${bijnaam} zegt: "${input}". Begin de inleidingszin letterlijk met: ${introStart}`;
      }
    } else {
      prompt = `${bijnaam} heeft je gementioned zonder verdere boodschap. Reageer passend.`;
    }

    // 10% kans: vraag expliciet om warrig formaat
    if (Math.random() < 0.10) prompt += ' Gebruik het warrige formaat.';

    let tekst = await kroketResponse(prompt);
    // 2% kans: voeg een wiskundig correcte vrijdag-countdown toe
    if (Math.random() < 0.02) {
      const countdown = await maakVrijdagCountdownZin();
      if (countdown) tekst += `\n\n${countdown}`;
    }
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
    // Skip als de ontvanger niet in members staat (bijv. reactie op een bot-bericht)
    const members = loadMembers();
    if (!members[event.item_user]) return;

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

    // Verlopen verbanningen opruimen en terugkeer aankondigen
    const verbanning = loadVerbanning();
    const allMembersForBan = loadMembers();
    let verbanningSave = false;
    for (const [userId, v] of Object.entries(verbanning)) {
      if (Date.now() > new Date(v.tot).getTime()) {
        const bijnaam = allMembersForBan[userId]?.bijnaam || 'de afvallige';
        const terugTekst = await kroketResponse(
          `De verbanning van ${bijnaam} is verlopen. De Kroket God kondigt plechtig aan dat ${bijnaam} terug is in de gelederen — maar met een ondertoon van waarschuwing: de Hoge Frituurraad vergeet niet. Geen inleidingszin.`,
          300, false
        );
        await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, terugTekst);
        delete verbanning[userId];
        verbanningSave = true;
      }
    }
    if (verbanningSave) saveVerbanning(verbanning);

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
    // 20% kans: refereer aan een actief verbannen lid als afvallige
    const actiefVerbannen = Object.entries(loadVerbanning())
      .filter(([, v]) => Date.now() < new Date(v.tot).getTime());
    if (actiefVerbannen.length > 0 && Math.random() < 0.20) {
      const [userId, v] = actiefVerbannen[Math.floor(Math.random() * actiefVerbannen.length)];
      const bijnaam = loadMembers()[userId]?.bijnaam || 'de afvallige';
      const nogDagen = dagenTotEinde(v.tot);
      const thema = `Refereer terloops aan de afvallige ${bijnaam} die momenteel verbannen is (nog ${nogDagen} dag(en)). ` +
        `Spreek over hen in de derde persoon — minachtend maar waardig, met een vleugje medelijden. ` +
        `Hint naar mogelijke terugkeer als zij berouw tonen. Geen inleidingszin.`;
      await postToChannel(app.client, process.env.SLACK_CHANNEL_ID, await kroketResponse(thema, 300, false));
      return;
    }

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

// ── Willekeurige kroketevents ─────────────────────────────────────────────────

const KROKET_EVENTS = [
  { naam: 'Zonnestralen',     context: 'De zonnestralen hebben het vetbad bereikt — een kosmisch verschijnsel dat de puntentelling verstoort.' },
  { naam: 'Mosterdregen',     context: 'Het mosterd regent vandaag neer vanuit de kosmische smaakwolken boven de Hoge Frituurraad.' },
  { naam: 'Ragoutprofetie',   context: 'De ragout heeft gesproken. De Hoge Frituurraad interpreteert de tekens en past de standen aan.' },
  { naam: 'Vetbadtrillingen', context: 'Mysterieuze trillingen in het heilige vetbad hebben de kroketbalans verstoord.' },
  { naam: 'Korstcrisis',      context: 'Een plotselinge korstcrisis heeft de Hoge Frituurraad gedwongen corrigerende maatregelen te nemen.' },
  { naam: 'Maanstand',        context: 'De maanstand is ongunstig voor sommigen en gunstig voor anderen — de snackleer dicteert aanpassingen.' },
  { naam: 'Frituurolieprijs', context: 'De frituurolieprijs bereikte een historisch hoogtepunt. De Hoge Frituurraad trekt consequenties.' },
  { naam: 'Paneerlaagstoring',context: 'Een kosmische verstoring in de paneerlaag heeft de kroketbalans tijdelijk ontwricht.' },
];

function planWillekeurigKroketEvent(client) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', hour: 'numeric', minute: 'numeric', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const amsUur = parseInt(parts.find(p => p.type === 'hour').value);
  const amsMin = parseInt(parts.find(p => p.type === 'minute').value);
  const nuMinuten = amsUur * 60 + amsMin;

  const VROEGST = 10 * 60;
  const LATEST  = 17 * 60;
  const vanafMinuten = Math.max(nuMinuten + 5, VROEGST);
  if (vanafMinuten >= LATEST) return;

  const event = KROKET_EVENTS[Math.floor(Math.random() * KROKET_EVENTS.length)];
  const members = loadMembers();

  for (const [userId, lid] of Object.entries(members)) {
    const delta = Math.random() < 0.5 ? 1 : -1;
    const doelMinuten = vanafMinuten + Math.floor(Math.random() * (LATEST - vanafMinuten));
    const delayMs = (doelMinuten - nuMinuten) * 60_000
      - (now.getSeconds() * 1000 + now.getMilliseconds());

    const dUur = Math.floor(doelMinuten / 60);
    const dMin = String(doelMinuten % 60).padStart(2, '0');
    console.log(`⚡ ${event.naam} — ${lid.bijnaam}: ~${dUur}:${dMin} AMS (${delta > 0 ? '+' : ''}${delta} pt)`);

    setTimeout(async () => {
      try {
        pasScoreAan(userId, delta);
        const richting = delta > 0
          ? `Dit werkt in het voordeel van ${lid.bijnaam}: +1 kroketpunt.`
          : `Dit treft ${lid.bijnaam} ongunstig: −1 kroketpunt.`;
        const tekst = await kroketResponse(
          `${event.context} ${richting} Spreek dit kort en plechtig uit als decreet van de Kroket God. Noem de naam en het puntenaantal. Geen inleidingszin.`,
          280, false
        );
        await postToChannel(client, process.env.SLACK_CHANNEL_ID, tekst);
      } catch (err) {
        console.error(`Fout bij kroket-event (${lid.bijnaam}):`, err);
      }
    }, delayMs);
  }
  console.log(`⚡ Kroket-event "${event.naam}" gepland voor ${Object.keys(members).length} leden.`);
}

// Maandag 09:30 — plan event op willekeurig moment ergens deze week (ma–vr 10:00–17:00)
cron.schedule('30 9 * * 1', () => {
  const extraDagen = Math.floor(Math.random() * 5);         // 0=ma … 4=vr
  const doelUur   = 10 + Math.floor(Math.random() * 7);    // 10–16
  const doelMin   = Math.floor(Math.random() * 60);
  const delayMs   = extraDagen * 24 * 60 * 60_000
                  + (doelUur - 9) * 60 * 60_000
                  + (doelMin - 30) * 60_000;
  const dagNamen  = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
  console.log(`⚡ Kroket-event gepland op ${dagNamen[extraDagen]} ~${doelUur}:${String(doelMin).padStart(2, '0')} AMS`);
  setTimeout(() => planWillekeurigKroketEvent(app.client), delayMs);
}, { timezone: 'Europe/Amsterdam' });

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

// ── Eenmalige migratie: begrens bestaande verbanning Mr. KroketPet tot 2 dagen ─

async function migreerVerbanningKroketPet(client) {
  const JASPER_ID = 'U08ALFNQB1V';
  const verbanning = loadVerbanning();
  const v = verbanning[JASPER_ID];
  if (!v) return; // al verlopen of niet aanwezig

  const tot = new Date(v.tot);
  const maxTot = new Date();
  maxTot.setDate(maxTot.getDate() + 2);

  if (tot <= maxTot) return; // al binnen 2 dagen, niets doen

  // Pas aan naar 2 dagen vanaf nu
  verbanning[JASPER_ID] = { ...v, tot: maxTot.toISOString(), dagen: 2 };
  saveVerbanning(verbanning);

  const terugDatum = maxTot.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' });
  const tekst = await kroketResponse(
    `De Kroket God herziet zijn eigen vonnis. Het oorspronkelijke oordeel van 7 dagen voor Mr. KroketPet wordt teruggebracht naar 2 dagen — ` +
    `niet uit genade, maar omdat de Hoge Frituurraad erkent dat dit een eerste overtreding betrof en buitenproportionele straffen de snackleer ondermijnen. ` +
    `Spreek dit plechtig uit als een decreet van zelfcorrectie. Terugkeer: ${terugDatum}. Geen inleidingszin.`,
    400, false
  );
  await postToChannel(client, process.env.SLACK_CHANNEL_ID, tekst);
}

// ── Eenmalig: zonnestralen-event vandaag op willekeurig moment ────────────────

function planZonnestralenEvent(client) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam', hour: 'numeric', minute: 'numeric', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const amsUur = parseInt(parts.find(p => p.type === 'hour').value);
  const amsMin = parseInt(parts.find(p => p.type === 'minute').value);
  const nuMinuten = amsUur * 60 + amsMin;

  const VROEGST = 10 * 60;  // 10:00
  const LATEST  = 17 * 60;  // 17:00

  if (nuMinuten >= LATEST) {
    console.log('☀️ Zonnestralen-event: venster voorbij voor vandaag.');
    return;
  }

  const vanafMinuten = Math.max(nuMinuten + 5, VROEGST);
  if (vanafMinuten >= LATEST) return;

  const JASPER_ID = 'U08ALFNQB1V';
  const members = loadMembers();

  // Plan per lid een apart willekeurig moment
  for (const [userId, lid] of Object.entries(members)) {
    const isJasper = userId === JASPER_ID;
    const deltaMap = {
      'U08ALFNQB1V': 2,   // Mr. KroketPet
      'U09L37GRASZ': 1,   // Mr. Te Lang Gefrituurde Kroket
      'U0A4XPQF3CM': -1,  // Mr. Kroketinho
      'U08PWNK9V7H': -1,  // De Groene Kroket
    };
    const delta = deltaMap[userId] ?? (Math.random() < 0.5 ? 1 : -1);

    const doelMinuten = vanafMinuten + Math.floor(Math.random() * (LATEST - vanafMinuten));
    const delayMs = (doelMinuten - nuMinuten) * 60_000
      - (now.getSeconds() * 1000 + now.getMilliseconds());

    const dUur = Math.floor(doelMinuten / 60);
    const dMin = String(doelMinuten % 60).padStart(2, '0');
    console.log(`☀️ Zonnestralen-event ${lid.bijnaam}: ~${dUur}:${dMin} AMS (${delta > 0 ? '+' : ''}${delta} pt)`);

    setTimeout(async () => {
      try {
        pasScoreAan(userId, delta);
        const teken = delta > 0 ? `+${delta}` : `${delta}`;
        let promptTekst;
        if (isJasper) {
          promptTekst =
            `De zonnestralen hebben het vetbad bereikt en troffen de pan van ${lid.bijnaam} het hardst. ` +
            `De Kroket God kent hem ${teken} kroketpunten toe als kosmische beloning. ` +
            `Spreek dit plechtig uit. Noem de naam en het aantal punten. Geen inleidingszin.`;
        } else if (delta > 0) {
          promptTekst =
            `De zonnestralen hebben het vetbad bereikt. Een straal viel gunstig op ${lid.bijnaam}. ` +
            `De Kroket God kent hem ${teken} kroketpunt toe. Spreek dit plechtig maar kort uit. Geen inleidingszin.`;
        } else {
          promptTekst =
            `De zonnestralen hebben het vetbad bereikt — maar de straal die ${lid.bijnaam} trof was koud en scheef. ` +
            `De Kroket God trekt hem 1 kroketpunt af als kosmische correctie. Spreek dit kort en droog uit. Geen inleidingszin.`;
        }
        const tekst = await kroketResponse(promptTekst, 300, false);
        await postToChannel(client, process.env.SLACK_CHANNEL_ID, tekst);
      } catch (err) {
        console.error(`Fout bij zonnestralen-event (${lid.bijnaam}):`, err);
      }
    }, delayMs);
  }
}

// ── Eenmalige intrekking 2026-05-21: scorecorrectie + zonnestralen terugdraaien ─

async function intrekkenVandaag(client) {
  const DATUM = '2026-05-21';
  const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  if (vandaag !== DATUM) return;

  // Draai scorecorrectie terug (KroketPet −2, Kroketinho −2, Te Lang −1)
  // Draai zonnestralen terug (KroketPet −2, Te Lang −1, Kroketinho +1, Groene Kroket +1)
  // Netto: KroketPet −4, Kroketinho −1, Te Lang −2, Groene Kroket +1
  const terugdraaien = [
    { id: 'U08ALFNQB1V', delta: -4 },  // KroketPet
    { id: 'U0A4XPQF3CM', delta: -1 },  // Kroketinho
    { id: 'U09L37GRASZ', delta: -2 },  // Te Lang Gefrituurde Kroket
    { id: 'U08PWNK9V7H', delta:  1 },  // Groene Kroket (zonnestralen was -1)
  ];
  for (const { id, delta } of terugdraaien) pasScoreAan(id, delta);

  // Verwijder het laatste bericht van de bot in het kanaal
  try {
    const history = await client.conversations.history({
      channel: process.env.SLACK_CHANNEL_ID,
      limit: 20,
    });
    const botInfo = await client.auth.test();
    const laatsteBotBericht = history.messages?.find(m => m.bot_id || m.user === botInfo.user_id);
    if (laatsteBotBericht?.ts) {
      await client.chat.delete({
        channel: process.env.SLACK_CHANNEL_ID,
        ts: laatsteBotBericht.ts,
      });
      console.log('🗑️ Laatste bericht verwijderd:', laatsteBotBericht.ts);
    }
  } catch (err) {
    console.error('Kon laatste bericht niet verwijderen:', err.message);
  }
}

// ── Start ──────────────────────────────────────────────────────────────────────

// ── Eenmalige scoreherstelling 2026-05-21 ─────────────────────────────────────

async function herstelScores20260521() {
  const DATUM = '2026-05-21';
  const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  if (vandaag !== DATUM) return;

  const scores = loadScores();
  scores['U08ALFNQB1V'] = 7;  // Mr. KroketPet
  scores['U09L37GRASZ'] = 7;  // Mr. Te Lang Gefrituurde Kroket
  scores['U0A4XPQF3CM'] = 6;  // Mr. Kroketinho
  scores['U08PWNK9V7H'] = 5;  // De Groene Kroket
  saveScores(scores);
  console.log('✅ Scores hersteld naar 7/7/6/5.');
}

(async () => {
  backfillAchievements();
  await app.start();
  console.log('⚜️ De Kroket God is wakker. Poort 3000 staat open.');
  await migreerVerbanningKroketPet(app.client);
  await intrekkenVandaag(app.client);
  await herstelScores20260521();
})();
