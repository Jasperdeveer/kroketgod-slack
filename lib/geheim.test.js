// Tests voor de bijna-code-detectie: een tikfout in de geheime code mag nooit als vrije tekst bij
// de LLM belanden. De code hier is een verzonnen voorbeeld, niet de echte. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { afstand, lijktOpCode } = require('./geheim.js');

const CODE = 'smeuigvet';
const BEKEND = new Set(['beurs', 'smeuig', 'duel', 'eer', 'zondebok']);

test('afstand telt vervangen, invoegen, weglaten en omwisselen als één stap', () => {
  assert.equal(afstand('smeuigvet', 'smeuigvet'), 0);
  assert.equal(afstand('smeuigvet', 'smeuigvat'), 1);   // vervangen
  assert.equal(afstand('smeuigvet', 'smeuigvett'), 1);  // invoegen
  assert.equal(afstand('smeuigvet', 'smeugvet'), 1);    // weglaten
  assert.equal(afstand('smeuigvet', 'smeuigevt'), 1);   // omwisselen
  assert.equal(afstand('kroket', 'bitterbal'), 8);
});

test('afstand stopt vroeg boven het maximum', () => {
  assert.equal(afstand('kroket', 'bitterballen', 2), 3);
  assert.equal(afstand('a', 'abcdef', 2), 3);
});

test('een tikfout in de code is een bijna-treffer', () => {
  assert.equal(lijktOpCode('smeuigvat', CODE, { bekendeWoorden: BEKEND }), true);
  assert.equal(lijktOpCode('Smeuigevt 3', CODE, { bekendeWoorden: BEKEND }), true);
  assert.equal(lijktOpCode('smeuigvet3', CODE, { bekendeWoorden: BEKEND }), true, 'spatie vergeten');
  assert.equal(lijktOpCode('smeuvet status', CODE, { bekendeWoorden: BEKEND }), true, 'zelfde begin');
});

test('de exacte code, met of zonder staart, is geen bijna-treffer', () => {
  // Die vangt de aanroeper al op; dit mag hem niet in de weg zitten.
  assert.equal(lijktOpCode('smeuigvet', CODE), false);
  assert.equal(lijktOpCode('  SMEUIGVET   uit ', CODE), false);
  assert.equal(lijktOpCode('smeuigvet 3', CODE), false);
});

test('een bestaand commando blijft werken, ook met hetzelfde begin', () => {
  assert.equal(lijktOpCode('smeuig piet', CODE, { bekendeWoorden: BEKEND }), false);
  assert.equal(lijktOpCode('beurs koop piet 2', 'beurszegen', { bekendeWoorden: BEKEND }), false);
  // De set mag ook pas op verzoek worden gebouwd.
  assert.equal(lijktOpCode('beurs koop piet 2', 'beurszegen', { bekendeWoorden: () => BEKEND }), false);
});

test('gewone invoer lijkt niet op de code', () => {
  for (const t of ['ranglijst', 'eer piet voor de kroketten', 'wat vind je van mayonaise', 'zondebok', '']) {
    assert.equal(lijktOpCode(t, CODE, { bekendeWoorden: BEKEND }), false, t);
  }
});

test('zonder code bestaat er geen bijna-code', () => {
  assert.equal(lijktOpCode('smeuigvat', ''), false);
  assert.equal(lijktOpCode('smeuigvat', undefined), false);
});

test('een korte code is strenger: alleen één stap afstand', () => {
  assert.equal(lijktOpCode('vrt', 'vet'), true);
  assert.equal(lijktOpCode('vlt x', 'vet'), true);
  assert.equal(lijktOpCode('vla', 'vet'), false);
});
