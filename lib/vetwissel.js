// ── De Vetwissel: de rekensom en de regels ───────────────────────────────────
//
// Een lid leent een ander kroketpunten. Dit bestand bevat alleen de rekenkunde en de toetsen;
// het posten, het verplaatsen van punten en de knoppen staan in index.js.
//
// WAT HIER MIS WAS, en waarom het zo grondig is omgegooid. De oude wissel rekende één vast punt
// rente, áltijd. Dat had drie gevolgen die elkaar versterkten:
//
//   1. Uitlenen was gratis geld. Wie uitleende kreeg gegarandeerd zijn inleg plus één punt
//      terug, ongeacht het gedrag van de ander. Geen risico, alleen rendement.
//   2. Te laat betalen was GOEDKOPER dan op tijd betalen. De schuld bleef na de vervaldag
//      precies even hoog, de inning pakte hoogstens wat er in de kluis lag, en wat niet te
//      halen viel werd stilzwijgend kwijtgescholden. Wie zijn beurs leegkocht vóór vrijdag
//      betaalde niets.
//   3. En bovenop dat alles kreeg de wanbetaler een weerwoord — een gratis duel in zijn
//      voordeel. Een straf die een cadeau bevat is geen straf.
//
//   Netto was niet aflossen de verstandigste zet in het spel.
//
// DE NIEUWE REGELS. Op tijd betalen is RENTELOOS — je geeft terug wat je kreeg, en dat is wat
// een gunst tussen vrienden hoort te zijn. De prijs zit volledig in te laat zijn: elke gemiste
// vervaldag legt een boete bovenop de schuld, en die schuld verdwijnt niet meer als je kluis
// leeg is. Wat niet geïnd kan worden blijft staan en groeit de week daarop door.
//
// En een wissel komt niet meer tot stand zonder dat de LENER tekent. Een schuld die een ander
// je kan opleggen is geen lening maar een strik.
//
// HET BEDRAG VERANDERT NOOIT. Een deelbetaling wordt bijgehouden in `afbetaald`, niet door het
// bedrag te verlagen. Dat scheelt een valkuil: zou de restschuld het nieuwe bedrag worden, dan
// rekent de volgende boete over een bedrag waar al boete in zit, en groeit een lening van drie
// punten binnen een maand naar iets wat niemand in deze economie kan ophoesten.
//
// Puur: geen I/O, geen Date.now() zonder dat de aanroeper hem meegeeft. Zie vetwissel.test.js.

'use strict';

const DAG_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAG_MS;

const WISSEL_MAX = 3;              // hoogste bedrag dat je kunt uitlenen
const WISSEL_MAX_OPEN = 2;         // zoveel schulden mag één lid tegelijk dragen

// De boete loopt PER DAG, niet per week. Dat is bewust: bij een weekritme is uitstel één
// beslissing die je op vrijdag neemt en daarna zes dagen vergeet. Per dag is het elke ochtend
// opnieuw een keuze, en dat is precies de druk die een deadline hoort te geven.
//
// De eerste dag kost het geleende bedrag erbij, met een bodem van 2 — bij een lening van één
// punt is "het bedrag er nog eens bij" geen straf maar een schouderklopje. Elke volgende dag
// legt er één bij.
//
// Hard geplafonneerd, en dat plafond is dragend: een schuld die blijft doorgroeien is geen
// straf meer maar een uitsluiting, en bij vier spelers wil je niemand permanent op nul houden.
// Eén lening kost dus nooit meer dan het geleende plus BOETE_MAX. Met deze getallen staat de
// boete binnen vier à vijf dagen op zijn maximum, dus ruim binnen de week.
const BOETE_MIN = 2;
const BOETE_PER_DAG = 1;
const BOETE_MAX = 6;

// Zolang een voorstel niet getekend is beweegt er niets. Verloopt het, dan is het weg — een
// voorstel dat een week blijft hangen is een strik met vertraging.
const VOORSTEL_GELDIG_MS = 24 * 60 * 60 * 1000;

// Hoeveel dagen te laat. Nul zolang de vervaldag nog niet geweest is; daarna één per
// begonnen dag. De vervaldag zelf telt meteen mee: om 11:00 is de wissel te laat, niet pas
// een dag later.
function dagenTeLaat(wissel, nu) {
  const verval = Number(wissel?.vervalTs);
  if (!Number.isFinite(verval) || !Number.isFinite(nu) || nu < verval) return 0;
  return Math.floor((nu - verval) / DAG_MS) + 1;
}

