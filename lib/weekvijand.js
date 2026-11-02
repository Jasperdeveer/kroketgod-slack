// ── De weekvijand slaat terug: rekenregels ────────────────────────────────────
//
// Aanleiding (2 nov 2026): alle tien vijanden sinds augustus vielen, meestal op woensdag, door drie
// à vier strijders. Er stond nooit iets op het spel, en de vijand deed zelf niets. Nu:
//
//   STERKER. 7 HP per actief lid (was 4). Geijkt met een simulatie van het echte gedrag (4 vaste
//     strijders van de 6, 85% kans per dag, de helft offert): een gemiddelde vijand valt dan in
//     ~70% van de weken, op vrijdag; een milde (×0,8) bijna altijd op donderdag; een zware (×1,3)
//     alleen als vijf à zes leden meedoen. Met drie strijders ontsnapt hij meestal.
//   TERUGSLAG. Na elke aanval die hem niet velt slaat hij met kans terug: de aanvaller verliest
//     1 kroketpunt aan zijn BUIT. Wordt hij verslagen, dan krijgt iedereen terug wat hij verloor;
//     ontsnapt hij, dan is de buit weg. Zo is een aanval een inzet en is het vellen urgent.
//   RAZEND. Onder de helft van zijn HP slaat hij vaker terug.
//   ZIJN BEURT. Elke middag (di–vr) doet hij zelf iets: vochten er sinds zijn vorige beurt minder
//     dan de helft van de leden, dan HERSTELT hij (wie niet vecht, voedt hem); anders neemt hij
//     WRAAK op wie hem het zwaarst toetakelde.
//   WROK MET EEN EIND. Een ontsnapte vijand kwam elke week sterker terug, zonder plafond. Nu het
//     ontsnappen echt gebeurt zou dat een vijand opleveren die nooit meer valt; na twee keer terug
//     verdwijnt hij in de frituur. Hij blijft in de trekking (hij is nooit verslagen) en kan dus
//     ooit opnieuw opduiken, als nieuwe vijand zonder wrok.
//
// Puur: geen I/O, geen klok — toeval komt als argument binnen. Zie weekvijand.test.js.

'use strict';

const HP_PER_LID = 7;
const MIN_HP = 12;
const WROK_STAP = 0.2;      // +20% HP per week dat hij ongestraft terugkeert
const WROK_MAX = 2;         // hooguit twee keer terug, dan is hij weg
const TERUGSLAG_KANS = 0.25;
const TERUGSLAG_RAZEND = 0.4;
const HERSTEL_FRACTIE = 0.1;

// ── Gaven: elke snack een eigen gave ──────────────────────────────────────────
// Elke vijand heeft een eigen gave (naam en tekst bij zijn karakter); daaronder zitten dertien
// soorten effecten. Twee families:
//   TAAI (pantser, ontwijk, offerdoof, samen, taai, hongerig, dikhuid) maakt hem lastiger te vellen.
//     Die soorten leveren HP in (`hp`), geijkt met een simulatie: met 4 strijders blijft de winkans
//     rond de 70%, net als zonder gave. Ze veranderen dus HOE je vecht, niet hoe zwaar de week is;
//     dat blijft de hpFactor van de snack. Daarom zitten ze bij de lichte snacks (hpFactor ≤ 1).
//   GEMEEN (stekels, hebzucht, kortlontje, wraakzucht, plunderaar, explosief) kost punten, geen
//     HP. Die zitten bij de zware snacks: daar staat al het meest op het spel.
const GAVE_SOORTEN = {
  pantser:    { hp: 0.8,  regel: 'klappen van 3 of meer schade verliezen 1' },
  ontwijk:    { hp: 0.85, regel: '15% van de aanvallen mist' },
  offerdoof:  { hp: 0.8,  regel: 'offer-aanvallen werken niet tegen hem' },
  samen:      { hp: 0.95, regel: 'de eerste twee aanvallen van elke dag doen 1 minder, vanaf de derde 1 meer' },
  taai:       { hp: 0.8,  regel: 'herstelt elke middag 5% extra' },
  hongerig:   { hp: 0.85, regel: 'herstelt al als minder dan twee derde van de leden vocht' },
  dikhuid:    { hp: 1.2,  regel: '20% meer HP, maar offer-aanvallen doen 1 extra' },
  stekels:    { regel: 'slaat 15% vaker terug' },
  hebzucht:   { regel: 'zijn terugslag steelt 2 punten' },
  kortlontje: { regel: 'wordt al razend onder 75% HP' },
  wraakzucht: { regel: 'zijn wraak treft de twee zwaarste belagers' },
  plunderaar: { regel: 'plundert bij ontsnapping tot 2 punten van de top 3' },
  explosief:  { regel: 'wie hem velt, verliest 1 punt aan de knal' },
};

