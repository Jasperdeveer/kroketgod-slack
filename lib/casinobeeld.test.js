// Tests voor de casinoplaatjes: elke tafel is geldige SVG die resvg naar PNG omzet. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { blackjackBeeld, rouletteBeeld, gokkastBeeld, hogerLagerBeeld, dobbelBeeld, lobbyBeeld, naarPng, WIEL } = require('./casinobeeld.js');
const { GOKKAST } = require('./casino.js');

const isPng = (buf) => buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';

test('elke tafel wordt een PNG', () => {
  const tafels = [
    lobbyBeeld(),
    blackjackBeeld({ speler: ['A♠', '7♥'], bank: ['K♦', '9♣'], inzet: 3 }),
    blackjackBeeld({ speler: ['10♣', '6♦', '5♥'], bank: ['K♦', '9♣'], inzet: 6, verdubbeld: true }, { open: true, uitslag: { kop: 'GEWONNEN', netto: 6 } }),
    rouletteBeeld(0, { inzetTekst: '1 op getal 0', uitslag: { kop: 'RAAK', netto: 35 } }),
    gokkastBeeld(GOKKAST.slice(0, 3).map(s => s.emoji), {}, { uitslag: { kop: 'NIETS', netto: -2 } }),
    hogerLagerBeeld({ inzet: 2, pot: 3.17, kaarten: ['5♠', '9♥', 'Q♣', '4♦'], klaar: false }),
    dobbelBeeld([3, 4], { inzetTekst: '3 op Precies 7', uitslag: { kop: 'PRECIES 7', netto: 12 } }),
  ];
  for (const svg of tafels) assert.ok(isPng(naarPng(svg)));
});

test('het wiel heeft elk getal één keer', () => {
  assert.equal(WIEL.length, 37);
  assert.deepEqual([...WIEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, i) => i));
});

test('tekst op een plaatje wordt ontsnapt', () => {
  const svg = rouletteBeeld(5, { inzetTekst: '<script>&' });
  assert.ok(svg.includes('&lt;script&gt;&amp;'));
  assert.ok(!svg.includes('<script>'));
});

test('de dichte kaart van de bank verraadt niets', () => {
  const svg = blackjackBeeld({ speler: ['A♠', '7♥'], bank: ['K♦', '9♣'], inzet: 3 });
  assert.ok(!svg.includes('>9<'));
  assert.ok(svg.includes('>10<')); // de waarde van de open kaart
});
