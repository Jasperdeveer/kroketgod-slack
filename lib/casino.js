// ── Het Casino: blackjack en roulette ────────────────────────────────────────
//
// Alleen de spelregels en de uitbetaling. De vensters, de punten en de state staan in index.js.
//
// BLACKJACK. Eén vers geschud spel van 52 kaarten per hand. De bank pakt tot 17 en blijft staan
// op een zachte 17. Blackjack betaalt 3:2, naar beneden afgerond: met hele punten zou afronden
// naar boven een inzet van 1 op 2:1 zetten, en dan wint de speler op de lange duur. Verdubbelen
// mag op de eerste twee kaarten (één kaart erbij, dan staan). Geen splitsen, geen verzekering.
// Heeft de bank blackjack, dan is de hand meteen voorbij.
//
// ROULETTE. Europees wiel, één nul (huisvoordeel 2,7%). Een los getal betaalt 35:1 maar mag met
// hoogstens LOS_GETAL_MAX punt: met de gewone inzet is één draai +350, en dat gooit de ranglijst
// om (keuze van de eigenaar).
//
// Uitbetalingen zijn BRUTO: wat er terugkomt, inzet inbegrepen. 0 is verloren, de inzet is gelijk.
//
// Puur: geen I/O en geen Math.random — de aanroeper geeft `rnd` mee. Zie casino.test.js.

'use strict';

const LOS_GETAL_MAX = 1;

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

// Bruto uitbetaling van een afgelopen hand.
function blackjackUitbetaling({ speler, bank, inzet }) {
  const s = handWaarde(speler).totaal, b = handWaarde(bank).totaal;
  const sBJ = isBlackjack(speler), bBJ = isBlackjack(bank);
  if (sBJ && bBJ) return inzet;
  if (sBJ) return inzet + Math.floor(inzet * 3 / 2);
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

module.exports = {
  LOS_GETAL_MAX, INZETSOORTEN,
  geschudSpel, handWaarde, isBlackjack, deel, kaart, verdubbel, speelBank, magVerdubbelen, blackjackUitbetaling,
  kleurVan, draai, rouletteUitbetaling, toetsRoulette,
};
