// Tests voor de emoji-reacties: welk bericht welke emoji krijgt, en de remmen die zorgen dat het
// een oordeel blijft en geen ruis. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REGELS, SLIM_PALET, SLIM_KLASSEN, FREQUENTIES, FREQUENTIE_STANDAARD, frequentie, kiesRegel, magReageren, naReactie,
  slimEmoji,
} = require('./emojireacties.js');

const altijd = { rng: () => 0 };      // elke kans valt
const nooit = { rng: () => 0.9999 };  // geen enkele kans valt
const DINSDAG = { uur: 14, weekdag: 2 };
const emojiVoor = (tekst, ctx = DINSDAG) => kiesRegel(tekst, ctx, altijd)?.emoji ?? null;

test('elke regel heeft een unieke sleutel, een emoji en een kans tussen 0 en 1', () => {
  const keys = REGELS.map(r => r.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const r of REGELS) {
    assert.match(r.emoji, /^[a-z0-9_+-]+$/, r.key);
    assert.ok(r.kans > 0 && r.kans <= 1, r.key);
  }
});

test('de voorbeelden van het plan: ketterij en frituur', () => {
  assert.equal(emojiVoor('Ik doe altijd ketchup op mijn kroket'), 'rotating_light');
  assert.equal(emojiVoor('kroket uit de airfryer is prima'), 'ohhellno');
  assert.equal(emojiVoor('even in de magnetron gooien'), 'ohhellno');
  assert.equal(emojiVoor('Een bitterbal is gewoon beter, sorry'), 'face_with_raised_eyebrow');
  assert.equal(emojiVoor('net een kroket gegeten'), 'lekker_kroketje');
  assert.equal(emojiVoor('dat is echt een ware snack hel wtf joh'), 'nauseated_face');
  assert.equal(emojiVoor('gadverdamme'), 'nauseated_face');
  assert.equal(emojiVoor('wie wil er een frikandel'), 'eyes');
});

test('de voorbeelden van het plan: gedrag', () => {
  assert.equal(emojiVoor('ik zweer het, ik was er om 12 uur'), 'billed_cap');
  assert.equal(emojiVoor('dat duel was makkelijk'), 'clown_face');
  assert.equal(emojiVoor('sorry jongens, mijn fout'), 'shame-nun');
  assert.equal(emojiVoor('komt goed, ik regel het'), 'saluting_face');
  assert.equal(emojiVoor('we moeten even sparren over de roadmap'), 'briefcase');
  assert.equal(emojiVoor('ik ben ziek vandaag'), 'candle');
});

test('de voorbeelden van het plan: tijd en ritueel', () => {
  assert.equal(emojiVoor('nog even wakker', { uur: 2, weekdag: 3 }), 'owl');
  assert.equal(emojiVoor('goedemorgen', { uur: 6, weekdag: 3 }), 'rooster');
  assert.equal(emojiVoor('om 12 uur kroketmoment!', { uur: 11, weekdag: 5 }), 'clock12');
  assert.equal(emojiVoor('om 12 uur lunchen', { uur: 11, weekdag: 3 }), null); // alleen op vrijdag
  assert.equal(emojiVoor('ugh, maandag', { uur: 9, weekdag: 1 }), 'this-is-fine');
  assert.equal(emojiVoor('Gefeliciteerd Kroquinty!'), 'birthday');
});

test('de voorbeelden van het plan: het Rijk en het spel', () => {
  assert.equal(emojiVoor('die kroketgod weer', { ...DINSDAG, noemtKroketGodZonderMentie: true }), 'eye');
  assert.equal(emojiVoor('dit is een complot van de Raad'), 'illuminati-kroket');
  assert.equal(emojiVoor('weer alles kwijt in het vetbad'), 'sad-cat');
  assert.equal(emojiVoor('je bent me nog 3 punten schuldig, terugbetalen'), 'elmo-money');
});

test('gewone berichten krijgen geen regel', () => {
  assert.equal(kiesRegel('hoe laat zijn we er morgen?', DINSDAG, altijd), null);
  assert.equal(kiesRegel('dat is makkelijker gezegd dan gedaan', DINSDAG, altijd), null);
  assert.equal(kiesRegel('', DINSDAG, altijd), null);
});

test('de volgorde is de prioriteit: ketchup op een kroket wint van lekker en vies', () => {
  assert.equal(emojiVoor('lekker hoor, kroket met mayo'), 'rotating_light');
  assert.equal(emojiVoor('gefeliciteerd, hier is een lekkere frikandel'), 'birthday');
});

test('een raak regel waarvan de worp misliep: geen emoji, en geen andere regel', () => {
  const r = kiesRegel('lekker zeg', DINSDAG, nooit);
  assert.deepEqual(r, { key: 'lekker', emoji: null });
});

