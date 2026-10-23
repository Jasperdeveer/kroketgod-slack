// Tests voor de kroketprompts: nooit een admin-commando (ook niet voor de beheerder), nooit een
// geheim, en binnen de Slack-limieten. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { commandoRegister, isAdminCommando, promptOverzicht } = require('./commandoregister.js');

const REGISTER = commandoRegister({ offerPerDag: 3, vetbadMax: 10, genadeKosten: 5 });
const tekstVan = (blocks) => JSON.stringify(blocks);

test('de kroketprompts bevatten geen enkel admin-commando', () => {
  const blocks = promptOverzicht(REGISTER);
  const admin = REGISTER.filter(isAdminCommando);
  assert.ok(admin.length >= 8);
  for (const item of admin) assert.ok(!tekstVan(blocks).includes(`\`${item.cmd}\``), item.cmd);
  assert.doesNotMatch(tekstVan(blocks), /\(admin\)|🛠️ Beheer/);
});

test('ook een commando met alleen de oude "(admin)"-markering blijft eruit', () => {
  const blocks = promptOverzicht([{ categorie: 'X' }, { cmd: 'geheim beheer', uitleg: '(admin) iets' }, { cmd: 'gewoon', uitleg: 'iets' }]);
  assert.doesNotMatch(tekstVan(blocks), /geheim beheer/);
  assert.match(tekstVan(blocks), /gewoon/);
});

test('een geheim komt er nooit in, ook niet als het per ongeluk in het register staat', () => {
  const register = [...REGISTER, { categorie: '🧪 Fout' }, { cmd: 'ZegelCode77', uitleg: 'oeps' }, { cmd: 'ok', uitleg: 'bevat zegelcode77 in de uitleg' }];
  const blocks = promptOverzicht(register, { geheim: ['zegelcode77'] });
  assert.doesNotMatch(tekstVan(blocks).toLowerCase(), /zegelcode77/);
  assert.doesNotMatch(tekstVan(blocks), /🧪 Fout/);       // de categorie werd leeg en verdween
});

test('een leeg geheim filtert niets weg', () => {
  const zonder = promptOverzicht(REGISTER);
  assert.deepEqual(promptOverzicht(REGISTER, { geheim: ['', null, '  '] }), zonder);
});

test('elk gewoon commando staat erin, precies één keer', () => {
  const tekst = tekstVan(promptOverzicht(REGISTER));
  for (const item of REGISTER.filter(i => i.cmd && !isAdminCommando(i))) {
    assert.equal(tekst.split(`\`${item.cmd}\``).length - 1, 1, item.cmd);
  }
});

test('één blok per categorie, binnen de Slack-limieten', () => {
  const blocks = promptOverzicht(REGISTER);
  const categorieen = REGISTER.filter(i => i.categorie && i.categorie !== '🛠️ Beheer');
  assert.equal(blocks.filter(b => b.type === 'section').length, categorieen.length);
  assert.ok(blocks.length <= 50);
  for (const b of blocks.filter(b => b.type === 'section')) assert.ok(b.text.text.length <= 3000);
  assert.equal(blocks[0].type, 'header');
});

test('geen twee categorieën met hetzelfde icoon', () => {
  const iconen = REGISTER.filter(i => i.categorie).map(i => [...i.categorie][0]);
  assert.equal(new Set(iconen).size, iconen.length);
});
