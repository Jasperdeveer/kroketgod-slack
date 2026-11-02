// ── Het gastendebat ──────────────────────────────────────────────────────────
//
// Verzoek eigenaar (2 november 2026): één keer per week (woensdag 15:00) laat de Kroket God twee
// gasten van vandaag een kroketstelling uitvechten, elk in eigen stem, in een thread. Leden stemmen
// met 1️⃣ of 2️⃣ onder de aankondiging; om 17:00 telt hij. De winnaar blijft een werkdag langer
// (naDebatWinst, lib/gasten.js); bij gelijkspel wint niemand iets.
//
// Puur: geen I/O en geen klok. Zie gastendebat.test.js.

'use strict';

const STELLINGEN = [
  'Een kroket hoort op brood, niet ernaast.',
  'Mosterd is een belediging voor de ragout.',
  'Een kroket uit de muur smaakt beter dan een kroket van de slager.',
  'De bitterbal is gewoon een laffe kroket.',
  'Een kroket moet je met mes en vork eten.',
  'De airfryer is net zo goed als de frituurpan.',
  'Een vegetarische kroket is een volwaardige kroket.',
  'De korst is belangrijker dan de vulling.',
  'Wie zijn tong brandt aan een kroket, heeft het verdiend.',
  'Een frikandel verdient evenveel respect als een kroket.',
  'Een kroket hoort bij het ontbijt.',
  'Ketchup bij een kroket is toegestaan.',
  'De beste kroket wordt om middernacht gegeten.',
  'Een kroket delen is een daad van liefde.',
  'Een goudbruine kroket is beter dan een donkerbruine.',
  'De kroket is het hoogtepunt van de Nederlandse keuken.',
  'Een kroket in de magnetron opwarmen is nooit te vergeven.',
  'Een satékroket is ketterij.',
  'Kroketten horen op een bruiloft.',
  'Wie geen kroket lust, is niet te vertrouwen.',
];

// Een stelling die nog niet in `gebruikt` staat (indices); is alles al eens geweest, dan begint het
// rondje opnieuw. Geeft de index.
function kiesStelling(gebruikt = [], rng = Math.random) {
  const vrij = STELLINGEN.map((_, i) => i).filter(i => !gebruikt.includes(i));
  const pot = vrij.length ? vrij : STELLINGEN.map((_, i) => i);
  return pot[Math.floor(rng() * pot.length) % pot.length];
}

// Twee verschillende gasten uit de lijst, of null als er minder dan twee zijn.
function kiesDebaters(ids = [], rng = Math.random) {
  if (ids.length < 2) return null;
  const pot = [...ids];
  const a = pot.splice(Math.floor(rng() * pot.length) % pot.length, 1)[0];
  const b = pot[Math.floor(rng() * pot.length) % pot.length];
  return [a, b];
}

// Stemmen uit reactions.get: alleen leden die mogen stemmen, de bot niet, en wie op beide stemde
// telt nergens.
const STEM_A = 'one', STEM_B = 'two';
function telDebatStemmen(reacties = [], magStemmen = () => true) {
  const users = (naam) => new Set((reacties.find(r => r.name === naam)?.users || []).filter(magStemmen));
  const a = users(STEM_A), b = users(STEM_B);
  return { a: [...a].filter(u => !b.has(u)).length, b: [...b].filter(u => !a.has(u)).length };
}

const debatWinnaar = ({ a, b }) => (a > b ? 'a' : b > a ? 'b' : null);

module.exports = { STELLINGEN, STEM_A, STEM_B, kiesStelling, kiesDebaters, telDebatStemmen, debatWinnaar };
