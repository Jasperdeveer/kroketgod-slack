// ── Het Paarboek: wat er tussen twee leden staat ──────────────────────────────
//
// Eén getal per paar, van −4 tot +4, en één claim-ladder daarnaast. Dit vervangt op termijn de
// hele wroklaag: kerfstok, eeuwige twist, vete van het Rijk, Zwarte Korst, Dubbele Korst,
// vetpapier, de Blinde Handdruk en het weefsel. Dat waren acht systemen die elk hun eigen
// bestand, hun eigen cron en hun eigen idee hadden over wat "er tussen twee mensen staat" —
// zonder dat ze iets van elkaar wisten.
//
// WAAROM ÉÉN GETAL. De oude kerfstok telde alleen onrecht: hij liep op en kwam er nooit meer af
// behalve door een expliciet gebaar. Dat is geen relatie, dat is een strafblad. Een paar dat
// elkaar eert, uitleent en vergeeft hoort warmer te worden, en een wrok die niemand voedt hoort
// vanzelf te slijten. Daarom één schaal die beide kanten op kan en elke week naar nul schuift.
//
// WAAROM SYMMETRISCH. De bladzijde is de TEMPERATUUR tussen twee mensen, en die is wederzijds —
// je hebt geen ruzie in je eentje. Wat wél een richting heeft is een losse daad, en daarvoor is
// de Claim: die staat op naam van wie iets is aangedaan, verloopt, en kent precies drie uitgangen.
//
// Puur: geen I/O, geen Date.now() zonder dat de aanroeper hem meegeeft. Zie paarboek.test.js.

'use strict';

const { paarSleutel } = require('./paar.js');

// De grenzen van de schaal. Vier stappen elke kant op is genoeg voor vijf toestanden en weinig
// genoeg dat één goede week een slechte kan rechttrekken.
const BLADZIJDE_MIN = -4;
const BLADZIJDE_MAX = 4;

// Wat een daad met de bladzijde doet. De vier vijandige sleutels en hun gewichten komen
// ongewijzigd uit KERF_GEWICHT in paar.js, zodat de overgang geen enkele daad zwaarder of
// lichter maakt dan hij was. De warme kant is nieuw: die bestond nergens.
const DAAD_GEWICHT = {
  // vijandig — iets wat een ander jou aandeed zonder dat je ervoor koos
  roof_gelukt:    -2,
  duel_verloren:  -1,   // alleen als de ÁNDER het duel begon; wie zelf uitdaagt zocht het op
  premie_geind:   -1,
  troon_verloren: -1,
  // warm — iets wat een ander jou gaf en hem zelf iets kostte
  eerbewijs:       1,
  kroketje:        1,
  uitlenen:        1,
  vergeven:        2,   // de duurste daad in de frituur, dus de zwaarste stap omhoog
};

// Hoogstens één BOEKING per paar per dag. Niet één punt: een geslaagde roof weegt nog steeds
// dubbel zo zwaar als een verloren duel, precies zoals in de kerfstok. Wat de dagregel
// voorkomt is dat één slechte middag de hele bladzijde in de clinch duwt.
const BOEKINGEN_PER_DAG = 1;

// De vijf toestanden. Het getal is NOOIT zichtbaar voor spelers — een relatie uitdrukken in
// "−3" maakt er boekhouding van, en dan gaan mensen het optimaliseren in plaats van beleven.
const TOESTANDEN = [
  { vanaf: -4, naam: 'in de clinch',  icoon: '⚡', uitleg: 'hier ligt iets zwaars' },
  { vanaf: -2, naam: 'er ligt iets',  icoon: '🪵', uitleg: 'niet gladgestreken' },
  { vanaf:  0, naam: 'quitte',        icoon: '·',  uitleg: 'niets te verrekenen' },
  { vanaf:  1, naam: 'gelijkgezind',  icoon: '🤝', uitleg: 'het loopt goed' },
  { vanaf:  3, naam: 'dik',           icoon: '🔥', uitleg: 'onafscheidelijk' },
];