// De boete die op dit moment op de wissel staat.
function boeteVan(wissel, nu) {
  const dagen = dagenTeLaat(wissel, nu);
  if (!dagen) return 0;
  const bedrag = Math.max(0, Number(wissel?.bedrag) || 0);
  return Math.min(BOETE_MAX, Math.max(BOETE_MIN, bedrag) + (dagen - 1) * BOETE_PER_DAG);
}

// Wat er op dit moment nog te betalen valt. Vóór de vervaldag: precies het geleende, renteloos.
// Daarna: het geleende plus de boete, min wat er al binnen is.
function teBetalen(wissel, nu) {
  const bedrag = Math.max(0, Number(wissel?.bedrag) || 0);
  const afbetaald = Math.max(0, Number(wissel?.afbetaald) || 0);
  return Math.max(0, bedrag + boeteVan(wissel, nu) - afbetaald);
}

function isVervallen(wissel, nu) {
  return dagenTeLaat(wissel, nu) > 0;
}

// Wat er van een wissel overblijft nadat er `geind` punten zijn opgehaald. Dit is de kern van
// de nieuwe straf: een restschuld verdwijnt NIET. Wie zijn kluis leeghaalt vóór de vervaldag
// schuift de rekening alleen vooruit, en de week daarop komt er een boete bij.
// Is alles voldaan, dan geeft deze functie null terug en is de wissel weg.
function naInning(wissel, geind, nu) {
  const betaald = Math.max(0, Number(geind) || 0);
  const bijgewerkt = { ...wissel, afbetaald: (Math.max(0, Number(wissel?.afbetaald) || 0)) + betaald };
  return teBetalen(bijgewerkt, nu) > 0 ? bijgewerkt : null;
}

// ── De Overval: de schuldeiser mag ook gráíjpen ──────────────────────────────
//
// Na de vervaldag heeft de schuldeiser drie wegen, en dát is waar de wissel interessant wordt.
// Innen is veilig en saai: je pakt wat er in de kluis ligt en de rest blijft staan.
// Kwijtschelden kost je alles en levert aanzien op. En dan is er de Overval: je gaat zélf halen,
// met een greep bovenop de schuld — maar het kan mislukken, en dan sta je met lege handen én
// geeft u uw schuldenaar een wapen.
//
// DE KANSEN ZIJN NIET WILLEKEURIG. Ze duwen het spel twee kanten op die we willen:
//   · Hoe langer iemand zijn schuld ontloopt, hoe makkelijker hij te pakken is. Wegduiken is
//     dus geen strategie maar uitstel. Ook dit loopt per DAG, gelijk met de boete: twee klokken
//     met een verschillend ritme zijn niet uit te leggen aan wie ernaar kijkt.
//   · Wie iets heeft afbetaald is veel moeilijker te overvallen. Een deelbetaling is daarmee
//     een echte zet en geen halve maatregel — precies wat we willen uitlokken bij iemand die
//     niet het hele bedrag heeft.
const OVERVAL_BASIS = 0.50;
const OVERVAL_PER_DAG = 0.05;
const OVERVAL_GOEDE_WIL = 0.25;     // korting op de kans voor wie al iets afbetaalde
const OVERVAL_MIN = 0.20;
const OVERVAL_MAX = 0.90;

// Wat er bovenop de schuld meegaat bij een geslaagde overval. Klein gehouden: de prikkel moet
// in de schuld zitten, niet in de buit, anders wordt lenen een lokaas om iemand te kunnen
// beroven.
const OVERVAL_GREEP = 2;

// Na een mislukte overval ligt het recht een dag stil. Zonder die pauze drukt de schuldeiser de
// knop tot hij een keer wint, en dan is de gok geen gok maar een wachttijd.
const OVERVAL_PAUZE_MS = 24 * 60 * 60 * 1000;

function overvalKans(wissel, nu) {
  const dagen = dagenTeLaat(wissel, nu);
  if (!dagen) return 0;                        // vóór de vervaldag valt er niets te halen
  const afbetaald = Math.max(0, Number(wissel?.afbetaald) || 0);
  const kans = OVERVAL_BASIS
    + OVERVAL_PER_DAG * (dagen - 1)
    - (afbetaald > 0 ? OVERVAL_GOEDE_WIL : 0);
  return Math.min(OVERVAL_MAX, Math.max(OVERVAL_MIN, kans));
}

