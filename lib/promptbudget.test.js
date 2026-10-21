// Tests voor het tokenbudget: wat valt er weg als een verzoek niet in het budget van een schakel
// past, en in welke volgorde. Pure functies over berichten. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inkortbaar, zonderMarkeringen, zonderBlokken, prioriteitenIn, schatTokens, schatVerzoek, pasInBudget,
} = require('./promptbudget.js');

const tekst = (n, teken = 'a') => `${teken.repeat(n)}`;
const heeftMarkering = (s) => /[]/.test(s);

test('een inkortbaar blok is onzichtbaar gemarkeerd en valt per prioriteit weg', () => {
  const s = `REGELS ${inkortbaar(1, 'voorbeelden')} ${inkortbaar(2, 'geboden')} ${inkortbaar(3, 'leden')}`;
  assert.deepEqual(prioriteitenIn(s), [1, 2, 3]);
  assert.equal(zonderMarkeringen(s), 'REGELS voorbeelden geboden leden');
  assert.equal(zonderBlokken(s, 1), 'REGELS  geboden leden');
  assert.equal(zonderBlokken(s, 2), 'REGELS   leden');
  assert.equal(zonderBlokken(s), 'REGELS   ');
  assert.equal(inkortbaar(1, ''), '');
});

test('markeringen in de inhoud zelf kunnen een blok niet openbreken', () => {
  const s = inkortbaar(1, 'binnen  nog binnen 2 vals');
  assert.equal(zonderBlokken(s, 1), '');
});

test('de schatting is tekens/3,5 plus output-budget plus vaste speling', () => {
  assert.equal(schatTokens(tekst(350)), 100);
  const b = [{ role: 'system', content: tekst(3500) }, { role: 'user', content: tekst(350) }];
  // 1000+4 + 100+4 invoer, + 300 speling, + 500 output
  assert.equal(schatVerzoek(b, 500), 1108 + 300 + 500);
});

test('wat past, gaat ongemoeid door — maar altijd zonder markeringen', () => {
  const b = [{ role: 'system', content: `kern ${inkortbaar(1, 'extra')}` }, { role: 'user', content: 'vraag' }];
  const { berichten, stappen } = pasInBudget(b, { budget: 100_000, uitvoerTokens: 220 });
  assert.deepEqual(stappen, []);
  assert.equal(berichten[0].content, 'kern extra');
  assert.ok(!berichten.some(x => heeftMarkering(x.content)));
});

test('volgorde van krimpen: prio 1, prio 2, oude beurten, prio 3, noodknip', () => {
  const system = `KERN ${inkortbaar(1, tekst(3500, 'v'))} ${inkortbaar(2, tekst(3500, 'g'))} ${inkortbaar(3, tekst(3500, 'l'))}`;
  const b = [
    { role: 'system', content: system },
    { role: 'user', content: tekst(3500, 'o') },
    { role: 'assistant', content: tekst(3500, 'a') },
    { role: 'user', content: 'laatste vraag' },
  ];
  const stappenBij = (budget) => pasInBudget(b, { budget, uitvoerTokens: 0 }).stappen;
  assert.deepEqual(stappenBij(6_000), []);
  assert.deepEqual(stappenBij(5_000), ['prio 1']);
  assert.deepEqual(stappenBij(4_000), ['prio 1', 'prio 2']);
  assert.deepEqual(stappenBij(3_000), ['prio 1', 'prio 2', '1 oude beurten']);
  assert.deepEqual(stappenBij(2_000), ['prio 1', 'prio 2', '2 oude beurten']);
  assert.deepEqual(stappenBij(1_000), ['prio 1', 'prio 2', '2 oude beurten', 'prio 3']);
  const nood = pasInBudget(b, { budget: 310, uitvoerTokens: 0 });
  assert.equal(nood.stappen.at(-1), 'noodknip');
  // De laatste vraag blijft altijd staan; daar moet het antwoord op ingaan.
  assert.equal(nood.berichten.at(-1).content, 'laatste vraag');
});

test('de noodknip snijdt van achteren: de regels vooraan blijven', () => {
  const system = `REGELS-VOORAAN ${tekst(40_000, 'x')} STAART`;
  const { berichten, stappen } = pasInBudget([{ role: 'system', content: system }, { role: 'user', content: 'vraag' }], { budget: 8000, uitvoerTokens: 1244 });
  assert.deepEqual(stappen, ['noodknip']);
  assert.ok(berichten[0].content.startsWith('REGELS-VOORAAN'));
  assert.ok(!berichten[0].content.includes('STAART'));
  assert.ok(schatVerzoek(berichten, 1244) <= 8000, `${schatVerzoek(berichten, 1244)}`);
});

test('de invoer wordt niet aangepast', () => {
  const b = [{ role: 'system', content: `kern ${inkortbaar(1, tekst(10_000))}` }, { role: 'user', content: 'vraag' }];
  const kopie = JSON.stringify(b);
  pasInBudget(b, { budget: 1000 });
  assert.equal(JSON.stringify(b), kopie);
});
