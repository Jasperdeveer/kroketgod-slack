// ── De waarde van een eerbewijs ────────────────────────────────────────────────
// Eer gaf voorheen blind 1 of 2 punten en de reden was optionele sfeertekst. Daarmee was eer
// geven een knop, niet een daad: wie 'omdat ie bestaat' typte kreeg exact hetzelfde als wie een
// werkelijke verdienste beschreef. Nu bepaalt de KWALITEIT van de reden de bandbreedte en de
// DOBBEL de uitkomst daarbinnen — 0 tot 5 punten.
//
// Waarom klasse → kansverdeling, en niet één cijfer van het model: een taalmodel dat direct
// "4 punten" mag zeggen is niet reproduceerbaar en niet af te stellen. Een model dat alleen
// hoeft te klassen (zwak/degelijk/sterk/legendarisch) doet iets waar het goed in is, en de
// puntenverdeling blijft hier staan — testbaar, en met een exact bekende verwachtingswaarde.
//
// Verwachtingswaarde per klasse (EV):
//   zwak         1,20   degelijk 2,05   sterk 3,20   legendarisch 4,30
//
// BIJGESTELD NA METING (29 september 2026). De eerste verdeling gaf zwak 40% kans op NUL, en een
// ijkbank tegen de echte jury liet zien wat dat in de praktijk betekende: over een corpus van
// achttien realistische redenen viel 11% van alle eerbewijzen op nul — en dan nog zonder de
// herhaalde redenen, die sowieso naar zwak gaan. Meer dan één nul per dag, en de eigenaar vond
// dat terecht te streng: eer die niets oplevert leert niemand iets, het frustreert alleen.
// Nu kan zwak nog steeds op nul uitkomen, maar als uitzondering (15%) in plaats van als regel.
// Dezelfde meting liet zien dat de bovenkant onbereikbaar was — zie de jury-prompt in index.js.

// Volgorde is betekenisvol: promoveerKlasse() stapt hier één plek in op.
const EER_KLASSEN = ['zwak', 'degelijk', 'sterk', 'legendarisch'];

// Per klasse: [punten, kans in HELE PROCENTEN]. Bewust integers en geen breuken: met 0,40 en
// 0,45 is de cumulatieve grens 0,8500000000000001, waardoor een worp van precies 0,85 in de
// verkeerde band viel. Procenten sommeren exact, dus de grenzen liggen waar ze horen te liggen.
// De kansen per klasse tellen op tot exact 100 — de test bewaakt dat, want een verdeling die op
// 99 uitkomt laat de hoogste worp stil naar de bodem terugvallen.
const EER_VERDELING = {
  zwak:         [[0, 15], [1, 50], [2, 35]],
  degelijk:     [[1, 25], [2, 45], [3, 30]],
  sterk:        [[2, 20], [3, 40], [4, 40]],
  legendarisch: [[3, 15], [4, 40], [5, 45]],
};

// Hoe de Frituurraad de klasse in het kanaal benoemt. Het oordeel hóórt zichtbaar te zijn:
// zonder dat is een lage worp niet te onderscheiden van willekeur en leert niemand iets.
const EER_KLASSE_LABEL = {
  zwak:         'een schrale reden',
  degelijk:     'een deugdelijke reden',
  sterk:        'een sterke reden',
  legendarisch: 'een legendarische reden',
};

// Ondergrens voor de reden. Bewust laag: dit is geen essay-eis maar een zeef tegen "ja", "top"
// en een losse punt. Alles wat erdoor komt mag de jury beoordelen — die is streng genoeg.
const EER_REDEN_MIN = 10;
const EER_REDEN_MAX = 300;

// Wat je terugkrijgt als je je eigen alliantie-partner eert. Hard maximum: één punt.
const ALLIANTIE_TERUGSLAG = 1;