// Mag er nu overvallen worden? Geeft { ok } of { ok: false, reden, wachtMs }.
function magOvervallen(wissel, nu) {
  if (!wissel) return { ok: false, reden: 'Er staat geen vervallen wissel op die naam.' };
  if (!isVervallen(wissel, nu)) return { ok: false, reden: 'De vervaldag is nog niet geweest. Tot dan is het gewoon een lening.' };
  const gefaald = Number(wissel.overvalGefaaldTs) || 0;
  const wachtMs = gefaald + OVERVAL_PAUZE_MS - nu;
  if (wachtMs > 0) {
    return { ok: false, reden: 'Uw vorige overval mislukte. De wacht is gewaarschuwd; probeer het morgen weer.', wachtMs };
  }
  return { ok: true };
}

// De uitkomst van een overval. `worp` komt van de aanroeper (Math.random()), zodat deze functie
// puur en testbaar blijft.
function overval(wissel, nu, saldo, worp) {
  const kans = overvalKans(wissel, nu);
  const schuld = teBetalen(wissel, nu);
  if (worp >= kans) {
    // Mislukt: niets geïnd, het recht ligt een dag stil, en de schuldenaar verdient een
    // weerwoord. Dáár hoort dat thuis — als beloning voor wie een overval doorstaat, niet als
    // cadeautje voor wie simpelweg niet betaalde.
    return { gelukt: false, kans, schuld, geind: 0, buit: 0, wissel: { ...wissel, overvalGefaaldTs: nu } };
  }
  const beschikbaar = Math.max(0, Number(saldo) || 0);
  const gepakt = Math.min(schuld + OVERVAL_GREEP, beschikbaar);
  const geind = Math.min(schuld, gepakt);          // eerst de schuld, pas daarna de greep
  const buit = gepakt - geind;
  return { gelukt: true, kans, schuld, geind, buit, wissel: naInning(wissel, geind, nu) };
}

// ── Roem uit wissels: alleen voor echte genade en een gehouden woord ─────────
//
// Kwijtschelden gaf altijd +2 roem, ook vóór de vervaldag en zonder plafond. Twee spelers konden
// dus roem kweken: één punt lenen, tekenen, meteen kwijtschelden, opnieuw. Het geleende punt
// ging naar de ander en kwam bij de volgende ronde in omgekeerde richting terug, dus netto kostte
// het niets. Aflossen deed hetzelfde voor +1: lenen, tekenen, direct terugbetalen.
//
// DE DRIE REGELS:
//   · Kwijtschelden levert alleen roem op als de wissel VERVALLEN is. Vóór de vervaldag kon de
//     schuldeiser niets opeisen, dus valt er ook niets grootmoedig te laten vallen.
//   · Op tijd aflossen levert alleen roem op als de wissel minstens een dag liep. Een lening die
//     geen nacht overleefde is een rondje heen en weer, geen woord dat gehouden werd.
//   · Per PAAR (in welke richting ook) hoogstens WISSEL_ROEM_PER_PAAR_PER_WEEK roem per week,
//     zoals de Gunst haar roem plafonneert. Dat houdt ook de regels hierboven eerlijk: wie ze
//     omzeilt, loopt alsnog tegen dit plafond.
const ROEM_KWIJTSCHELDING = 2;
const ROEM_OP_TIJD = 1;
const ROEM_MIN_LOOPTIJD_MS = DAG_MS;
const WISSEL_ROEM_PER_PAAR_PER_WEEK = 2;

// Hoeveel roem dit paar deze week nog uit wissels kan halen.
function wisselRoemRuimte(boek, paar, weekSleutel) {
  const gehad = Math.max(0, Number(boek?.[weekSleutel]?.[paar]) || 0);
  return Math.max(0, WISSEL_ROEM_PER_PAAR_PER_WEEK - gehad);
}

// Roem voor een kwijtschelding. Geeft { roem, reden }; reden is null, 'niet_vervallen' of
// 'plafond', zodat het kanaalbericht kan zeggen waarom er niets bij kwam.
function roemVoorKwijtschelding(wissel, nu, { boek, paar, weekSleutel }) {
  if (!isVervallen(wissel, nu)) return { roem: 0, reden: 'niet_vervallen' };
  const ruimte = wisselRoemRuimte(boek, paar, weekSleutel);
  if (!ruimte) return { roem: 0, reden: 'plafond' };
  return { roem: Math.min(ROEM_KWIJTSCHELDING, ruimte), reden: null };
}

// Roem voor volledig aflossen. Reden: null, 'te_laat', 'te_kort' of 'plafond'. Een wissel zonder
// tekentijd (van vóór deze regel) geldt als lang genoeg gelopen.
function roemVoorAflossing(wissel, nu, { boek, paar, weekSleutel }) {
  if (isVervallen(wissel, nu)) return { roem: 0, reden: 'te_laat' };
  const getekend = Number(wissel?.ts);
  if (Number.isFinite(getekend) && nu - getekend < ROEM_MIN_LOOPTIJD_MS) return { roem: 0, reden: 'te_kort' };
  const ruimte = wisselRoemRuimte(boek, paar, weekSleutel);
  if (!ruimte) return { roem: 0, reden: 'plafond' };
  return { roem: Math.min(ROEM_OP_TIJD, ruimte), reden: null };
}