test('quinty: van of over haar, en een misser laat het bericht vrij voor de slimme laag', () => {
  assert.equal(emojiVoor('hoe laat zijn we er morgen?', { ...DINSDAG, quinty: true }), 'quintrippy');
  assert.equal(emojiVoor('waar is Kroquinty?'), 'quintrippy');
  assert.equal(emojiVoor('lekker zeg', { ...DINSDAG, quinty: true }), 'lekker_kroketje'); // andere regels eerst
  assert.equal(kiesRegel('hoe laat zijn we er morgen?', { ...DINSDAG, quinty: true }, nooit), null);
});

test('snacks met een eigen emoji', () => {
  assert.equal(emojiVoor('wie gaat er mee voor een bossche bol?'), 'bosschebol');
  assert.equal(emojiVoor('ik heb worstenbroodjes meegenomen'), 'worstenbrood');
  assert.equal(emojiVoor('liever een kaassoufflé'), 'lekker-kaasje');
  assert.equal(emojiVoor('even langs de snackbar'), 'snackbar');
  assert.equal(emojiVoor('de Hoge Frituurraad heeft gesproken'), null);
  assert.equal(emojiVoor('net een frikandel van de febo'), 'eyes'); // frikandel gaat voor
});

test('de frequentie vermenigvuldigt de kans: laag halveert', () => {
  const half = () => 0.4; // valt bij kans 1 en 0,8, niet bij 0,8 × 0,5
  assert.equal(kiesRegel('gadverdamme', DINSDAG, { rng: half, factor: 1 }).emoji, 'nauseated_face');
  assert.equal(kiesRegel('gadverdamme', DINSDAG, { rng: half, factor: FREQUENTIES.laag.regelFactor }).emoji, null);
});

test('de slimme laag: een vast palet plus "geen"', () => {
  assert.equal(SLIM_KLASSEN.at(-1), 'geen');
  assert.deepEqual(SLIM_KLASSEN.slice(0, 6), ['sarcasme', 'zeuren', 'drama', 'sterk', 'gelijk', 'oordeel']);
  const emoji = Object.values(SLIM_PALET).map(p => p.emoji);
  assert.equal(new Set(emoji).size, emoji.length);
  for (const p of Object.values(SLIM_PALET)) assert.match(p.emoji, /^[a-z0-9_+-]+$/);
  // De eigen emoji van de werkruimte maken het grootste deel van het palet uit.
  assert.ok(emoji.includes('facepalm') && emoji.includes('uno_reverse') && emoji.includes('shame-nun'));
  assert.ok(Object.keys(SLIM_PALET).length >= 18);
});

test('sander: eens (gelijk of sterk) wordt :santi-jatoch:, de rest blijft het palet', () => {
  assert.equal(slimEmoji('gelijk', { sander: true }), 'santi-jatoch');
  assert.equal(slimEmoji('sterk', { sander: true }), 'santi-jatoch');
  assert.equal(slimEmoji('sarcasme', { sander: true }), 'smirk');
  assert.equal(slimEmoji('geen', { sander: true }), null);
  assert.equal(slimEmoji('gelijk'), 'crown');
});

test('normaal: hoogstens 8 per uur en per persoon één per 20 minuten', () => {
  const f = frequentie('normaal');
  const nu = 10_000_000;
  let log = [];
  assert.equal(magReageren(log, 'A', nu, f), true);
  log = naReactie(log, 'A', nu);
  assert.equal(magReageren(log, 'A', nu + 19 * 60_000, f), false);
  assert.equal(magReageren(log, 'A', nu + 21 * 60_000, f), true);
  assert.equal(magReageren(log, 'B', nu + 1000, f), true);
  for (let i = 0; i < 7; i++) log = naReactie(log, `X${i}`, nu + i);
  assert.equal(log.length, 8);
  assert.equal(magReageren(log, 'C', nu + 60_000, f), false);       // vol
  assert.equal(magReageren(log, 'C', nu + 3_600_001, f), true);     // een uur later weer ruimte
});

test('de log ruimt zichzelf op: alleen het laatste uur blijft', () => {
  const log = naReactie([{ userId: 'A', ts: 0 }, { userId: 'B', ts: 3_000_000 }], 'C', 4_000_000);
  assert.deepEqual(log.map(r => r.userId), ['B', 'C']);
});

test('laag is de standaard, ook voor een onbekende stand: 3 per uur, per persoon één per uur', () => {
  assert.equal(FREQUENTIE_STANDAARD, 'laag');
  assert.equal(frequentie('raar'), FREQUENTIES.laag);
  assert.equal(frequentie(undefined), FREQUENTIES.laag);
  const f = frequentie('laag');
  let log = naReactie([], 'A', 0);
  assert.equal(magReageren(log, 'A', 59 * 60_000, f), false);
  assert.equal(magReageren(log, 'A', 61 * 60_000, f), true);
  log = naReactie(naReactie(log, 'B', 1), 'C', 2);
  assert.equal(magReageren(log, 'D', 3, f), false);
});
