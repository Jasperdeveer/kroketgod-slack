// ── Het tokenbudget: past dit verzoek bij dit model? ───────────────────────────
// Groq weigert elk verzoek boven zijn 8.000 tokens per minuut met een 413, en telt daarin ook het
// gevraagde output-budget mee (bij gpt-oss: max_tokens plus 1.024 denk-tokens). De vaste
// systeemprompt alleen zat al rond de 7.000; met de kanaalcontext of het Gepanneerde Rijk erbij
// ging het mis (productielog: 17 × 413). De oude noodgreep knipte de systeemprompt hard af op
// 9.000 tekens, en dat kostte precies de regels die achteraan stonden: formaat, lengte, identiteit.
//
// Nu andersom. Wie de prompt bouwt, markeert wat er MAG wegvallen, met een prioriteit:
//   1 = eerst weg (stijlvoorbeelden, archiefecho's, anti-herhaling)
//   2 = daarna (geboden, kennisbank, seizoenssfeer)
//   3+ = pas na de gespreksgeschiedenis (3 kanaalgesprek en ledeninformatie, 4 rijkskennis bij
//        een rijksvraag)
// en de keten krimpt per schakel tot het verzoek in het budget van DIE schakel past. Gemini met
// zijn ruime budget krijgt alles; Groq krijgt een kortere versie in plaats van een 413.
//
// De markering is een paar tekens uit Unicode's privégebied (U+E000/U+E001). Die typt niemand
// per ongeluk, prompt-safety haalt ze uit onvertrouwde tekst, en ze worden vóór verzending altijd
// weggehaald — ook als er niets gekrompen hoeft te worden.

const BLOK_OPEN = '';
const BLOK_DICHT = '';
const BLOK_RE = /([1-9])([\s\S]*?)/g;
const MARKERING_RE = /[1-9]?|/g;

// Grove schatting: ~3,5 tekens per token voor Nederlands bij de tokenizers van deze modellen
// (gemeten op de echte prompt: ~3,6). Dichte woordenlijsten tokeniseren slechter (~2,5); valt de
// schatting daardoor te laag uit, dan vangt de 413-herkansing in de keten dat op.
const TEKENS_PER_TOKEN = 3.5;
const MARGE_VAST = 300;    // speling voor het chat-template en de afronding
const TOKENS_PER_BERICHT = 4;

// Hard plafond voor de laatste user-beurt bij de noodknip, en een ondergrens voor de systeemprompt:
// liever een verzoek dat net niet past (en de keten laat doorvallen) dan een prompt zonder regels.
const KRIMP_USER_MAX = 4000;
const SYSTEEM_MIN_TEKENS = 2000;

// Markeer `tekst` als inkortbaar met prioriteit `prio` (1-9, laagste valt eerst weg).
function inkortbaar(prio, tekst) {
  if (!tekst) return '';
  const p = Math.min(9, Math.max(1, Math.round(prio)));
  return `${BLOK_OPEN}${p}${String(tekst).replace(MARKERING_RE, '')}${BLOK_DICHT}`;
}

const zonderMarkeringen = (tekst) => String(tekst ?? '').replace(MARKERING_RE, '');

// Haal alle blokken met prioriteit ≤ `totPrio` weg en maak de rest leesbaar.
function zonderBlokken(tekst, totPrio = 9) {
  return zonderMarkeringen(String(tekst ?? '').replace(BLOK_RE, (heel, p) => (Number(p) <= totPrio ? '' : heel)));
}

function prioriteitenIn(tekst) {
  const uit = new Set();
  for (const m of String(tekst ?? '').matchAll(BLOK_RE)) uit.add(Number(m[1]));
  return [...uit].sort((a, b) => a - b);
}

const schatTokens = (tekst) => Math.ceil(zonderMarkeringen(tekst).length / TEKENS_PER_TOKEN);

const inhoudVan = (b) => (typeof b?.content === 'string' ? b.content : '');

// Geschat totaal voor één verzoek: invoer plus vaste speling, plus het output-budget dat de
// provider reserveert (bij redeneermodellen inclusief denk-tokens).
function schatVerzoek(berichten, uitvoerTokens = 0) {
  const invoer = berichten.reduce((n, b) => n + schatTokens(inhoudVan(b)) + TOKENS_PER_BERICHT, 0);
  return invoer + MARGE_VAST + uitvoerTokens;
}

