// Tests voor de tekstbewerking op LLM-uitvoer. Pure functies, dus geen state of tijdelijke
// mappen nodig. Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isHoofdletterSpam,
  kapAfOpZinsgrens,
  normaliseerOndertekening,
  splitsVoorBlokken,
  BLOK_MAX,
} = require('./tekst.js');

// ── splitsVoorBlokken ─────────────────────────────────────────────────────────
// Aanleiding: postToChannel kapte hard af op 2999 tekens, waardoor de staart van een lang
// bericht — inclusief de ondertekening — middenin een woord verdween.

test('splitsVoorBlokken: korte tekst blijft één blok', () => {
  assert.deepEqual(splitsVoorBlokken('Zoals het hoort.'), ['Zoals het hoort.']);
});

test('splitsVoorBlokken: leegte en niet-tekst leveren geen blokken', () => {
  for (const invoer of ['', '   ', null, undefined, 42, {}]) {
    assert.deepEqual(splitsVoorBlokken(invoer), []);
  }
});

test('splitsVoorBlokken: elk blok blijft binnen het maximum', () => {
  const alinea = 'De frituur heeft gehoord en de frituur is tevreden. '.repeat(12).trim();
  const tekst = Array.from({ length: 20 }, () => alinea).join('\n\n');
  const blokken = splitsVoorBlokken(tekst);
  assert.ok(blokken.length > 1, 'moet gesplitst zijn');
  for (const b of blokken) assert.ok(b.length <= BLOK_MAX, `blok van ${b.length} tekens`);
});

test('splitsVoorBlokken: geen enkel teken gaat verloren', () => {
  const tekst = Array.from({ length: 30 },
    (_, i) => `Alinea ${i}: ${'paneerlaag '.repeat(30).trim()}`).join('\n\n');
  const samen = splitsVoorBlokken(tekst).join(' ').replace(/\s+/g, ' ');
  const bron = tekst.replace(/\s+/g, ' ').trim();
  assert.equal(samen, bron);
});

test('splitsVoorBlokken: de ondertekening blijft behouden', () => {
  const tekst = `${'De korst is heilig. '.repeat(400)}\n\n— De Almachtige Kroket God`;
  const blokken = splitsVoorBlokken(tekst);
  assert.ok(blokken.at(-1).includes('— De Almachtige Kroket God'),
    'de laatste regel mag niet wegvallen');
});

test('splitsVoorBlokken: splitst op zinsgrens binnen één lange alinea', () => {
  const zin = 'Gij zult de korst respecteren. ';
  const blokken = splitsVoorBlokken(zin.repeat(200).trim());
  assert.ok(blokken.length > 1);
  // Elk blok op één na eindigt op een compleet zinseinde.
  for (const b of blokken.slice(0, -1)) assert.match(b, /[.!?…]$/);
});

test('splitsVoorBlokken: een afkorting is geen zinsgrens', () => {
  const tekst = `Bijv. de mosterd, bijv. de ragout, ${'en zo verder, '.repeat(300)}punt.`;
  for (const b of splitsVoorBlokken(tekst)) {
    assert.ok(!/\bBijv\.$/.test(b), 'mag niet direct na "Bijv." knippen');
  }
});

test('splitsVoorBlokken: één woord langer dan het maximum wordt hard geknipt', () => {
  const monster = 'k'.repeat(BLOK_MAX * 2 + 50);
  const blokken = splitsVoorBlokken(monster);
  assert.equal(blokken.join('').length, monster.length);
  for (const b of blokken) assert.ok(b.length <= BLOK_MAX);
});

test('splitsVoorBlokken: respecteert een meegegeven maximum', () => {
  const blokken = splitsVoorBlokken('een. twee. drie. vier. vijf. zes.', 12);
  for (const b of blokken) assert.ok(b.length <= 12, `blok "${b}"`);
});

// ── kapAfOpZinsgrens ──────────────────────────────────────────────────────────

test('kapAfOpZinsgrens: complete tekst blijft ongemoeid', () => {
  const t = 'De frituur heeft gehoord. De frituur is tevreden.';
  assert.equal(kapAfOpZinsgrens(t), t);
});

test('kapAfOpZinsgrens: knipt een halve zin weg', () => {
  assert.equal(
    kapAfOpZinsgrens('De frituur heeft gehoord. En toen brak de korst midden'),
    'De frituur heeft gehoord.');
});

test('kapAfOpZinsgrens: markdown-einde geldt als compleet', () => {
  const t = '_De Kroket God heeft gesproken._';
  assert.equal(kapAfOpZinsgrens(t), t);
});

test('kapAfOpZinsgrens: zonder bruikbare grens blijft de tekst staan', () => {
  const t = 'een lange regel zonder enig leesteken erin verwerkt';
  assert.equal(kapAfOpZinsgrens(t), t);
});

// ── isHoofdletterSpam ─────────────────────────────────────────────────────────

test('isHoofdletterSpam: herkent schreeuwen', () => {
  assert.equal(isHoofdletterSpam('DE KROKET SPREEKT NIET, DE KROKET IS HET WOORD ZELF'), true);
});

test('isHoofdletterSpam: normale tekst en korte headers niet', () => {
  assert.equal(isHoofdletterSpam('De frituur heeft gehoord en is tevreden met het resultaat.'), false);
  assert.equal(isHoofdletterSpam('SPOEDMELDING'), false); // te kort om te beoordelen
});

// ── normaliseerOndertekening ──────────────────────────────────────────────────

test('normaliseerOndertekening: varianten worden één handtekening', () => {
  // Het gebruikte streepje blijft staan (de vervanging houdt $1 vast); alleen de naam erachter
  // wordt genormaliseerd.
  for (const variant of ['— Kroket God', '— De Kroket God', '- de almachtige kroket god']) {
    assert.match(normaliseerOndertekening(`> Zoals het hoort.\n${variant}`),
      /[—–-] De Almachtige Kroket God$/);
  }
});

test('normaliseerOndertekening: laat lopende tekst intact', () => {
  const t = 'De tempel van de Kroket God staat centraal in het Rijk.';
  assert.equal(normaliseerOndertekening(t), t);
});