// Hoelang een gebruikte reden "op" is. Dezelfde motivatie opnieuw inzetten is geen nieuwe
// verdienste; die zakt automatisch naar 'zwak' zonder dat er een LLM-call aan te pas komt.
const REDEN_HERHAAL_DAGEN = 14;

// Is deze reden bruikbaar? Geeft null bij goedkeuring, anders de aard van het probleem, zodat
// de aanroeper zelf de toon van de afwijzing kiest (slash-commando, modal of dashboard).
function redenProbleem(reden) {
  const schoon = String(reden == null ? '' : reden).trim();
  if (!schoon) return 'leeg';
  // Alleen leestekens of cijfers is geen reden — "........" haalde anders de lengte-eis.
  if (!/[a-zA-ZÀ-ÿ]{3}/.test(schoon)) return 'leeg';
  if (schoon.length < EER_REDEN_MIN) return 'kort';
  return null;
}

// Vingerafdruk voor herhaal-detectie: accenten weg, leestekens weg, ruis samengeperst. Zo is
// "Bracht kroketten mee!!" gelijk aan "bracht  kroketten mee" — wat het in de praktijk ook is.
function normaliseerReden(reden) {
  return String(reden == null ? '' : reden)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ── Huisonderwerpen ───────────────────────────────────────────────────────────
// Elk genootschap heeft zijn eigen heilige huisjes: dingen die voor een buitenstaander niets
// betekenen maar binnen de groep alles. De tavernehoek is daar de eerste van. Een LLM-jury kan
// dat per definitie niet weten — die leest "een wekenlange oefening op de tavernehoek zonder
// vorderingen" en ziet toewijding zonder resultaat, dus een schrale reden. In de groep is het
// precies andersom: juist dát verdient erkenning.
//
// Daarom een lijst die de eigenaar zelf beheert (instelling eerHuisonderwerpen, komma-gescheiden).
// Raakt een reden er een, dan gaat het oordeel één klasse omhoog — dezelfde promotie die de
// Dubbele Eer-zegen geeft, en ze stapelen: een gezegend huisonderwerp springt twee klassen.
//
// Bewust een losse substring-vergelijking en geen woordgrens: "tavernehoekje", "de tavernehoek"
// en "TAVERNEHOEK!!" moeten alle drie raken. Vals-positieven zijn hier goedkoop — het ergste wat
// gebeurt is dat iemand een punt te veel krijgt, en dat is precies de kant die we op willen.
function huisonderwerpenUit(instellingTekst) {
  return String(instellingTekst == null ? '' : instellingTekst)
    .split(',')
    .map(o => normaliseerReden(o))
    .filter(o => o.length >= 3);   // te korte fragmenten raken alles
}

// Geeft het geraakte onderwerp terug (om te kunnen benoemen), of null.
function raaktHuisonderwerp(reden, onderwerpen = []) {
  const tekst = normaliseerReden(reden);
  if (!tekst) return null;
  for (const o of onderwerpen) {
    if (o && tekst.includes(o)) return o;
  }
  return null;
}

function isGeldigeKlasse(klasse) {
  return EER_KLASSEN.includes(klasse);
}

// Trekt de klasse uit een vrij jury-antwoord. Het model krijgt de opdracht één woord te geven,
// maar levert in de praktijk soms "Klasse: STERK." of een verbogen vorm ("zwakke reden") — beide
// moeten gewoon werken. Bij twijfel de EERSTE klasse die voorkomt; bij niets herkenbaars null,
// zodat de aanroeper naar zijn vangnet kan vallen in plaats van stil 'zwak' toe te kennen.
function parseerKlasse(ruw) {
  const tekst = normaliseerReden(ruw);
  if (!tekst) return null;
  let beste = null;
  let positie = Infinity;
  for (const klasse of EER_KLASSEN) {
    const idx = tekst.indexOf(klasse);
    if (idx !== -1 && idx < positie) { positie = idx; beste = klasse; }
  }
  return beste;
}

// De dobbel binnen de klasse. rng is injecteerbaar zodat de test elke uitkomst kan afdwingen.
function worpVoorKlasse(klasse, rng = Math.random) {
  const verdeling = EER_VERDELING[isGeldigeKlasse(klasse) ? klasse : 'degelijk'];
  const worp = Math.floor(rng() * 100); // 0-99, en de cumulatieve grenzen zijn hele getallen
  let som = 0;
  for (const [punten, kans] of verdeling) {
    som += kans;
    if (worp < som) return punten;
  }
  // Onbereikbaar zolang de kansen op 100 optellen, maar een rng die exact 1 teruggeeft levert
  // worp 100 op en mag geen undefined geven — dat zou als NaN in de scores landen.
  return verdeling[verdeling.length - 1][0];
}

// Eén klasse omhoog. Zo werkt de Dubbele Eer-zegen op deze schaal: verdubbelen kan niet, want
// elke boeking wordt hard op 5 geklemd (3×2 en 5×2 zijn dan hetzelfde) en dat maakt de zegen
// juist bij een goede reden waardeloos. Promotie is overal merkbaar en houdt 0 punten vrijwel
// buiten bereik — precies wat een gekochte zegen hoort te doen.
function promoveerKlasse(klasse) {
  const idx = EER_KLASSEN.indexOf(klasse);
  if (idx === -1) return 'degelijk';
  return EER_KLASSEN[Math.min(idx + 1, EER_KLASSEN.length - 1)];
}

// Verwachtingswaarde van een klasse. Niet gebruikt in het spel zelf — dit is het gereedschap
// waarmee de test de balans bewaakt, zodat een latere tweak aan de verdeling niet ongemerkt
// een klasse boven zijn opvolger uit laat komen.
function verwachtingVoorKlasse(klasse) {
  const verdeling = EER_VERDELING[isGeldigeKlasse(klasse) ? klasse : 'degelijk'];
  return verdeling.reduce((som, [punten, kans]) => som + punten * kans, 0) / 100;
}

// Is deze reden door dezelfde gever recent al gebruikt? `eerder` is een lijst van
// { h, ts }-vingerafdrukken; nu is injecteerbaar voor de test.
function isHerhaaldeReden(reden, eerder = [], nu = Date.now()) {
  const h = normaliseerReden(reden);
  if (!h) return false;
  const grens = nu - REDEN_HERHAAL_DAGEN * 86_400_000;
  return eerder.some(e => e && e.h === h && (e.ts || 0) > grens);
}

// Voegt een vingerafdruk toe en gooit weg wat buiten het venster valt. Geeft een nieuwe lijst
// terug (geen mutatie), zodat de aanroeper zelf beslist wanneer hij wegschrijft.
function onthoudReden(reden, eerder = [], nu = Date.now()) {
  const h = normaliseerReden(reden);
  const grens = nu - REDEN_HERHAAL_DAGEN * 86_400_000;
  const bewaard = eerder.filter(e => e && e.h && (e.ts || 0) > grens && e.h !== h);
  bewaard.push({ h, ts: nu });
  // Plafond tegen ongelimiteerde groei bij een fanatieke gever: 60 redenen dekt 14 dagen
  // ruimschoots bij een daglimiet van 3.
  return bewaard.slice(-60);
}

module.exports = {
  EER_KLASSEN,
  EER_VERDELING,
  EER_KLASSE_LABEL,
  EER_REDEN_MIN,
  EER_REDEN_MAX,
  ALLIANTIE_TERUGSLAG,
  REDEN_HERHAAL_DAGEN,
  redenProbleem,
  normaliseerReden,
  isGeldigeKlasse,
  huisonderwerpenUit,
  raaktHuisonderwerp,
  parseerKlasse,
  worpVoorKlasse,
  promoveerKlasse,
  verwachtingVoorKlasse,
  isHerhaaldeReden,
  onthoudReden,
};
