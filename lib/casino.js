// ── Het Casino: blackjack en roulette ────────────────────────────────────────
//
// Alleen de spelregels en de uitbetaling. De vensters, de punten en de state staan in index.js.
//
// INZET. De regels van het Vetbad (nooit meer dan de helft van het bezit), maar hoogstens
// MAX_INZET per spel (keuze van de eigenaar).
//
// BLACKJACK. Eén vers geschud spel van 52 kaarten per hand. De bank pakt tot 17 en blijft staan
// op een zachte 17. Blackjack betaalt 3:2; een half punt (oneven inzet) wordt met 50% kans een heel
// punt (rondEerlijkAf). Vroeger naar beneden: dan betaalde een inzet van 1 maar 1:1. Verdubbelen
// mag op de eerste twee kaarten (één kaart erbij, dan staan). Geen splitsen, geen verzekering.
// Heeft de bank blackjack, dan is de hand meteen voorbij.
//
// ROULETTE. Europees wiel, één nul (huisvoordeel 2,7%). Een los getal betaalt 35:1 maar mag met
// hoogstens LOS_GETAL_MAX punt: met de gewone inzet is één draai +350, en dat gooit de ranglijst
// om (keuze van de eigenaar).
//
// GOKKAST. Drie rollen met snacks uit de werkruimte. Drie gelijke of twee gelijke betalen naar
// het symbool (zie GOKKAST), 95,7% terug. Drie keer de Kroket God betaalt 8×: met de hoogste
// inzet +35, dezelfde grootste klapper als een los getal bij roulette. Alleen PNG- en JPEG-emoji
// (resvg leest geen WebP), en geen gezichten van leden: de plaatjes staan openbaar.
//
// HOGER/LAGER. Een kaart open (2 laag, aas hoog); raad of de volgende hoger of lager is. Gelijk telt
// niet: de pot blijft staan en de speler raadt opnieuw (5 november 2026; daarvoor was gelijk altijd
// verlies, en dat voelde als valsspelen). Een goede gok vermenigvuldigt de pot met HL_MARGE gedeeld
// door de kans zónder de gelijke kaarten, dus elke beslissende gok kost gemiddeld 5%. Op een aas
// (lager) of een twee (hoger) kan het niet mis; die gok betaalt ×1, een gratis nieuwe kaart. Cashen
// kan altijd; het restje achter de komma wordt met precies die kans een extra punt (rondEerlijkAf).
// Naar beneden afronden kostte de spelers met hun gewone inzet 7 tot 20% extra.
// De pot stopt bij HL_MAX × de inzet. Elke kaart komt uit een vers spel: de kans hangt alleen van
// de open kaart af.
//
// DOBBELEN. Twee stenen. Onder of boven 7 betaalt 1:1 en een 7 geeft de inzet terug (eerlijk);
// precies 7 betaalt 4:1 (huisvoordeel 17%).
//
// SCHUIFKAST (coin pusher, 10 november 2026). Eén gedeelde tafel voor alle leden met munten op een
// vaste plek (x, d = afstand tot de voorrand). Wie speelt, gooit zijn inzet als munten achterin, en
// de schuif duwt de hele stapel per munt een willekeurig stuk naar voren (skDuw). Wat over de rand
// gaat, valt in de bak en is van de speler; ligt hij boven een van de zijgaten, dan is hij van het
// huis. Munten liggen op een willekeurige x en schuiven alleen naar voren, dus precies SK_HUIS (5%)
// van alles wat valt, gaat naar het huis. Wat er blijft liggen, schuift de volgende speler eraf: wie
// een volle rand ziet, speelt met de wind mee. Bij de opening legt het huis SK_START munten neer.
// Het Gefluisterde Voorrecht werkt hier niet: de tafel ligt vol munten van andere leden.
//
// Uitbetalingen zijn BRUTO: wat er terugkomt, inzet inbegrepen. 0 is verloren, de inzet is gelijk.
//
// HUISVOORDEEL (5 november 2026, nagerekend in casino.test.js): roulette 2,7%; gokkast 4,3%;
// dobbelen onder/boven 0% en precies 7 16,7%; hoger/lager 5% per beslissende gok; blackjack zonder
// splitsen rond 0,5% (simulatie met basisstrategie); schuifkast 5% (op de lange duur, per worp wisselt
// het met de stand van de tafel).
//
// Puur: geen I/O en geen Math.random — de aanroeper geeft `rnd` mee. Zie casino.test.js.

'use strict';

const MAX_INZET = 5;
const LOS_GETAL_MAX = 1;

// Een bedrag met een restje naar hele punten: het restje wordt met precies die kans een punt extra.
// Gemiddeld komt er dus precies `bedrag` uit, zonder dat het huis of de speler aan afronding verdient.
function rondEerlijkAf(bedrag, rnd) {
  const vast = Math.floor(bedrag + 1e-9);
  const rest = bedrag - vast;
  return rest > 1e-9 && rnd() < rest ? vast + 1 : vast;
}

