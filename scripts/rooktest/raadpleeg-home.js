// Rooktest: Kroket God 5.0, de raadpleegkaart met knop in de App Home en de versiekop in de help.
// Run: `node scripts/rooktest/raadpleeg-home.js`.
'use strict';
const harnas = require('./harnas.js');
const raadpleeg = require('../../lib/raadpleeg.js');

harnas(async (h) => {
  const { bouwAppHomeBlocks } = h.index;
  const vandaag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const home = (u) => JSON.stringify(bouwAppHomeBlocks(u));
  h.schrijf('instellingen.json', { weekendRust: false });
  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: null });

  const kaart = home('UA');
  h.ok(kaart.includes('open_raadpleeg'), 'kaart: knop open_raadpleeg');
  h.ok(kaart.includes('Raadpleeg de Kroket God'), 'kaart: titel');
  h.ok(kaart.includes('versie 5.0'), 'kaart: versie 5.0');
  h.ok(kaart.includes('Kroket God 5.0 · '), 'voetregel begint met Kroket God 5.0');
  h.ok(kaart.includes('Vandaag nog: horoscoop · biecht · orakel · canonisatie'), 'kaart: open rituelen');

  const n = h.views.length;
  await h.klik('open_raadpleeg', 'UA');
  const v = h.views.slice(n).find((x) => x.fn === 'open');
  h.ok(v?.args.view.private_metadata === raadpleeg.RAADPLEEG_SJABLOON, 'knop opent het raadpleegvenster');

  h.schrijf('raadpleeg.json', { datum: vandaag, heilige: null, leden: { UA: { horoscoop: { teken: 'gunstig' }, biecht: { uitslag: 'vrij' }, orakel: { lid: 'UB' }, voordracht: { kandidaat: 'UB' } } } });
  const klaar = home('UA');
  h.ok(!klaar.includes('open_raadpleeg') && klaar.includes('Morgen spreekt hij weer'), 'alles gedaan: geen knop, wel morgen-tekst');

  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: null });
  h.schrijf('verbanning.json', { UA: { tot: new Date(Date.now() + 3_600_000).toISOString() } });
  h.ok(!home('UA').includes('Raadpleeg de Kroket God'), 'balling: geen kaart');
  h.schrijf('verbanning.json', {});

  h.ok((await h.commando('UA', 'help')).includes('KROKET GOD 5.0'), 'help: KROKET GOD 5.0');
});
