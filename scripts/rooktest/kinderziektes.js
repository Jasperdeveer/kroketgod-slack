// Rooktest: kinderziektes van 5.0 (20 nov): bingo zonder LLM, het debat met een herkansing, en
// knoppen die bij een fout het lid iets laten weten. Run: `node scripts/rooktest/kinderziektes.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { getMondayOfWeek } = h.index;

  // Bingo: geen model beschikbaar (de rooktest heeft geen netwerk) -> nette melding, claim niet verbruikt.
  h.schrijf('bingo.json', { weekStart: getMondayOfWeek(), opdrachten: ['Eet een kroket op het dak'], claims: {} });
  const antwoord = await h.commando('UA', 'bingo 1 ik at hem op het dak van kantoor, met foto in de draad');
  h.ok(/zit even vol/.test(antwoord) && /niet verbruikt/.test(antwoord), `bingo zonder model: ${antwoord.trim().slice(0, 80)}`);
  h.ok(!Object.keys(h.lees('bingo.json').claims || {}).length, 'de claim is niet vastgelegd');

  // Een knop die stukloopt: het lid krijgt een melding (hier: de bied-knop zonder veilingbestand dat klopt).
  h.ephemeral.length = 0;
  h.schrijf('veiling.json', { biedingen: 'kapot' });
  await h.klik('veiling_bied_1', 'UA', {}, { channel: { id: 'CKANAAL' } });
  h.ok(h.ephemeral.some((e) => /ging iets mis/.test(e.text || '')), `kapotte knop: melding aan het lid (${h.ephemeral.length})`);
});