// Sleutels zijn die van WEEKVIJANDEN in index.js; weekvijand.test.js controleert dat ze één op één kloppen.
const GAVEN = {
  bamischijf:            { soort: 'taai',       naam: 'Eeuwenoud',               tekst: 'Hij overleefde eeuwen in het donker. Een middag rust is genoeg om te helen.' },
  kipnuggets:            { soort: 'taai',       naam: 'Er zijn er altijd meer',  tekst: 'Wie er één velt, ziet er twee terugkomen uit de doos.' },
  bapao:                 { soort: 'taai',       naam: 'Innerlijke rust',         tekst: 'Hij mediteert zijn wonden dicht.' },
  zure_haring:           { soort: 'taai',       naam: 'Ingelegd',                tekst: 'Zuur conserveert. Hij bederft niet, hij herstelt.' },
  kaasstengel_xl:        { soort: 'taai',       naam: 'Smelt weer dicht',        tekst: 'Elke snee vloeit vanzelf weer aan elkaar.' },
  kaassouffle:           { soort: 'ontwijk',    naam: 'Smeuïg',                  tekst: 'Klappen glijden van hem af als kaas van een mes.' },
  kipcorn:               { soort: 'ontwijk',    naam: 'Schichtig',               tekst: 'Hij duikt weg met een excuus, en vaak net op tijd.' },
  loempia:               { soort: 'ontwijk',    naam: 'Glad als olie',           tekst: 'Hij rolt om elke klap heen, zoals om elke vraag.' },
  frietsaus:             { soort: 'ontwijk',    naam: 'Is het wel mayonaise?',   tekst: 'Niemand weet precies wat hij is, dus soms slaat u ernaast.' },
  kibbeling:             { soort: 'ontwijk',    naam: 'Glipt terug de zee in',   tekst: 'Een vis die u vastpakt, heeft u nog niet.' },
  mini_loempia:          { soort: 'ontwijk',    naam: 'Alle kanten op',          tekst: 'Acht kinderen die wegrennen: u mept geregeld in de lucht.' },
  eierbal:               { soort: 'pantser',    naam: 'Hard gekookt',            tekst: 'Onder het paneer zit een ei dat niet wijkt.' },
  slavink:               { soort: 'pantser',    naam: 'Spekjas',                 tekst: 'Gewikkeld in spek, als in een harnas van vroeger.' },
  ui_ringen:             { soort: 'pantser',    naam: 'Laag na laag',            tekst: 'Sla er één laag af en er zit er nog een.' },
  tosti:                 { soort: 'pantser',    naam: 'Platgeperst',             tekst: 'Hij ging door het tostiapparaat. Veel harder dan dat slaat u niet.' },
  gehaktstaaf:           { soort: 'offerdoof',  naam: 'Formulier ontbreekt',     tekst: 'Een offer zonder formulier wordt niet in behandeling genomen.' },
  patat_met:             { soort: 'offerdoof',  naam: 'Geen poespas',            tekst: 'Offers en ander gedoe laten hem koud. Gewoon slaan.' },
  saucijzenbroodje:      { soort: 'offerdoof',  naam: 'Geen vet in de bakkerij', tekst: 'Hij weigert alles wat naar frituurvet ruikt, offers incluis.' },
  bitterbal:             { soort: 'offerdoof',  naam: 'Neus in de lucht',        tekst: 'Offers van het plebs neemt hij niet aan.' },
  kroepoek:              { soort: 'samen',      naam: 'Breekt pas onder druk',   tekst: 'Losse tikjes overleeft hij; een salvo laat hem verkruimelen.' },
  appelbeignet:          { soort: 'samen',      naam: 'Te lief',                 tekst: 'Wie hem alleen aanvalt, krijgt medelijden. Pas in een groep slaat u door.' },
  kaastengel:            { soort: 'samen',      naam: 'Volgens protocol',        tekst: 'Pas vanaf de derde aanvrager van de dag wordt uw klap in behandeling genomen.' },
  joppiesaus:            { soort: 'hongerig',   naam: 'Bekeringsdrang',          tekst: 'Wie wegblijft, bekeert hij. Hij leeft van de afwezigen.' },
  broodje_bal:           { soort: 'hongerig',   naam: 'Nog een hapje',           tekst: 'Wie niet komt eten, laat meer voor hem over.' },
  krokante_ui:           { soort: 'hongerig',   naam: 'Overal op',               tekst: 'Waar niemand kijkt, strooit hij zichzelf weer bij elkaar.' },
  nasischijf:            { soort: 'dikhuid',    naam: 'Een heel werelddeel',     tekst: 'Er zit een continent in hem geperst. Groot, maar ook een groot doelwit.' },
  pikanto:               { soort: 'dikhuid',    naam: 'Groter dan de Mexicano',  tekst: 'Hij blies zichzelf op om de Mexicano te overtreffen. Vuur raakt hem makkelijk.' },
  oliebol:               { soort: 'dikhuid',    naam: 'Deegbal',                 tekst: 'Een bol deeg vol lucht en rozijnen: veel om door te slaan, maar hij vat vlam.' },
  bamiblok:              { soort: 'dikhuid',    naam: 'Rechte hoeken',           tekst: 'Een blok is een blok: groot, maar je mist het niet.' },
  hotdog:                { soort: 'dikhuid',    naam: 'Supersized',              tekst: 'Everything is bigger in America, ook het doelwit.' },
  mexicano:              { soort: 'stekels',    naam: 'Levensgevaarlijk',        tekst: 'Hij kondigt het al dagen aan, en deze keer meent hij het.' },
  kapsalon:              { soort: 'stekels',    naam: 'Eindbaas',                tekst: 'Alles tegelijk, en alles slaat terug.' },
  airfryer_kroket:       { soort: 'stekels',    naam: 'Hete lucht',              tekst: 'Wie dichtbij komt, krijgt een stoot hete lucht in het gezicht.' },
  frikandel_xxl:         { soort: 'stekels',    naam: 'Lange arm',               tekst: 'Met zijn lengte reikt hij verder dan u denkt.' },
  frikandel_speciaal:    { soort: 'hebzucht',   naam: 'Belastingverhoging',      tekst: 'Hij belooft iedereen alles en int dubbel.' },
  berenklauw:            { soort: 'hebzucht',   naam: 'Klauw',                   tekst: 'Wat hij grijpt, grijpt hij met vijf nagels.' },
  valse_kroket:          { soort: 'hebzucht',   naam: 'Valse munt',              tekst: 'Hij ruilt uw punt tegen een vals exemplaar, en neemt er nog een.' },
  cheeseburger:          { soort: 'hebzucht',   naam: 'Upsize',                  tekst: 'Wilt u daar een extra punt bij? Dat was geen vraag.' },
  viandel:               { soort: 'kortlontje', naam: 'Gekrenkte trots',         tekst: 'Eén opmerking over zijn afkomst en hij ontploft.' },
  lekkerbekje:           { soort: 'kortlontje', naam: 'Altijd vergeleken',       tekst: 'Noem de Kibbeling en hij ziet rood.' },
  sitostick:             { soort: 'kortlontje', naam: 'Pre-workout',             tekst: 'Hij heeft net een shake op en is bij de eerste set al woest.' },
  patatje_oorlog:        { soort: 'wraakzucht', naam: 'Tweefrontenoorlog',       tekst: 'Hij vecht op twee fronten tegelijk.' },
  curryworst:            { soort: 'wraakzucht', naam: 'Ordnung muss sein',       tekst: 'Hij houdt een lijst bij van wie hem raakte. Bovenaan staan er twee.' },
  patat_speciaal:        { soort: 'wraakzucht', naam: 'Drie hoofden',            tekst: 'Drie stemmen die het nergens over eens zijn, behalve over wraak.' },
  gehaktbal:             { soort: 'wraakzucht', naam: 'Patriarch',               tekst: 'Hij straft de twee brutaalsten, zoals vroeger aan tafel.' },
  hamburger:             { soort: 'plunderaar', naam: 'Effe lenen, ouwe',        tekst: 'Als hij gaat, neemt hij wat mee. Moet toch kunnen.' },
  shoarma:               { soort: 'plunderaar', naam: 'Nachtelijke rooftocht',   tekst: 'Om twee uur ’s nachts is hij weg, en uw punten ook.' },
  broodje_gezond:        { soort: 'plunderaar', naam: 'Suikertaks',              tekst: 'Ontsnapt hij, dan belast hij de rijksten extra. Voor hun eigen bestwil.' },
  friet_speciaal_oorlog: { soort: 'plunderaar', naam: 'Oorlogsbuit',             tekst: 'Wie de oorlog niet wint, betaalt hem.' },
  vlammetjes:            { soort: 'explosief',  naam: 'Steekvlam',               tekst: 'Wie de laatste vlam dooft, brandt zijn vingers.' },
  gefrituurde_mars:      { soort: 'explosief',  naam: 'Kokende karamel',         tekst: 'Wie hem openbreekt, krijgt de karamel over zich heen.' },
  magnetron_kroket:      { soort: 'explosief',  naam: 'Kokend hart',             tekst: 'Lauw van buiten, kokend van binnen. Bijt erin en u verbrandt uw tong.' },
};