// ── Blackjack ────────────────────────────────────────────────────────────────

const RANGEN = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const KLEUREN = ['♠', '♥', '♦', '♣'];

function geschudSpel(rnd) {
  const spel = KLEUREN.flatMap(k => RANGEN.map(r => r + k));
  for (let i = spel.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [spel[i], spel[j]] = [spel[j], spel[i]];
  }
  return spel;
}

// { totaal, zacht }: zacht = er telt een aas als 11.
function handWaarde(kaarten) {
  let totaal = 0, azen = 0;
  for (const k of kaarten) {
    const r = k.slice(0, -1);
    if (r === 'A') { totaal += 11; azen++; }
    else totaal += ['J', 'Q', 'K'].includes(r) ? 10 : Number(r);
  }
  while (totaal > 21 && azen) { totaal -= 10; azen--; }
  return { totaal, zacht: azen > 0 };
}

const isBlackjack = (kaarten) => kaarten.length === 2 && handWaarde(kaarten).totaal === 21;

// Een nieuwe hand. `klaar` als speler of bank meteen blackjack heeft.
function deel(rnd, inzet) {
  const stapel = geschudSpel(rnd);
  const speler = [stapel.pop(), stapel.pop()];
  const bank = [stapel.pop(), stapel.pop()];
  return { stapel, speler, bank, inzet, klaar: isBlackjack(speler) || isBlackjack(bank) };
}

// Speler pakt een kaart; boven 21 is de hand klaar, op 21 past hij vanzelf.
function kaart(hand) {
  const stapel = [...hand.stapel];
  const speler = [...hand.speler, stapel.pop()];
  const totaal = handWaarde(speler).totaal;
  const nieuw = { ...hand, stapel, speler, klaar: totaal > 21 };
  return totaal === 21 ? speelBank(nieuw) : nieuw;
}

// Verdubbelen: dubbele inzet, precies één kaart, dan speelt de bank.
function verdubbel(hand) {
  return speelBank({ ...kaart(hand), inzet: hand.inzet * 2, verdubbeld: true });
}

// Speler past: de bank pakt tot 17 (staat op zachte 17). Een gekochte speler laat de bank stil.
function speelBank(hand) {
  const stapel = [...hand.stapel];
  const bank = [...hand.bank];
  if (handWaarde(hand.speler).totaal <= 21) while (handWaarde(bank).totaal < 17) bank.push(stapel.pop());
  return { ...hand, stapel, bank, klaar: true };
}

const magVerdubbelen = (hand) => !hand.klaar && hand.speler.length === 2;

// Bruto uitbetaling van een afgelopen hand. `rnd` alleen nodig voor blackjack met een oneven inzet.
function blackjackUitbetaling({ speler, bank, inzet }, rnd) {
  const s = handWaarde(speler).totaal, b = handWaarde(bank).totaal;
  const sBJ = isBlackjack(speler), bBJ = isBlackjack(bank);
  if (sBJ && bBJ) return inzet;
  if (sBJ) return inzet + rondEerlijkAf(inzet * 3 / 2, rnd);
  if (bBJ || s > 21) return 0;
  if (b > 21 || s > b) return inzet * 2;
  return s === b ? inzet : 0;
}

// ── Roulette ─────────────────────────────────────────────────────────────────

const RODE = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// factor = winst per ingezet punt.
const INZETSOORTEN = {
  rood:    { naam: '🔴 Rood',          factor: 1,  wint: n => RODE.has(n) },
  zwart:   { naam: '⚫ Zwart',         factor: 1,  wint: n => n > 0 && !RODE.has(n) },
  even:    { naam: 'Even',             factor: 1,  wint: n => n > 0 && n % 2 === 0 },
  oneven:  { naam: 'Oneven',           factor: 1,  wint: n => n % 2 === 1 },
  laag:    { naam: 'Laag (1–18)',      factor: 1,  wint: n => n >= 1 && n <= 18 },
  hoog:    { naam: 'Hoog (19–36)',     factor: 1,  wint: n => n >= 19 },
  dozijn1: { naam: '1e dozijn (1–12)', factor: 2,  wint: n => n >= 1 && n <= 12 },
  dozijn2: { naam: '2e dozijn (13–24)', factor: 2, wint: n => n >= 13 && n <= 24 },
  dozijn3: { naam: '3e dozijn (25–36)', factor: 2, wint: n => n >= 25 },
  getal:   { naam: 'Los getal',        factor: 35, wint: (n, getal) => n === getal },
};

const kleurVan = (n) => (n === 0 ? 'groen' : RODE.has(n) ? 'rood' : 'zwart');
const draai = (rnd) => Math.floor(rnd() * 37);