function klem(waarde) {
  return Math.max(BLADZIJDE_MIN, Math.min(BLADZIJDE_MAX, Math.round(Number(waarde) || 0)));
}

// De toestand bij een waarde. Loopt van achter naar voren zodat de hoogste passende drempel wint.
function toestandVan(waarde) {
  const w = klem(waarde);
  for (let i = TOESTANDEN.length - 1; i >= 0; i--) {
    if (w >= TOESTANDEN[i].vanaf) return TOESTANDEN[i];
  }
  return TOESTANDEN[0];
}

function bladzijdeVan(boek, a, b) {
  if (!a || !b || a === b) return 0;
  return klem(boek?.[paarSleutel(a, b)]?.waarde || 0);
}

// Boekt een daad tussen twee leden. Geeft een NIEUW boek terug (geen mutatie), plus of er iets
// veranderde — de aanroeper beslist zelf wanneer hij wegschrijft.
function boekDaad(boek, a, b, soort, dagSleutel) {
  const gewicht = DAAD_GEWICHT[soort];
  if (!gewicht || !a || !b || a === b) return { boek, gewijzigd: false };
  const sleutel = paarSleutel(a, b);
  const rec = { waarde: 0, laatsteDag: null, ...(boek?.[sleutel] || {}) };
  // Eén boeking per dag — maar een warme daad mag een vijandige van diezelfde dag wél
  // tegenspreken. Anders kan één roof 's ochtends een hele dag aan verzoening blokkeren, en
  // dat is precies de verkeerde kant om te blokkeren.
  const zelfdeRichting = rec.laatsteDag === dagSleutel
    && Math.sign(gewicht) === Math.sign(rec.laatsteRichting || 0);
  if (zelfdeRichting) return { boek, gewijzigd: false };
  const nieuweWaarde = klem(rec.waarde + gewicht);
  if (nieuweWaarde === rec.waarde) return { boek, gewijzigd: false }; // al aan het plafond
  return {
    boek: { ...boek, [sleutel]: { ...rec, waarde: nieuweWaarde, laatsteDag: dagSleutel, laatsteRichting: Math.sign(gewicht) } },
    gewijzigd: true,
    waarde: nieuweWaarde,
    toestand: toestandVan(nieuweWaarde),
  };
}

// Zet een paar ineens op nul. Voor vergiffenis: dat is een gebaar, geen afbetaling in termijnen.
function strijkGlad(boek, a, b) {
  const sleutel = paarSleutel(a, b);
  const rec = boek?.[sleutel];
  if (!rec || !rec.waarde) return { boek, gewijzigd: false, was: 0 };
  return { boek: { ...boek, [sleutel]: { ...rec, waarde: 0 } }, gewijzigd: true, was: rec.waarde };
}

// Elke maandagnacht één stap richting nul, in beide richtingen. Een wrok die niemand voedt is
// binnen vier weken weg, en een vriendschap die niemand onderhoudt koelt net zo hard af.
// `weekSleutel` maakt het idempotent: tweemaal draaien in dezelfde week doet niets.
function schuifNaarNul(boek, weekSleutel) {
  let gewijzigd = false;
  const uit = {};
  for (const [sleutel, rec] of Object.entries(boek || {})) {
    if (rec?.laatsteSchuif === weekSleutel) { uit[sleutel] = rec; continue; }
    const w = klem(rec?.waarde || 0);
    const nieuw = w > 0 ? w - 1 : w < 0 ? w + 1 : 0;
    if (nieuw !== w) gewijzigd = true;
    // Een paar dat op nul staat en geen geschiedenis meer heeft, hoeft niet bewaard te blijven.
    if (nieuw === 0 && !rec?.laatsteDag) continue;
    uit[sleutel] = { ...rec, waarde: nieuw, laatsteSchuif: weekSleutel };
    if (rec?.laatsteSchuif !== weekSleutel) gewijzigd = true;
  }
  return { boek: uit, gewijzigd };
}

