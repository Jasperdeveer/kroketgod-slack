// Tests voor het Casino: kaartwaarden, de bank, de uitbetalingen en het huisvoordeel. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOS_GETAL_MAX, INZETSOORTEN,
  geschudSpel, handWaarde, isBlackjack, deel, kaart, verdubbel, speelBank, magVerdubbelen, blackjackUitbetaling,
  kleurVan, draai, rouletteUitbetaling, toetsRoulette,
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
