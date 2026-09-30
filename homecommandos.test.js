// Tests voor de commandomenu's in de App Home. Bewaakt dat élk commando uit het register een
// geldig Home-formulier krijgt, zodat een nieuw commando nooit stilletjes ontbreekt of de
// Home-tab breekt. Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { commandoRegister } = require('./lib/commandoregister');
const {
  parseSjabloon, bouwCommandoTekst, bouwCommandoModal, leesModalWaarden, bouwCommandoMenus, bouwMenuBlocks, NIET_IN_HOME,
} = require('./lib/homecommandos');

const REGISTER = commandoRegister({ offerPerDag: 2, vetbadMax: 10 });
const LEDEN = [{ text: { type: 'plain_text', text: 'De Groene Kroket' }, value: 'U1' }, { text: { type: 'plain_text', text: 'Bitterbal' }, value: 'U2' }];

test('elk registercommando geeft een geldig Home-formulier', () => {
  for (const item of REGISTER.filter(i => i.cmd)) {
    const modal = bouwCommandoModal(item.cmd, item.uitleg, LEDEN, 3);
    assert.ok(modal.title.text.length <= 24, `titel te lang: ${item.cmd}`);
    assert.ok(modal.blocks.length <= 100, item.cmd);
    assert.ok(modal.private_metadata.length <= 3000, item.cmd);
    for (const b of modal.blocks.filter(b => b.type === 'input')) {
      assert.ok(b.label.text.length <= 2000, item.cmd);
      assert.ok(b.element.action_id, item.cmd);
    }
  }
});

test('ingevulde formulieren worden weer het juiste commando', () => {
  assert.equal(bouwCommandoTekst('eer [namen] (voor [reden])', [['Piet', 'Klaas'], 'de borrel']), 'eer Piet en Klaas voor de borrel');
  assert.equal(bouwCommandoTekst('eer [namen] (voor [reden])', [['Piet'], '']), 'eer Piet');
  assert.equal(bouwCommandoTekst('/kroketgod gok krokant|slap', ['slap']), 'gok slap');
  assert.equal(bouwCommandoTekst('rechtbank [naam] vs [naam]', ['Piet', 'Klaas']), 'rechtbank Piet vs Klaas');
  assert.equal(bouwCommandoTekst('rolwissel [naam] | [nieuwe rol]', ['Piet', 'Frituurmeester']), 'rolwissel Piet | Frituurmeester');
  assert.equal(bouwCommandoTekst('geef [naam] een kroket-therapiesessie', ['Piet']), 'geef Piet een kroket-therapiesessie');
});

test('ledenvelden geven user-ID\'s door als naam', () => {
  const state = { v0: { w: { selected_options: [{ value: 'U1' }, { value: 'U2' }] } }, v1: { w: { value: 'lekker' } } };
  const naam = { U1: 'De Groene Kroket', U2: 'Bitterbal' };
  assert.deepEqual(leesModalWaarden('eer [namen] (voor [reden])', state, id => naam[id]), [['De Groene Kroket', 'Bitterbal'], 'lekker']);
});

test('[namen] wordt een meervoudige keuze, [naam] een enkele', () => {
  assert.deepEqual(parseSjabloon('eer [namen] (voor [reden])').map(d => d.soort), ['lit', 'leden', 'tekst']);
  assert.equal(bouwCommandoModal('eer [namen]', '', LEDEN, 2).blocks[1].element.type, 'multi_static_select');
  assert.equal(bouwCommandoModal('duel [naam]', '', LEDEN).blocks[1].element.type, 'static_select');
});

test('menu\'s passen binnen de Slack-limieten en verbergen admin-commando\'s', () => {
  const extra = [{ cmd: '/kroketgod eer [namen]', uitleg: 'dubbel' }, { cmd: '/kroketgod duel [naam]', uitleg: 'duel' }];
  const gewoon = bouwCommandoMenus(REGISTER, extra, false);
  const admin = bouwCommandoMenus(REGISTER, extra, true);
  const alle = (m) => m.flatMap(x => x.opties.map(o => o.sjabloon));
  assert.ok(!alle(gewoon).includes('missie starten'));
  assert.ok(alle(admin).includes('missie starten'));
  assert.ok(alle(gewoon).includes('duel [naam]'), 'help-commando buiten het register hoort onder Overig');
  assert.equal(alle(gewoon).filter(s => s.startsWith('eer ')).length, 1, 'eer niet dubbel');
  assert.ok(!alle(admin).some(s => NIET_IN_HOME.has(s.split(' ')[0])));
  const blokken = bouwMenuBlocks(admin);
  assert.equal(blokken.length, 1, 'alle menu\'s in één blok');
  assert.ok(blokken[0].elements.length <= 25);
  for (const menu of blokken[0].elements) {
    assert.ok(menu.options.length <= 100);
    for (const o of menu.options) {
      assert.ok(o.text.text.length <= 75 && o.value.length <= 150);
      assert.equal(o.description, undefined, 'description is alleen geldig bij checkboxes/radio\'s');
    }
  }
});