function rouletteUitbetaling(soort, inzet, uitkomst, getal = null) {
  const s = INZETSOORTEN[soort];
  return s && s.wint(uitkomst, getal) ? inzet * (s.factor + 1) : 0;
}

// Toetst een roulette-inzet bovenop de gewone inzetregels: { veld, tekst } of null.
function toetsRoulette(soort, inzet, getal) {
  if (!INZETSOORTEN[soort]) return { veld: 'soort', tekst: 'Kies waarop u inzet.' };
  if (soort !== 'getal') return null;
  if (!Number.isInteger(getal) || getal < 0 || getal > 36) return { veld: 'getal', tekst: 'Kies een getal van 0 tot en met 36.' };
  if (inzet > LOS_GETAL_MAX) return { veld: 'inzet', tekst: `Op een los getal zet u hoogstens ${LOS_GETAL_MAX} punt in.` };
  return null;
}

// ── Gokkast ──────────────────────────────────────────────────────────────────

// Op volgorde van zeldzaamheid. `drie`/`twee`: bruto factor bij drie of precies twee gelijke.
const GOKKAST = [
  { emoji: 'lekker_kroketje', gewicht: 3, drie: 4, twee: 1 },
  { emoji: 'bosschebol', gewicht: 3, drie: 4, twee: 1 },
  { emoji: 'worstenbrood', gewicht: 2, drie: 6, twee: 2 },
  { emoji: 'illuminati-kroket', gewicht: 2, drie: 6, twee: 2 },
  { emoji: 'ongepaneerde-kroket-god', gewicht: 1, drie: 8, twee: 3 },
];
const GOKKAST_GEWICHT = GOKKAST.reduce((som, s) => som + s.gewicht, 0);

function rol(rnd) {
  let worp = rnd() * GOKKAST_GEWICHT;
  for (const s of GOKKAST) if ((worp -= s.gewicht) < 0) return s.emoji;
  return GOKKAST[0].emoji;
}
const trekHendel = (rnd) => [rol(rnd), rol(rnd), rol(rnd)];

function gokkastFactor(rollen) {
  for (const s of GOKKAST) {
    const n = rollen.filter(r => r === s.emoji).length;
    if (n === 3) return s.drie;
    if (n === 2) return s.twee;
  }
  return 0;
}
const gokkastUitbetaling = (rollen, inzet) => inzet * gokkastFactor(rollen);

// ── Hoger/Lager ──────────────────────────────────────────────────────────────

const HL_MARGE = 0.95;
const HL_MAX = 10;
const HL_RANGEN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const hlRang = (kaart) => HL_RANGEN.indexOf(kaart.slice(0, -1)); // 0 (twee) tot 12 (aas)
const trekLosseKaart = (rnd) => HL_RANGEN[Math.floor(rnd() * 13)] + KLEUREN[Math.floor(rnd() * 4)];

// Kans dat de gok goed is; de rest van de 13 rangen is gelijk (1/13) of fout.
function hlKans(kaart, keuze) {
  const r = hlRang(kaart);
  return (keuze === 'hoger' ? 12 - r : r) / 13;
}
// Waarmee een goede gok de pot vermenigvuldigt: HL_MARGE gedeeld door de kans als gelijk niet meetelt,
// en nooit onder 1. 0 als de gok niet kan winnen.
const hlFactor = (kaart, keuze) => (hlKans(kaart, keuze) > 0 ? Math.max(1, HL_MARGE * 12 / 13 / hlKans(kaart, keuze)) : 0);
const hlGelijk = (hand) => hand.kaarten.length > 1 && hlRang(hand.kaarten.at(-1)) === hlRang(hand.kaarten.at(-2));

const hlStart = (rnd, inzet) => ({ spel: 'hogerlager', inzet, pot: inzet, kaarten: [trekLosseKaart(rnd)], klaar: false });

function hlRaad(hand, keuze, rnd) {
  const open = hand.kaarten.at(-1);
  let nieuw = trekLosseKaart(rnd);
  // Alleen de rang telt; twee keer precies dezelfde kaart op rij oogt als een fout van de bank.
  if (nieuw === open) nieuw = nieuw.slice(0, -1) + KLEUREN[(KLEUREN.indexOf(open.slice(-1)) + 1) % 4];
  const kaarten = [...hand.kaarten, nieuw];
  if (hlRang(nieuw) === hlRang(open)) return { ...hand, kaarten }; // gelijk: de pot blijft staan
  const goed = keuze === 'hoger' ? hlRang(nieuw) > hlRang(open) : hlRang(nieuw) < hlRang(open);
  if (!goed) return { ...hand, kaarten, pot: 0, klaar: true };
  const pot = Math.min(hand.pot * hlFactor(open, keuze), HL_MAX * hand.inzet);
  return { ...hand, kaarten, pot, goed: (hand.goed || 0) + 1, klaar: pot >= HL_MAX * hand.inzet };
}