// De gave van een vijand, met de spelregel erbij; null voor een onbekende sleutel.
function gaveVan(key) {
  const g = GAVEN[key];
  return g ? { ...g, regel: GAVE_SOORTEN[g.soort].regel } : null;
}

function maxHpVoor(ledental, hpFactor = 1, wrok = 0, gave = null) {
  const gaveHp = GAVE_SOORTEN[gave?.soort]?.hp || 1;
  return Math.max(MIN_HP, Math.round(ledental * HP_PER_LID * hpFactor * gaveHp * (1 + WROK_STAP * wrok)));
}

function isRazend(raid, gave = null) {
  return raid.hp > 0 && raid.hp <= raid.maxHp * (gave?.soort === 'kortlontje' ? 0.75 : 0.5);
}

function slaatTerug(raid, worp, gave = null) {
  const kans = (isRazend(raid, gave) ? TERUGSLAG_RAZEND : TERUGSLAG_KANS) + (gave?.soort === 'stekels' ? 0.15 : 0);
  return raid.hp > 0 && worp < kans;
}

// Hoeveel punten één terugslag steelt (de aanroeper kapt af op wat de aanvaller heeft).
function terugslagBuit(gave = null) {
  return gave?.soort === 'hebzucht' ? 2 : 1;
}

// Schade na de gave. `aanvalNr`: hoeveel leden hem vandaag al aanvielen; `worp`: toeval voor ontwijken.
function schadeNaGave(schade, gave, { metOffer = false, aanvalNr = 0, worp = 1 } = {}) {
  switch (gave?.soort) {
    case 'pantser': return schade >= 3 ? schade - 1 : schade;
    case 'ontwijk': return worp < 0.15 ? 0 : schade;
    case 'samen':   return aanvalNr < 2 ? Math.max(1, schade - 1) : schade + 1;
    case 'dikhuid': return metOffer ? schade + 1 : schade;
    default:        return schade;
  }
}

