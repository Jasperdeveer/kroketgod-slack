// Tests voor de casinoplaatjes: elke tafel is geldige SVG die resvg naar PNG omzet. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  blackjackBeeld, rouletteBeeld, gokkastBeeld, hogerLagerBeeld, dobbelBeeld, schuifkastBeeld, lobbyBeeld, naarPng, WIEL, DEJAVU,
  blackjackFilm, rouletteFilm, gokkastFilm, hogerLagerFilm, dobbelFilm, schuifkastFilm, naarGif,
} = require('./casinobeeld.js');
const { GOKKAST, skNieuweTafel, skGooi } = require('./casino.js');

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
    schuifkastBeeld(skNieuweTafel(() => 0.5).munten, { bak: 30, huis: 1, inzet: 5, uitslag: { kop: 'LAWINE', netto: 25 } }),
  ];
  for (const svg of tafels) assert.ok(isPng(naarPng(svg)));
});

// Zonder deze bestanden komt er op de server geen letter op een plaatje: de Docker-image heeft
// geen lettertypen (2 november 2026).
test('het lettertype zit in de repo', () => {
  for (const f of DEJAVU) assert.ok(require('fs').existsSync(f), f);
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

// ── De films ─────────────────────────────────────────────────────────────────

const DEEL = { spel: 'blackjack', inzet: 3, speler: ['7♠', 'K♥'], bank: ['A♣', '5♦'], klaar: false };

test('blackjack: bij het delen vier kaarten, de laatste dicht; bij passen draait de bank om en pakt', () => {
  const deel = blackjackFilm(null, DEEL);
  assert.equal(deel.length, 3 * 6 + 1 + 1); // drie keer omdraaien, de dichte bankkaart, het slotbeeld
  assert.equal(deel.at(-1).svg, blackjackBeeld(DEEL)); // eindigt op de tafel zoals hij daarna blijft
  const pas = { ...DEEL, bank: ['A♣', '5♦', '3♥', '9♠'], klaar: true };
  const film = blackjackFilm(DEEL, pas);
  assert.equal(film.length, 3 * 6 + 1); // de dichte kaart en twee nieuwe, dan het slotbeeld
  assert.equal(film.at(-1).svg, blackjackBeeld(pas, { open: true }));
  const kaart = { ...DEEL, speler: [...DEEL.speler, '2♣'] };
  assert.equal(blackjackFilm(DEEL, kaart).length, 6 + 1);
});

test('elke film eindigt op de tafel zonder uitslag, en verraadt onderweg niets', () => {
  assert.equal(rouletteFilm(17).at(-1).svg, rouletteBeeld(17, { onthuld: false, bal: { hoek: -90, r: 104 } }));
  assert.ok(rouletteFilm(17).every(b => b.svg.includes('>?</text>') && !/>(ROOD|ZWART|GROEN)</.test(b.svg))); // geen kleur, geen getal
  assert.ok(dobbelFilm([3, 4]).every(b => b.svg.includes('= ?')));
  const hl = { spel: 'hogerlager', inzet: 2, pot: 3.17, kaarten: ['5♠', '9♥', 'Q♣'], klaar: false };
  assert.equal(hogerLagerFilm(hl).at(-1).svg, hogerLagerBeeld(hl));
  assert.ok(hogerLagerFilm(hl).slice(0, -1).every(b => !b.svg.includes('3,17')));
  const rollen = GOKKAST.slice(0, 3).map(s => s.emoji);
  assert.equal(gokkastFilm(rollen).at(-1).svg, gokkastBeeld(rollen));
});

test('schuifkast: de film eindigt op de tafel na de worp, met de bak gevuld', () => {
  const tafel = { munten: [{ x: 200, d: 2 }, { x: 20, d: 1 }, { x: 300, d: 150 }] };
  const worp = skGooi(tafel, 2, () => 0.5); // duwt 7: twee munten over de rand, één in een zijgat
  assert.equal(worp.winst, 1);
  assert.equal(worp.huis, 1);
  const film = schuifkastFilm(worp, { inzet: 2 });
  assert.equal(film.at(-1).svg, schuifkastBeeld(worp.tafel.munten, { bak: 1, huis: 1, inzet: 2 }));
  // Alleen het slotbeeld noemt de bak: onderweg staat de uitslag nog nergens.
  assert.ok(film.slice(0, -1).every(b => !b.svg.includes('IN DE BAK')));
  assert.equal((film.at(-1).svg.match(/xlink:href="#munt"/g) || []).length, 3 - 2 + 2 + 1); // tafel + bak
});

test('een film wordt een GIF die één keer afspeelt', async () => {
  const film = dobbelFilm([3, 4], { rng: () => 0.5 });
  const { buf, duurMs } = await naarGif(film, { breedte: 200 });
  assert.equal(buf.subarray(0, 6).toString(), 'GIF89a');
  assert.equal(duurMs, film.reduce((som, b) => som + b.ms, 0));
  assert.ok(!buf.includes(Buffer.from('NETSCAPE2.0'))); // geen herhaling
  assert.equal(buf.at(-1), 0x3b); // netjes afgesloten
});
