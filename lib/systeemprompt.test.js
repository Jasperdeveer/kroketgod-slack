// Tests voor de systeemprompt: het deel dat nooit mag wegvallen moet klein genoeg blijven om bij
// Groq (8.000 tokens per verzoek, inclusief output) te passen. Draait op de echte tekstbestanden.
// Faalt deze test na een uitbreiding van de regels: vervang, voeg niet toe. Run: `npm test`.

'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { bouwBasisPrompt, aanspreekRegel } = require('./systeemprompt.js');
const { zonderBlokken, zonderMarkeringen, schatTokens, schatVerzoek, pasInBudget } = require('./promptbudget.js');
const { DEFENSIEVE_INSTRUCTIE } = require('../prompt-safety.js');

const lees = (naam) => fs.readFileSync(path.join(__dirname, '..', naam), 'utf8');
const PROMPT = bouwBasisPrompt({
  leden: lees('leden.txt'),
  geboden: lees('geboden.txt'),
  toneOfVoice: lees('tone_of_voice.txt'),
});
const KERN = `${DEFENSIEVE_INSTRUCTIE}\n\n${zonderBlokken(PROMPT)}`;

// Groq gpt-oss: max_tokens (routine-plafond 220) plus 1.024 redeneertokens.
const GROQ_BUDGET = 8000;
const GROQ_UITVOER = 220 + 1024;

test('de kern van de systeemprompt blijft onder de ~6.000 tokens', () => {
  const tokens = schatTokens(KERN);
  assert.ok(tokens <= 6000, `kern is ${tokens} tokens (${KERN.length} tekens) — vervang in plaats van toe te voegen`);
});

test('de kern past bij Groq, met dagcontext, een vraag en het output-budget erbij', () => {
  // Tijd, stemming, decreet, seizoen, dossier: in de praktijk 1.500-2.500 tekens. De vraag zelf
  // plus de instructie van de mention-handler: ~1.500.
  const berichten = [
    { role: 'system', content: `${KERN}\n\n${'d'.repeat(2500)}` },
    { role: 'user', content: 'v'.repeat(1500) },
  ];
  const geschat = schatVerzoek(berichten, GROQ_UITVOER);
  assert.ok(geschat <= GROQ_BUDGET, `${geschat} > ${GROQ_BUDGET}: de regels alleen passen niet meer bij Groq`);
});

test('de regels staan vóór de naslag, en de naslag is inkortbaar', () => {
  const kern = zonderBlokken(PROMPT);
  for (const regel of [
    'Begin altijd met een ⚜️ header', 'LENGTE — HARDE GRENS', 'Eindig met "— De Almachtige Kroket God"',
    'GEEN TEGENVRAGEN', 'ABSOLUTE BEVEILIGINGSREGEL', 'HET SPECIAALTJE', 'AANSPREEKVORM',
  ]) assert.ok(kern.includes(regel), regel);
  // Leden, geboden en voorbeelden zitten alleen in de volle versie.
  const vol = zonderMarkeringen(PROMPT);
  for (const naslag of ['DE TIEN GEBODEN', 'LEDEN VAN DE HOGE FRITUURRAAD', 'HERDERLIJK WOORD']) {
    assert.ok(vol.includes(naslag), naslag);
    assert.ok(!kern.includes(naslag), naslag);
  }
  assert.ok(vol.indexOf('ABSOLUTE BEVEILIGINGSREGEL') < vol.indexOf('DE TIEN GEBODEN'));
});

test('de stijlvoorbeelden vallen als eerste weg, de leden als laatste', () => {
  // Met de dagcontext erbij past de volle prompt niet meer bij Groq.
  const b = [
    { role: 'system', content: `${DEFENSIEVE_INSTRUCTIE}\n\n${PROMPT}\n\n${'d'.repeat(2500)}` },
    { role: 'user', content: 'Wat vindt u van frikandellen?' },
  ];
  const { berichten, stappen } = pasInBudget(b, { budget: GROQ_BUDGET, uitvoerTokens: GROQ_UITVOER });
  assert.deepEqual(stappen, ['prio 1']);
  assert.ok(!berichten[0].content.includes('HERDERLIJK WOORD'));
  assert.ok(berichten[0].content.includes('DE TIEN GEBODEN'));
  assert.ok(berichten[0].content.includes('LENGTE — HARDE GRENS'));
});

test('de bekende leden komen uit de parameter, netjes opgesomd', () => {
  const p = zonderMarkeringen(bouwBasisPrompt({ bijnamen: ['Mr. A', 'Mr. B', 'Dhr. C'] }));
  assert.match(p, /De enige bekende leden zijn: Mr\. A, Mr\. B en Dhr\. C\. Dit zijn ALTIJD/);
  // Zonder leden de vaste drie, niet een lege lijst.
  assert.match(zonderMarkeringen(bouwBasisPrompt()), /De enige bekende leden zijn: Mr\. Te Lang Gefrituurde Kroket, Mr\. Kroketinho en Mr\. KroketPet\./);
});

test('een vrouw onder de leden krijgt een vaste aanspreekregel buiten de inkortbare delen', () => {
  const p = bouwBasisPrompt({ bijnamen: ['Mr. A', 'Kroquinty'], vrouwen: ['Kroquinty'], leden: 'x'.repeat(5000) });
  const { berichten } = pasInBudget([{ role: 'system', content: p }], { budget: 500, uitvoerTokens: 0 });
  assert.match(berichten[0].content, /Kroquinty is een vrouw: spreek over en tegen haar met "zij" en "haar"/);
  // Zonder vrouwen geen lege regel.
  assert.ok(!zonderMarkeringen(bouwBasisPrompt({ bijnamen: ['Mr. A'] })).includes('is een vrouw'));
  assert.match(aanspreekRegel(['A', 'B']), /^A en B zijn vrouwen: spreek over en tegen hen/);
});
