// Tests voor het Casino: kaartwaarden, de bank, de uitbetalingen en het huisvoordeel. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOS_GETAL_MAX, INZETSOORTEN,
  geschudSpel, handWaarde, isBlackjack, deel, kaart, verdubbel, speelBank, magVerdubbelen, blackjackUitbetaling,
  kleurVan, draai, rouletteUitbetaling, toetsRoulette,
  GOKKAST, trekHendel, gokkastFactor, gokkastUitbetaling,
  HL_MARGE, HL_MAX, hlRang, hlKans, hlFactor, hlStart, hlRaad, hlUitbetaling,
  DOBBELKEUZES, werp, dobbelUitbetaling, totWinst,
} = require('./casino.js');

// Een hand met een vaste stapel: pop() pakt van achteren, dus de volgende kaart staat achteraan.
const hand = (speler, bank, volgende = [], inzet = 2) => ({ speler, bank, stapel: [...volgende].reverse(), inzet, klaar: false });

test('een geschud spel heeft 52 verschillende kaarten', () => {
  const spel = geschudSpel(Math.random);
  assert.equal(spel.length, 52);
  assert.equal(new Set(spel).size, 52);
});

test('azen tellen als 11 tot de hand zou kopen', () => {
  assert.deepEqual(handWaarde(['A♠', '6♥']), { totaal: 17, zacht: true });
  assert.deepEqual(handWaarde(['A♠', '6♥', '10♦']), { totaal: 17, zacht: false });
  assert.deepEqual(handWaarde(['A♠', 'A♥', '9♦']), { totaal: 21, zacht: true });
  assert.equal(handWaarde(['K♠', 'Q♥', '2♦']).totaal, 22);
  assert.ok(isBlackjack(['A♣', 'J♦']));
  assert.ok(!isBlackjack(['7♣', '7♦', '7♥']));
});

test('de bank pakt tot 17 en blijft staan op een zachte 17', () => {
  assert.deepEqual(speelBank(hand(['10♠', '8♠'], ['A♥', '6♥'], ['5♦'])).bank, ['A♥', '6♥']);
  assert.deepEqual(speelBank(hand(['10♠', '8♠'], ['10♥', '2♥'], ['3♦', '4♣', '9♠'])).bank, ['10♥', '2♥', '3♦', '4♣']);
});

test('een gekochte speler laat de bank stil en verliest', () => {
  const h = kaart(hand(['10♠', '8♠'], ['10♥', '2♥'], ['5♦', '9♣']));
  assert.ok(h.klaar);
  assert.deepEqual(h.bank, ['10♥', '2♥']);
  assert.equal(blackjackUitbetaling(h), 0);
});

test('op 21 past de speler vanzelf', () => {
  const h = kaart(hand(['10♠', '6♠'], ['10♥', '7♥'], ['5♦']));
  assert.ok(h.klaar);
  assert.equal(blackjackUitbetaling(h), 4);
});

test('verdubbelen: dubbele inzet, één kaart, dan de bank', () => {
  const h = verdubbel(hand(['5♠', '6♠'], ['10♥', '6♥'], ['10♦', '9♣']));
  assert.equal(h.inzet, 4);
  assert.ok(h.verdubbeld);
  assert.deepEqual(h.speler, ['5♠', '6♠', '10♦']);
  assert.deepEqual(h.bank, ['10♥', '6♥', '9♣']);
  assert.equal(blackjackUitbetaling(h), 8);
  assert.ok(!magVerdubbelen(h));
  assert.ok(magVerdubbelen(hand(['5♠', '6♠'], ['10♥', '6♥'])));
});

test('uitbetalingen: winst, gelijk, verlies, blackjack 3:2 naar beneden', () => {
  assert.equal(blackjackUitbetaling(hand(['10♠', '9♠'], ['10♥', '8♥'])), 4);
  assert.equal(blackjackUitbetaling(hand(['10♠', '8♠'], ['10♥', '8♥'])), 2);
  assert.equal(blackjackUitbetaling(hand(['10♠', '7♠'], ['10♥', '8♥'])), 0);
  assert.equal(blackjackUitbetaling(hand(['10♠', '7♠'], ['10♥', '6♥', '9♦'])), 4);
  assert.equal(blackjackUitbetaling(hand(['A♠', 'K♠'], ['10♥', '8♥'], [], 2)), 5);
  // Afronden naar boven zou 1 punt op 2:1 zetten; naar beneden is het 1:1.
  assert.equal(blackjackUitbetaling(hand(['A♠', 'K♠'], ['10♥', '8♥'], [], 1)), 2);
  assert.equal(blackjackUitbetaling(hand(['A♠', 'K♠'], ['A♥', 'Q♥'])), 2);
  assert.equal(blackjackUitbetaling(hand(['10♠', '9♠', '2♣'], ['A♥', 'Q♥'])), 0);
});