function metInhoud(berichten, fn) {
  return berichten.map(b => (typeof b.content === 'string' ? { ...b, content: fn(b.content) } : b));
}

// Laat de oudste gespreksbeurten vallen tot het past, maar houd de systeemprompt en de laatste
// user-beurt (daar moet het antwoord op ingaan).
function zonderOudeBeurten(berichten, past) {
  const systeem = berichten.filter(b => b.role === 'system');
  let rest = berichten.filter(b => b.role !== 'system');
  const laatsteUser = [...rest].reverse().find(b => b.role === 'user');
  while (rest.length > 1 && !past([...systeem, ...rest])) {
    const i = rest.findIndex(b => b !== laatsteUser);
    if (i === -1) break;
    rest = rest.slice(0, i).concat(rest.slice(i + 1));
  }
  return [...systeem, ...rest];
}

// Noodknip: de systeemprompt van achteren inkorten (de regels staan vooraan) en de user-beurt op
// een plafond. Alleen als alle inkortbare blokken en de geschiedenis al weg zijn.
function hardGeknipt(berichten, budget, uitvoerTokens) {
  const knip = (s, max) => (s.length > max ? `${s.slice(0, max)}\n…` : s);
  const metUser = metInhoud(berichten, s => s);
  for (const b of metUser) if (b.role !== 'system') b.content = knip(b.content, KRIMP_USER_MAX);
  const anderen = metUser.filter(b => b.role !== 'system').reduce((n, b) => n + b.content.length, 0);
  // Tien tokens speling voor de afronding en het "…" dat de knip zelf toevoegt.
  const invoerTokens = budget - uitvoerTokens - MARGE_VAST - TOKENS_PER_BERICHT * metUser.length - 10;
  const systeemMax = Math.max(SYSTEEM_MIN_TEKENS, Math.floor(invoerTokens * TEKENS_PER_TOKEN) - anderen);
  for (const b of metUser) if (b.role === 'system') b.content = knip(b.content, systeemMax);
  return metUser;
}

// Maak `berichten` passend voor een schakel met `budget` tokens per verzoek. Geeft altijd
// berichten terug zonder markeringen, plus welke stappen er nodig waren (leeg = niets gekrompen).
//   1. blokken met prioriteit 1 en 2 weg;
//   2. oudste gespreksbeurten weg;
//   3. de overige blokken weg, laagste prioriteit eerst;
//   4. noodknip.
function pasInBudget(berichten, { budget = Infinity, uitvoerTokens = 0 } = {}) {
  const past = (bs) => schatVerzoek(bs, uitvoerTokens) <= budget;
  const zonder = (bs, p) => metInhoud(bs, s => zonderBlokken(s, p));
  const stappen = [];

  let kandidaat = metInhoud(berichten, zonderMarkeringen);
  if (past(kandidaat)) return { berichten: kandidaat, stappen };

  const prios = [...new Set(berichten.flatMap(b => prioriteitenIn(inhoudVan(b))))].sort((a, b) => a - b);
  let weg = 0;
  for (const p of prios.filter(p => p <= 2)) {
    weg = p;
    stappen.push(`prio ${p}`);
    kandidaat = zonder(berichten, weg);
    if (past(kandidaat)) return { berichten: kandidaat, stappen };
  }

  const korter = zonderOudeBeurten(berichten, bs => past(zonder(bs, weg)));
  if (korter.length < berichten.length) {
    stappen.push(`${berichten.length - korter.length} oude beurten`);
    kandidaat = zonder(korter, weg);
    if (past(kandidaat)) return { berichten: kandidaat, stappen };
  }

  for (const p of prios.filter(p => p > 2)) {
    weg = p;
    stappen.push(`prio ${p}`);
    kandidaat = zonder(korter, weg);
    if (past(kandidaat)) return { berichten: kandidaat, stappen };
  }

  stappen.push('noodknip');
  return { berichten: hardGeknipt(kandidaat, budget, uitvoerTokens), stappen };
}

module.exports = {
  TEKENS_PER_TOKEN,
  inkortbaar, zonderMarkeringen, zonderBlokken, prioriteitenIn,
  schatTokens, schatVerzoek, pasInBudget,
};