// Legt toegekende roem vast. Geeft een NIEUW boek terug, met alleen de laatste vier weken.
function boekWisselRoem(boek, paar, weekSleutel, roem) {
  const n = Math.max(0, Number(roem) || 0);
  if (!n) return boek || {};
  const week = (boek || {})[weekSleutel] || {};
  const nieuw = { ...(boek || {}), [weekSleutel]: { ...week, [paar]: (Number(week[paar]) || 0) + n } };
  const houden = Object.keys(nieuw).sort().slice(-4);
  return Object.fromEntries(houden.map(k => [k, nieuw[k]]));
}

// Mag deze wissel voorgesteld worden? Eén functie die álle grenzen kent, zodat het commando en
// de knoppen niet uit elkaar kunnen lopen.
//
// `open` zijn de getekende wissels, `voorstellen` de nog niet getekende. Een voorstel bezet de
// plek alvast: anders stelt iemand vier wissels tegelijk voor en kiest hij achteraf.
function magVoorstellen({ open = [], voorstellen = [], vanId, naarId, bedrag, standVan, sleutelVan }) {
  if (!vanId || !naarId) return { ok: false, reden: 'De Kroket God kent die volgeling niet.' };
  if (vanId === naarId) return { ok: false, reden: 'Uzelf punten lenen is boekhoudkundig gezien niets.' };
  const n = Math.max(1, Math.min(WISSEL_MAX, parseInt(bedrag, 10) || 0));
  if ((Number(standVan) || 0) < n) {
    return { ok: false, reden: `U kunt geen ${n} kroketpunt${n === 1 ? '' : 'en'} uitlenen die u niet heeft.` };
  }
  const alles = [...open, ...voorstellen];
  // Eén wissel per PAAR, in welke richting ook. Twee tegengestelde wissels tussen dezelfde twee
  // leden is kringschuld: netto beweegt er niets behalve verwarring.
  if (alles.some(w => sleutelVan(w.vanId, w.naarId) === sleutelVan(vanId, naarId))) {
    return { ok: false, reden: 'Er staat al een wissel of een voorstel tussen u beiden, in de een of andere richting. Eén tegelijk.' };
  }
  if (alles.filter(w => w.naarId === naarId).length >= WISSEL_MAX_OPEN) {
    return { ok: false, reden: `Die volgeling draagt al ${WISSEL_MAX_OPEN} schulden. De Raad staat geen derde toe.` };
  }
  return { ok: true, bedrag: n };
}

// Verlopen voorstellen opruimen. Lezen schrijft nooit: dit geeft een nieuwe lijst terug en de
// aanroeper beslist of hij wegschrijft.
function ruimVoorstellen(voorstellen, nu) {
  const over = (voorstellen || []).filter(v => v && Number.isFinite(v.ts) && nu - v.ts < VOORSTEL_GELDIG_MS);
  return { voorstellen: over, gewijzigd: over.length !== (voorstellen || []).length };
}

function voorstelVan(voorstellen, id, nu) {
  const v = (voorstellen || []).find(x => x && x.id === id) || null;
  if (!v) return null;
  return Number.isFinite(nu) && nu - v.ts >= VOORSTEL_GELDIG_MS ? null : v;
}

module.exports = {
  DAG_MS, WEEK_MS, WISSEL_MAX, WISSEL_MAX_OPEN, BOETE_MIN, BOETE_PER_DAG, BOETE_MAX, VOORSTEL_GELDIG_MS,
  OVERVAL_BASIS, OVERVAL_PER_DAG, OVERVAL_GOEDE_WIL, OVERVAL_MIN, OVERVAL_MAX,
  OVERVAL_GREEP, OVERVAL_PAUZE_MS,
  dagenTeLaat, boeteVan, teBetalen, isVervallen, naInning,
  overvalKans, magOvervallen, overval,
  ROEM_KWIJTSCHELDING, ROEM_OP_TIJD, ROEM_MIN_LOOPTIJD_MS, WISSEL_ROEM_PER_PAAR_PER_WEEK,
  wisselRoemRuimte, roemVoorKwijtschelding, roemVoorAflossing, boekWisselRoem,
  magVoorstellen, ruimVoorstellen, voorstelVan,
};