test('blackjack bij het delen maakt de hand meteen klaar', () => {
  for (let i = 0; i < 2000; i++) {
    const h = deel(Math.random, 3);
    assert.equal(h.klaar, isBlackjack(h.speler) || isBlackjack(h.bank));
    assert.equal(h.stapel.length, 48);
  }
});

test('roulette: kleuren en uitbetalingen', () => {
  assert.equal(kleurVan(0), 'groen');
  assert.equal(kleurVan(1), 'rood');
  assert.equal(kleurVan(2), 'zwart');
  assert.equal(rouletteUitbetaling('rood', 5, 1), 10);
  assert.equal(rouletteUitbetaling('rood', 5, 0), 0);
  assert.equal(rouletteUitbetaling('even', 5, 0), 0);
  assert.equal(rouletteUitbetaling('dozijn2', 5, 13), 15);
  assert.equal(rouletteUitbetaling('getal', 1, 17, 17), 36);
  assert.equal(rouletteUitbetaling('getal', 1, 18, 17), 0);
  for (let i = 0; i < 1000; i++) { const n = draai(Math.random); assert.ok(n >= 0 && n <= 36); }
});

test('roulette: elke inzetsoort verliest op de lange duur precies 1/37', () => {
  for (const soort of Object.keys(INZETSOORTEN)) {
    let terug = 0;
    for (let n = 0; n <= 36; n++) terug += rouletteUitbetaling(soort, 1, n, 7);
    assert.equal(terug, 36, soort);
  }
});

test('roulette: een los getal mag hoogstens LOS_GETAL_MAX punt', () => {
  assert.equal(toetsRoulette('rood', 10, null), null);
  assert.equal(toetsRoulette('getal', LOS_GETAL_MAX, 0), null);
  assert.equal(toetsRoulette('getal', LOS_GETAL_MAX + 1, 5).veld, 'inzet');
  assert.equal(toetsRoulette('getal', 1, 37).veld, 'getal');
  assert.equal(toetsRoulette('getal', 1, null).veld, 'getal');
  assert.equal(toetsRoulette('paars', 1, null).veld, 'soort');
});

// Een rng die de gegeven worpen teruggeeft, op volgorde.
const reeks = (...worpen) => { let i = 0; return () => worpen[i++ % worpen.length]; };

test('gokkast: drie gelijke, twee gelijke, niets', () => {
  const [k, b, w, , i] = GOKKAST.map(s => s.emoji);
  assert.equal(gokkastFactor([i, i, i]), 8);
  assert.equal(gokkastFactor([k, k, k]), 4);
  assert.equal(gokkastFactor([w, b, w]), 2);
  assert.equal(gokkastFactor([k, b, i]), 0);
  assert.equal(gokkastUitbetaling([i, i, k], 5), 15);
});

test('gokkast: 95,7% terug en hoogstens 8×, exact over alle uitkomsten', () => {
  const W = GOKKAST.reduce((s, x) => s + x.gewicht, 0);
  let terug = 0;
  for (const a of GOKKAST) for (const b of GOKKAST) for (const c of GOKKAST) {
    terug += (a.gewicht * b.gewicht * c.gewicht) / W ** 3 * gokkastFactor([a.emoji, b.emoji, c.emoji]);
  }
  assert.ok(terug > 0.95 && terug < 0.96, String(terug));
  assert.equal(Math.max(...GOKKAST.map(s => s.drie)), 8);
});

test('gokkast: de rollen volgen de gewichten', () => {
  // Gewichten 3-3-2-2-1 van 11: 0,5 × 11 = 5,5 valt in de tweede band.
  assert.deepEqual(trekHendel(reeks(0, 0.999, 0.5, 0.6)).slice(0, 3), ['lekker_kroketje', 'ongepaneerde-kroket-god', 'bosschebol']);
  assert.equal(trekHendel(reeks(0.6))[0], 'worstenbrood');
});

test('hoger/lager: kansen en factoren', () => {
  assert.equal(hlRang('2♠'), 0);
  assert.equal(hlRang('A♥'), 12);
  assert.equal(hlKans('2♠', 'lager'), 0);
  assert.equal(hlFactor('2♠', 'lager'), 0);
  assert.equal(hlKans('A♠', 'hoger'), 0);
  assert.equal(hlKans('8♦', 'hoger'), 6 / 13);
  // Elke gok kost gemiddeld 5%: kans maal factor is HL_MARGE.
  for (const k of ['3♣', '8♦', 'K♥']) for (const keuze of ['hoger', 'lager']) {
    assert.ok(Math.abs(hlKans(k, keuze) * hlFactor(k, keuze) - HL_MARGE) < 1e-9);
  }
});

