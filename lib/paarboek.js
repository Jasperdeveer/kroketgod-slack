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

// Wat een daad met de bladzijde doet. De drie vijandige sleutels en hun gewichten komen
// ongewijzigd uit KERF_GEWICHT in paar.js, zodat de overgang geen enkele daad zwaarder of
// lichter maakt dan hij was. De warme kant is nieuw: die bestond nergens.
//
// ELKE SLEUTEL HIER WORDT ÉRGENS GEBOEKT. Dat was niet zo: de tabel droeg een tijd lang vier
// sleutels — troon_verloren, kroketje, uitlenen en vergeven — die geen enkele aanroeper ooit
// meegaf. Een gewicht dat niemand toekent is geen regel maar een belofte, en wie de tabel leest
// denkt dat de frituur iets doet wat ze niet doet.
//
// `vergeven` is er bewust UIT en komt niet terug als gewicht. Vergiffenis loopt via strijkGlad,
// die de bladzijde in één keer op nul zet. Zou vergeven hier óók +2 geven, dan wordt twee keer
// vergeven KOUDER dan één keer: een verloren duel (−1) plus een kroketje op het vonnis (+2)
// staat op +1, en de claim-knop erna zet dat op 0. Twee gebaren, een koelere bladzijde, en de
// uitkomst hangt aan de volgorde waarin je drukt.
const DAAD_GEWICHT = {
  // vijandig — iets wat een ander jou aandeed zonder dat je ervoor koos
  roof_gelukt:    -2,
  duel_verloren:  -1,   // alleen als de ÁNDER het duel begon; wie zelf uitdaagt zocht het op
  premie_geind:   -1,
  // warm — iets wat een ander jou gaf en hem zelf iets kostte. Alles wat via legRelatieVast
  // binnenkomt (eer, een kroketje, een lening, een gunst, een ambtsdaad) landt hier: die daden
  // kosten de gever ongeveer evenveel, en boekDaad bewaart de soort toch niet — alleen het
  // gewicht. Eén sleutel is dus eerlijker dan drie die hetzelfde wegen.
  eerbewijs:       1,
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
//
// WAAROM `dader` ERBIJ. De bladzijde is symmetrisch, maar een vijandige daad is dat niet: iemand
// DEED hem. Wie dat was stond nergens, en zodra de duelinzet uit deze bladzijde gevoed wordt
// haalt de rover dezelfde verhoogde inzet uit zijn eigen roof als zijn slachtoffer. Standaard is
// de dader `b`, want dat is in deze codebase al de vaste volgorde voor alles wat gericht is —
// kerfSleutel(gekerkte, dader), claimSleutel(gekerkte, dader) — en boekVerlies roept boekDaad en
// maakClaim met precies datzelfde paar aan. Warme daden hebben geen dader en stempelen er dus
// ook geen; daar staat de gever juist op plek `a` (zie legRelatieVast in index.js). De vijandige
// aanroeper geeft `dader` tóch expliciet mee: een stille positionele afspraak op een functie die
// verder bewust ordeonafhankelijk is, is een val die precies één keer dichtklapt.
//
// LET OP de rolverdeling, die niet symmetrisch is: bij een WARME daad is `a` de gever en `b` de
// ontvanger, bij een vijandige daad is `a` juist het slachtoffer en `b` de dader. Zo staat het
// in de twee aanroepen in index.js, en de afkoopregel hieronder leunt erop — verander de ene
// niet zonder de andere. `claims` en `nu` komen van de aanroeper mee zodat deze module puur
// blijft en geen klok of bestand hoeft te kennen.
function boekDaad(boek, a, b, soort, dagSleutel, opties = {}) {
  const { dader = b, claims = null, nu = null } = opties;
  const gewicht = DAAD_GEWICHT[soort];
  if (!gewicht || !a || !b || a === b) return { boek, gewijzigd: false };
  // Wie iemand bestolen heeft poetst dat niet weg met een kroketje vóórdat zijn slachtoffer heeft
  // kunnen kiezen. Zolang de claim van `b` tegen `a` openstaat telt een warme daad van `a` naar
  // `b` niet mee: de gift zelf gaat gewoon door — hij betaalt, de ander ontvangt — alleen de
  // temperatuur tussen hen beweegt niet. Andersom blokkeert niets: het slachtoffer mág de dader
  // eren terwijl zijn claim loopt, dat is zíjn keuze en geen afkoopsom. Staat bewust vóór de
  // dagregel: een geblokkeerde daad mag het dagslot niet opsouperen en zo de volgende,
  // legitieme daad van diezelfde dag straffen.
  if (gewicht > 0 && claimStaatOpen(claims, b, a, nu)) {
    return { boek, gewijzigd: false, reden: 'open claim' };
  }
  const sleutel = paarSleutel(a, b);
  const rec = { waarde: 0, laatsteDag: null, laatsteDader: null, ...(boek?.[sleutel] || {}) };
  // Eén boeking per dag — maar een warme daad mag een vijandige van diezelfde dag wél
  // tegenspreken. Anders kan één roof 's ochtends een hele dag aan verzoening blokkeren, en
  // dat is precies de verkeerde kant om te blokkeren.
  //
  // Die vrijheid geldt sinds de afkoopregel hierboven nog maar ÉÉN kant op: het slachtoffer mag
  // de daad van diezelfde dag tegenspreken, de dader niet zolang zijn claim loopt. Zonder dat
  // onderscheid was "verzoening mag altijd" in de praktijk "de dader mag zichzelf vrijkopen".
  const zelfdeRichting = rec.laatsteDag === dagSleutel
    && Math.sign(gewicht) === Math.sign(rec.laatsteRichting || 0);
  if (zelfdeRichting) return { boek, gewijzigd: false };
  const nieuweWaarde = klem(rec.waarde + gewicht);
  // Een vijandige daad zet een nieuwe naam; een warme laat de oude staan, want verzoening maakt
  // de temperatuur warmer maar niet ongedaan wie hem koud maakte. Een dader die geen van beide
  // partijen is, is een aanroepfout — die valt terug op de standaard `b` en niet op níemand,
  // want een vijandige daad zonder naam is precies de toestand die dit veld moet uitroeien.
  const gestempeld = gewicht < 0
    ? ((dader === a || dader === b) ? dader : b)
    : (rec.laatsteDader || null);
  // Op nul of warmer valt er niets te verrekenen, dus hoort er ook geen dader meer te staan —
  // anders kleurt een allang uitgesleten wrok nog weken de inzet van een duel.
  const nieuweDader = nieuweWaarde < 0 ? gestempeld : null;
  // Aan het plafond verandert de temperatuur niet meer, maar de dader kan nog wél wisselen: wie
  // op −4 opnieuw toeslaat hoort de wrokbonus van zijn slachtoffer niet te houden omdat de schaal
  // toevallig vol is. Verandert ook de naam niet, dan is er echt niets gebeurd.
  if (nieuweWaarde === rec.waarde && nieuweDader === (rec.laatsteDader || null)) {
    return { boek, gewijzigd: false };
  }
  return {
    boek: { ...boek, [sleutel]: { ...rec, waarde: nieuweWaarde, laatsteDag: dagSleutel, laatsteRichting: Math.sign(gewicht), laatsteDader: nieuweDader } },
    gewijzigd: true,
    waarde: nieuweWaarde,
    toestand: toestandVan(nieuweWaarde),
    dader: nieuweDader,
  };
}

// Wie als laatste iets vijandigs deed op deze bladzijde, of null als er niets meer ligt. Lezen
// via de waarde en niet alleen via het veld: een bladzijde op nul of warmer heeft geen dader,
// ook niet als er een oude naam in het bestand is blijven staan.
//
// NOG NIET AANGESLOTEN, en dat is opzet. De volgende stap voedt `duelInzet` hiermee in plaats
// van met de kerfstok. Twee dingen die dán geregeld moeten worden en nu nog niet kloppen:
//   · Wederzijdse roof op dezelfde dag. De dagregel weigert de tweede boeking, dus blijft de
//     eerste naam staan: het tweede slachtoffer krijgt niets én staat zelf als dader geboekt.
//     De kerfstok kende dit niet — die heeft twee gerichte sleutels met elk hun eigen dag.
//   · `maakClaim` hangt niet aan `pb.gewijzigd`, dus in datzelfde geval zegt de Home-tab
//     "hij kraakte uw kluis" tegen iemand die hier als agressor staat. Twee helften van het
//     Paarboek die elkaar tegenspreken.
function daderVan(boek, a, b) {
  if (!a || !b || a === b) return null;
  const rec = boek?.[paarSleutel(a, b)];
  if (!rec || klem(rec.waarde || 0) >= 0) return null;
  return rec.laatsteDader || null;
}

// Zet een paar ineens op nul. Voor vergiffenis: dat is een gebaar, geen afbetaling in termijnen.
function strijkGlad(boek, a, b) {
  const sleutel = paarSleutel(a, b);
  const rec = boek?.[sleutel];
  if (!rec || !rec.waarde) return { boek, gewijzigd: false, was: 0 };
  // De dader gaat mee de prullenbak in: vergeven is het einde van de zaak, geen voetnoot erbij.
  return { boek: { ...boek, [sleutel]: { ...rec, waarde: 0, laatsteDader: null } }, gewijzigd: true, was: rec.waarde };
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
    // Slijt de bladzijde tot nul of warmer, dan slijt de dader mee weg — dezelfde regel als in
    // boekDaad, zodat er maar één plek is waar bepaald wordt wanneer een naam vervalt.
    uit[sleutel] = { ...rec, waarde: nieuw, laatsteSchuif: weekSleutel, laatsteDader: nieuw < 0 ? (rec.laatsteDader || null) : null };
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

// Staat er op dit moment een onbesliste claim van `gekerkte` tegen `dader`? Gericht, en de klok
// komt mee: dit is de enige vraag die de bladzijde aan de claim-ladder stelt. Zonder claims of
// zonder klok luidt het antwoord "nee" — een kapotte lezing mag een eerbewijs niet laten
// verdampen; de bladzijde is het minst erge dat hier mag afwijken.
function claimStaatOpen(claims, gekerkte, dader, nu) {
  if (!claims || !gekerkte || !dader || !Number.isFinite(nu)) return false;
  const c = claims[claimSleutel(gekerkte, dader)];
  return !!c && !c.gesloten && nu - c.ts < CLAIM_GELDIG_MS;
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
  daderVan,
  CLAIM_GELDIG_MS, CLAIM_KEUZES, claimSleutel,
  maakClaim, openClaimsVan, claimStaatOpen, sluitClaim, ruimOudeClaims,
};
