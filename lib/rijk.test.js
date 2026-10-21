// Tests voor de rijkssamenvatting: altijd de grenzen, nooit meer dan ~1.000 tokens, en wél de
// alinea waar de vraag over gaat. Draait op het echte gepanneerde_rijk.txt. Run: `npm test`.

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRijk, rijkDigest } = require('./rijk.js');
const { schatTokens } = require('./promptbudget.js');

const RIJK = fs.readFileSync(path.join(__dirname, '..', 'gepanneerde_rijk.txt'), 'utf8');

const VRAGEN = [
  '',
  'Vertel eens over het Gepanneerde Rijk',
  'Wie won de Olympische spelen in het rijk?',
  'Wat deed John met de financiën?',
  'Hoe verliep het rond Sudetenpanade?',
  'Wat was de rol van Mr. KroketPet in het rijk?',
];

test('het rijksbestand heeft de secties die de samenvatting verwacht', () => {
  const { kop, secties } = parseRijk(RIJK);
  assert.match(kop, /Derde Rijk/);
  const titels = secties.map(s => s.titel).join(' | ');
  for (const re of [/^WAT IS/m, /GRENZEN/, /HOE SPREEKT/]) assert.match(titels, re, titels);
});

test('de grenzen en de naamregel gaan altijd mee', () => {
  for (const vraag of VRAGEN) {
    const d = rijkDigest(RIJK, vraag);
    assert.match(d, /"Derde Rijk" wordt NOOIT expliciet genoemd/, vraag);
    assert.match(d, /GRENZEN — WAT DE KROKET GOD NOOIT DOET/, vraag);
    assert.match(d, /De werkelijke historische gruwelen benoemen/, vraag);
    assert.match(d, /Hij noemt het Derde Rijk NOOIT bij naam/, vraag);
  }
});

test('de samenvatting blijft rond de 1.000 tokens, de volle tekst was er ~3.700', () => {
  assert.ok(schatTokens(RIJK) > 3500, `${schatTokens(RIJK)}`);
  for (const vraag of VRAGEN) {
    const d = rijkDigest(RIJK, vraag);
    assert.ok(schatTokens(d) <= 1050, `${vraag}: ${schatTokens(d)} tokens`);
  }
});

test('de alinea waar de vraag over gaat zit erin', () => {
  assert.match(rijkDigest(RIJK, 'Wie won de Olympische spelen in het rijk?'), /Winterspelen van 1936/);
  assert.match(rijkDigest(RIJK, 'Wat deed John met de financiën?'), /John — financiën/);
  assert.match(rijkDigest(RIJK, 'Hoe verliep het rond Sudetenpanade?'), /Sudetenpanade/);
});

test('niets verzonnen of halverwege afgebroken: elke regel staat zo in de bron', () => {
  for (const vraag of VRAGEN) {
    const d = rijkDigest(RIJK, vraag);
    for (const regel of d.split('\n')) {
      if (!regel.trim() || regel.startsWith('──')) continue;
      assert.ok(RIJK.includes(regel), `${vraag} — niet uit de bron: ${regel.slice(0, 80)}`);
    }
  }
});
