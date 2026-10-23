// Tests voor het uitlichten van nieuwe functies: wat het kost en hoe het werkt staat vast onder
// het decreet, wat het model er ook van maakt. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { FUNCTIES, uitlichtPrompt, bouwUitlichting } = require('./nieuwtjes.js');
const { KOSTEN_NIEUW, KOSTEN_BESTAAND } = require('./gasten.js');

test('elke functie heeft alles wat de mededeling nodig heeft, binnen de Slack-grenzen', () => {
  for (const [key, f] of Object.entries(FUNCTIES)) {
    assert.ok(f.naam && f.kop && f.vangnet, key);
    assert.ok(f.feiten.length && f.zoWerktHet.length, key);
    assert.ok(f.knoppen.length >= 1 && f.knoppen.length <= 5, key);
    for (const k of f.knoppen) assert.ok(k.tekst.length <= 75, `${key}: ${k.tekst}`);
    const ids = f.knoppen.map(k => k.actionId);
    assert.equal(new Set(ids).size, ids.length, `${key}: dubbele action_id`);
  }
});

test('gasten: de prijzen komen uit de spelregels, niet uit een los getal', () => {
  const { tekst } = bouwUitlichting(FUNCTIES.gasten, 'Het decreet.');
  assert.match(tekst, new RegExp(`/kroketgod invite\` — [^\\n]*\\*${KOSTEN_NIEUW} punten\\*`));
  assert.match(tekst, new RegExp(`/kroketgod invite bekend\` — [^\\n]*\\*${KOSTEN_BESTAAND} punten\\*`));
});

test('volgorde: kop, decreet, dan hoe het werkt', () => {
  const { tekst } = bouwUitlichting(FUNCTIES.gasten, 'Het decreet.');
  const kop = tekst.indexOf('Nieuw in het Rijk');
  const decreet = tekst.indexOf('Het decreet.');
  const uitleg = tekst.indexOf('*Zo werkt het*');
  assert.ok(kop >= 0 && kop < decreet && decreet < uitleg);
});

test('geen of een leeg decreet: het vaste vangnet staat erin', () => {
  for (const leeg of [null, undefined, '', '   ']) {
    assert.match(bouwUitlichting(FUNCTIES.gasten, leeg).tekst, /opent de poorten van het Rijk voor gasten/);
  }
});

test('de knoppen openen de vensters: nieuwe gast als hoofdknop, bekende gasten ernaast', () => {
  const { knoppen } = bouwUitlichting(FUNCTIES.gasten, 'x');
  assert.deepEqual(knoppen.map(k => k.action_id), ['gast_nieuw_open', 'gast_bekend_open']);
  assert.equal(knoppen[0].style, 'primary');
  assert.equal(knoppen[1].style, undefined);
});

test('de prompt geeft het model de feiten en verbiedt verzonnen prijzen', () => {
  const p = uitlichtPrompt(FUNCTIES.gasten);
  assert.match(p, new RegExp(`${KOSTEN_NIEUW} kroketpunten`));
  assert.match(p, /Verzin geen prijzen/);
  assert.match(p, /Noem geen commando's/);
});