// Bruto uitbetaling bij cashen (of als de pot het plafond raakt).
const hlUitbetaling = (hand, rnd) => rondEerlijkAf(hand.pot, rnd);

// ── Dobbelen ─────────────────────────────────────────────────────────────────

const DOBBELKEUZES = { onder: 'Onder 7', zeven: 'Precies 7', boven: 'Boven 7' };
const werp = (rnd) => [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];

function dobbelUitbetaling(keuze, inzet, [a, b]) {
  const som = a + b;
  if (keuze === 'zeven') return som === 7 ? inzet * 5 : 0;
  if (som === 7) return inzet;
  return (keuze === 'onder' ? som < 7 : som > 7) ? inzet * 2 : 0;
}

// ── Schuifkast ───────────────────────────────────────────────────────────────

// Maten in beeldpunten, ook voor de tekening (casinobeeld.js). Munten vallen tussen SK_MUNT en
// SK_BREEDTE − SK_MUNT; de zijgaten nemen samen SK_HUIS van die strook.
const SK_BREEDTE = 440, SK_DIEPTE = 280, SK_MUNT = 18, SK_HUIS = 0.05;
const SK_GAT = (SK_BREEDTE - 2 * SK_MUNT) * SK_HUIS / 2;
const SK_DUW = 3.5;  // gemiddeld 1,6 × dit per munt; zo ligt de tafel rond de 45 munten
const SK_START = 45;
const skRond = (n) => Math.round(n * 10) / 10;
const skInGat = (x) => x < SK_MUNT + SK_GAT || x > SK_BREEDTE - SK_MUNT - SK_GAT;
const skPlek = (rnd) => skRond(SK_MUNT + rnd() * (SK_BREEDTE - 2 * SK_MUNT));
// Meestal een duwtje, soms een flinke zet: daar komen de lawines vandaan.
const skDuw = (rnd) => SK_DUW * (rnd() < 0.85 ? rnd() * 2 : 2 + rnd() * 6);

const skNieuweTafel = (rnd) => ({ munten: Array.from({ length: SK_START }, () => ({ x: skPlek(rnd), d: skRond(rnd() * (SK_DIEPTE - SK_MUNT - 40)) })) });

// Een worp: { tafel, voor, erbij, duw, gevallen, winst, huis }. `voor` en `erbij` zijn de munten
// vóór de duw (voor de film), `gevallen` wat over de rand ging, met `huis` voor de zijgaten.
function skGooi(tafel, inzet, rnd) {
  const erbij = Array.from({ length: inzet }, () => ({ x: skPlek(rnd), d: skRond(SK_DIEPTE - SK_MUNT - rnd() * 40) }));
  let duw = 0;
  for (let i = 0; i < inzet; i++) duw += skDuw(rnd);
  duw = skRond(duw);
  const alle = [...tafel.munten, ...erbij];
  const gevallen = alle.filter(m => m.d < duw).map(m => ({ ...m, huis: skInGat(m.x) }));
  const huis = gevallen.filter(m => m.huis).length;
  return {
    tafel: { munten: alle.filter(m => m.d >= duw).map(m => ({ x: m.x, d: skRond(m.d - duw) })) },
    voor: tafel.munten, erbij, duw, gevallen, winst: gevallen.length - huis, huis,
  };
}

// ── Het Gefluisterde Voorrecht (index.js) ────────────────────────────────────
// Met een openstaand teken valt het spel in het voordeel van de speler: trek opnieuw tot `wint`.
// Wat er dan ligt is een gewone trekking, alleen de verliezers vallen af. Na `max` pogingen telt
// de laatste, zodat een spel dat niet te winnen is nooit blijft hangen.
function totWinst(trek, wint, max = 1000) {
  let uitkomst;
  for (let i = 0; i < max; i++) if (wint(uitkomst = trek())) break;
  return uitkomst;
}

module.exports = {
  totWinst, rondEerlijkAf,
  MAX_INZET, LOS_GETAL_MAX, INZETSOORTEN,
  geschudSpel, handWaarde, isBlackjack, deel, kaart, verdubbel, speelBank, magVerdubbelen, blackjackUitbetaling,
  kleurVan, draai, rouletteUitbetaling, toetsRoulette,
  GOKKAST, trekHendel, gokkastFactor, gokkastUitbetaling,
  HL_MARGE, HL_MAX, hlRang, hlKans, hlFactor, hlGelijk, hlStart, hlRaad, hlUitbetaling,
  DOBBELKEUZES, werp, dobbelUitbetaling,
  SK_BREEDTE, SK_DIEPTE, SK_MUNT, SK_GAT, SK_HUIS, SK_START, skInGat, skNieuweTafel, skGooi,
};