// Alle paren van één lid, sterkste band eerst en dan de zwaarste wrok. Voor de Home-tab.
function bladzijdenVan(boek, userId, ledenIds = []) {
  return ledenIds
    .filter(id => id && id !== userId)
    .map(id => ({ id, waarde: bladzijdeVan(boek, userId, id) }))
    .filter(r => r.waarde !== 0)
    .map(r => ({ ...r, toestand: toestandVan(r.waarde) }))
    .sort((a, b) => Math.abs(b.waarde) - Math.abs(a.waarde) || b.waarde - a.waarde);
}

// ── De Claim ──────────────────────────────────────────────────────────────────
// Wat de kerfstok miste: een moment waarop je KIEST. Vroeger liep de wrok stil op en merkte je
// het pas als je inzet bij een duel ineens hoger was. Nu krijgt wie iets is aangedaan drie
// knoppen en drie dagen, en als hij niets doet vervaagt het vanzelf.

const CLAIM_GELDIG_MS = 72 * 60 * 60 * 1000;
const CLAIM_KEUZES = ['vergeven', 'vergelden', 'laten'];

function claimSleutel(gekerkte, dader) {
  return `${gekerkte}>${dader}`;
}

// Opent een claim, tenzij er al een open claim tegen dezelfde dader staat. Niet stapelen: twee
// openstaande claims tegen één persoon maken de keuze onduidelijk en de knoppen dubbel.
function maakClaim(claims, gekerkte, dader, soort, nu) {
  if (!gekerkte || !dader || gekerkte === dader) return { claims, gewijzigd: false };
  const sleutel = claimSleutel(gekerkte, dader);
  const bestaand = claims?.[sleutel];
  if (bestaand && !bestaand.gesloten && nu - bestaand.ts < CLAIM_GELDIG_MS) {
    return { claims, gewijzigd: false, reden: 'al open' };
  }
  return {
    claims: { ...claims, [sleutel]: { gekerkte, dader, soort, ts: nu, gesloten: null } },
    gewijzigd: true,
  };
}

// De open claims van één lid, nieuwste eerst. Verlopen claims tellen niet mee en worden
// hier niet opgeruimd — dat doet ruimOudeClaims, zodat lezen nooit schrijft.
function openClaimsVan(claims, gekerkte, nu) {
  return Object.values(claims || {})
    .filter(c => c && c.gekerkte === gekerkte && !c.gesloten && nu - c.ts < CLAIM_GELDIG_MS)
    .sort((a, b) => b.ts - a.ts);
}

function sluitClaim(claims, gekerkte, dader, keuze, nu) {
  if (!CLAIM_KEUZES.includes(keuze)) return { claims, gewijzigd: false, reden: 'onbekende keuze' };
  const sleutel = claimSleutel(gekerkte, dader);
  const c = claims?.[sleutel];
  if (!c || c.gesloten) return { claims, gewijzigd: false, reden: 'geen open claim' };
  if (nu - c.ts >= CLAIM_GELDIG_MS) return { claims, gewijzigd: false, reden: 'verlopen' };
  return { claims: { ...claims, [sleutel]: { ...c, gesloten: keuze, geslotenTs: nu } }, gewijzigd: true, claim: c };
}

// Ruimt op wat niemand meer kan gebruiken: gesloten claims en claims ouder dan het venster.
function ruimOudeClaims(claims, nu) {
  const uit = {};
  let gewijzigd = false;
  for (const [sleutel, c] of Object.entries(claims || {})) {
    const verlopen = !c || nu - c.ts >= CLAIM_GELDIG_MS;
    if (c?.gesloten || verlopen) { gewijzigd = true; continue; }
    uit[sleutel] = c;
  }
  return { claims: uit, gewijzigd };
}

module.exports = {
  BLADZIJDE_MIN, BLADZIJDE_MAX, DAAD_GEWICHT, BOEKINGEN_PER_DAG, TOESTANDEN,
  toestandVan, bladzijdeVan, boekDaad, strijkGlad, schuifNaarNul, bladzijdenVan,
  CLAIM_GELDIG_MS, CLAIM_KEUZES, claimSleutel,
  maakClaim, openClaimsVan, sluitClaim, ruimOudeClaims,
};