test('hoger/lager: goed laat de pot groeien, gelijk of fout is alles kwijt', () => {
  const h = { spel: 'hogerlager', inzet: 2, pot: 2, kaarten: ['8♦'], klaar: false };
  // 0,5 → rang 6 = '8', dus gelijk: fout.
  const gelijk = hlRaad(h, 'hoger', reeks(6 / 13 + 0.01, 0.6));
  assert.equal(gelijk.pot, 0);
  assert.equal(gelijk.kaarten.at(-1), '8♣'); // dezelfde rang, nooit precies dezelfde kaart
  const goed = hlRaad(h, 'hoger', reeks(12 / 13 + 0.01, 0)); // een aas
  assert.equal(goed.kaarten.at(-1), 'A♠');
  assert.ok(!goed.klaar);
  assert.ok(Math.abs(goed.pot - 2 * HL_MARGE * 13 / 6) < 1e-9);
  assert.equal(hlUitbetaling(goed), 4);
  const fout = hlRaad(h, 'lager', reeks(12 / 13 + 0.01, 0));
  assert.ok(fout.klaar);
  assert.equal(hlUitbetaling(fout), 0);
});

test('hoger/lager: de pot stopt bij HL_MAX × de inzet', () => {
  assert.deepEqual(hlStart(reeks(0, 0), 1).kaarten, ['2♠']);
  // Hoger op een heer: kans 1/13, factor 12,35, dus in één keer tegen het plafond.
  const h = hlRaad({ spel: 'hogerlager', inzet: 1, pot: 1, kaarten: ['K♠'], klaar: false }, 'hoger', reeks(0.999, 0));
  assert.ok(h.klaar);
  assert.equal(h.pot, HL_MAX);
  assert.equal(hlUitbetaling(h), HL_MAX);
});

test('dobbelen: onder/boven eerlijk met 7 terug, precies 7 betaalt 4:1', () => {
  assert.equal(dobbelUitbetaling('onder', 3, [2, 3]), 6);
  assert.equal(dobbelUitbetaling('onder', 3, [4, 3]), 3);
  assert.equal(dobbelUitbetaling('onder', 3, [6, 3]), 0);
  assert.equal(dobbelUitbetaling('boven', 3, [6, 6]), 6);
  assert.equal(dobbelUitbetaling('zeven', 3, [1, 6]), 15);
  assert.equal(dobbelUitbetaling('zeven', 3, [1, 1]), 0);
  const terug = (keuze) => { let t = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) t += dobbelUitbetaling(keuze, 1, [a, b]); return t / 36; };
  assert.equal(terug('onder'), 1);
  assert.equal(terug('boven'), 1);
  assert.ok(Math.abs(terug('zeven') - 5 / 6) < 1e-9);
  assert.deepEqual(Object.keys(DOBBELKEUZES), ['onder', 'zeven', 'boven']);
  for (let i = 0; i < 500; i++) for (const s of werp(Math.random)) assert.ok(s >= 1 && s <= 6);
});

// 30 oktober 2026: het Gefluisterde Voorrecht werkt ook in het casino. Elk spel met een teken wint.
test('voorrecht: trek opnieuw tot de speler wint, in elk spel', () => {
  let n = 0;
  const rnd = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 30; i++) {
    const h = totWinst(() => deel(rnd, 2), (h) => isBlackjack(h.speler) && !isBlackjack(h.bank));
    assert.ok(h.klaar && blackjackUitbetaling(h) > 2, h.speler.join());
    const rollen = totWinst(() => trekHendel(rnd), (r) => gokkastFactor(r) > 1);
    assert.ok(gokkastUitbetaling(rollen, 3) > 3, rollen.join());
    for (const keuze of Object.keys(DOBBELKEUZES)) {
      const stenen = totWinst(() => werp(rnd), (s) => dobbelUitbetaling(keuze, 2, s) > 2);
      assert.ok(dobbelUitbetaling(keuze, 2, stenen) > 2, `${keuze} ${stenen}`);
    }
    for (const soort of Object.keys(INZETSOORTEN)) {
      const getal = soort === 'getal' ? i % 37 : null;
      const bal = totWinst(() => draai(rnd), (u) => rouletteUitbetaling(soort, 1, u, getal) > 1);
      assert.ok(rouletteUitbetaling(soort, 1, bal, getal) > 1, `${soort} ${bal}`);
    }
    const start = { ...hlStart(rnd, 2), kaarten: ['7♠'] };
    for (const keuze of ['hoger', 'lager']) assert.ok(totWinst(() => hlRaad(start, keuze, rnd), (h) => h.pot > 0).pot > 2);
  }
  // Niet te winnen: na max pogingen telt de laatste trekking, en het spel loopt gewoon door.
  let pogingen = 0;
  assert.equal(totWinst(() => ++pogingen, () => false, 50), 50);
});
