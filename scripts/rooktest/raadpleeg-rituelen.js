// Rooktest: het commando `raadpleeg` en de rituelen horoscoop, biecht en orakel (zonder taalmodel: altijd het vangnet).
// Run: `node scripts/rooktest/raadpleeg-rituelen.js`.
'use strict';
const harnas = require('./harnas.js');
const raadpleeg = require('../../lib/raadpleeg.js');

harnas(async (h) => {
  const staat = () => { try { return h.lees('raadpleeg.json'); } catch { return {}; } };
  const echteRandom = Math.random;
  h.schrijf('instellingen.json', { weekendRust: false });
  h.schrijf('raadpleeg.json', { datum: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date()), leden: {}, heilige: null });

  // Horoscoop
  Math.random = () => 0.1;
  let n = h.posts.length;
  await h.commando('UA', 'raadpleeg horoscoop');
  h.ok(h.posts.length === n + 1 && /De sterren boven de frituur staan gunstig voor Alfa/.test(h.posts[n].text) && /Gunstig/.test(h.posts[n].text), `horoscoop post de vangnetzin en *Gunstig*: ${h.posts[n]?.text}`);
  h.ok(staat().leden?.UA?.horoscoop?.teken === 'gunstig', 'raadpleeg.json heeft leden.UA.horoscoop.teken gunstig');
  n = h.posts.length;
  const tweede = await h.commando('UA', 'raadpleeg horoscoop');
  h.ok(h.posts.length === n && /al om een horoscoop/.test(tweede), `tweede horoscoop: ephemeral, geen nieuwe post (${tweede.trim()})`);

  // Biecht
  Math.random = () => 0.9;
  n = h.posts.length;
  const leeg = await h.commando('UB', 'raadpleeg biecht');
  h.ok(h.posts.length === n && /lege biecht/i.test(leeg) && !staat().leden?.UB, 'biecht zonder zonde: ephemeral en niets geschreven');
  await h.commando('UB', 'raadpleeg biecht ik at ketchup');
  h.ok(h.posts.length === n + 1 && /Boetedoening voor/.test(h.posts[n].text), `biecht post de boetedoening: ${h.posts[n]?.text}`);
  h.ok(staat().leden?.UB?.biecht?.boete, 'de state heeft een boete');

  // Orakel
  n = h.posts.length;
  await h.commando('UC', 'raadpleeg orakel wordt het wat');
  h.ok(h.posts.length === n + 1 && /Voorspelling/.test(h.posts[n].text) && /^🔮 _[^_]+, /.test(h.posts[n].text), `orakel post een voorspelling: ${h.posts[n]?.text}`);
  const doel = staat().leden?.UC?.orakel?.doel;
  h.ok(doel && doel !== 'UC', `orakel.doel is een ander lid (${doel})`);

  // Venster en onbekend ritueel
  const v = h.views.length;
  await h.commando('UD', 'raadpleeg');
  const open = h.views.slice(v).find((x) => x.fn === 'open');
  h.ok(open?.args.view.callback_id === 'home_cmd_modal' && open.args.view.private_metadata === raadpleeg.RAADPLEEG_SJABLOON, 'raadpleeg opent het commandovenster met het sjabloon');
  const dans = await h.commando('UD', 'raadpleeg dans');
  h.ok(['horoscoop', 'biecht', 'orakel', 'canoniseer'].every((r) => dans.includes(r)), `raadpleeg dans noemt de vier rituelen: ${dans.trim()}`);

  // Balling
  h.schrijf('verbanning.json', { UE: { tot: new Date(Date.now() + 3_600_000).toISOString() } });
  n = h.posts.length;
  await h.commando('UE', 'raadpleeg horoscoop');
  h.ok(!staat().leden?.UE, 'een balling doet niets aan de state');
  Math.random = echteRandom;
});