// Leeft de vorige vijand nog en mag hij nog een week terugkomen?
function komtTerug(raid) {
  return !!raid.vijand && !raid.verslagen && (raid.hp ?? 0) > 0 && (raid.wrok || 0) < WROK_MAX;
}

// Zijn dagelijkse zet. `ledental`: leden die mee kunnen vechten (geen balling, niet afwezig);
// `scores`: de huidige kroketpunten, want wraak op een lege buidel is geen wraak.
// Herstel én wraak kunnen samen voorkomen: een taaie vijand heelt ook op een wraakdag.
function vijandBeurt(raid, ledental, scores, gave = null) {
  const vochten = (raid.sindsBeurt || []).length;
  const ruimte = raid.maxHp - raid.hp;
  const taai = gave?.soort === 'taai' ? Math.max(1, Math.round(raid.maxHp * 0.05)) : 0;
  if (vochten < ledental * (gave?.soort === 'hongerig' ? 2 / 3 : 1 / 2)) {
    const herstel = Math.min(ruimte, Math.max(1, Math.round(raid.maxHp * HERSTEL_FRACTIE)) + taai);
    return { soort: 'herstel', herstel, doelwitten: [], vochten };
  }
  const doelwitten = Object.entries(raid.strijders || {})
    .filter(([uid]) => (scores[uid] || 0) >= 1)
    .sort((a, b) => (b[1].schade || 0) - (a[1].schade || 0))
    .slice(0, gave?.soort === 'wraakzucht' ? 2 : 1)
    .map(([uid]) => uid);
  return { soort: 'wraak', herstel: Math.min(ruimte, taai), doelwitten, vochten };
}

module.exports = {
  HP_PER_LID, WROK_MAX, TERUGSLAG_KANS, TERUGSLAG_RAZEND, GAVEN, GAVE_SOORTEN,
  gaveVan, maxHpVoor, isRazend, slaatTerug, terugslagBuit, schadeNaGave, komtTerug, vijandBeurt,
};
