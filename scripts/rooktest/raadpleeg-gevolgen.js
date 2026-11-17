// Rooktest: de gevolgen van de rituelen in het spel (horoscoop in duels, orakel en boete via telActie, Home-regels).
// Run: `node scripts/rooktest/raadpleeg-gevolgen.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { voerDuel, bouwAppHomeBlocks } = h.index;
  const dag = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);
  const vandaag = dag();
  const gisteren = dag(new Date(Date.now() - 86_400_000));
  const zetStaat = (leden, datum = vandaag) => h.schrijf('raadpleeg.json', { datum, leden, heilige: null });
  const staat = () => h.lees('raadpleeg.json');
  const regie = () => { try { return h.lees('regie.json'); } catch { return { log: [] }; } };
  const nawerkingen = (id) => (regie().log || []).filter((l) => l.laag === 'nawerking' && l.id === id);
  const duelMet = async (random, wie = ['UA', 'UB']) => {
    h.schrijf('duels.json', {});
    h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 10, UB: 10, UD: 10 });
    const orig = Math.random; Math.random = () => random;
    try { return await voerDuel(h.client, wie[0], wie[1], 'CKANAAL'); } finally { Math.random = orig; }
  };
  const alsTekst = () => JSON.stringify(h.posts);
  h.schrijf('instellingen.json', { weekendRust: false });
  h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });

  // Geweigerd duel: balling als doelwit verbruikt niets.
  zetStaat({ UA: { horoscoop: { teken: 'gunstig', verbruikt: false } } });
  h.schrijf('verbanning.json', { UC: { tot: new Date(Date.now() + 3_600_000).toISOString() } });
  const geweigerd = await duelMet(0.55, ['UA', 'UC']);
  h.ok(geweigerd.ok === false && staat().leden.UA.horoscoop.verbruikt === false, 'geweigerd duel: horoscoop van UA onverbruikt');
  h.schrijf('verbanning.json', {});

  // Duel met sterren: gunstig voor UA (en ongunstig voor UB) wint bij 0.55; zonder horoscoop verliest UA.
  zetStaat({ UA: { horoscoop: { teken: 'gunstig', verbruikt: false } }, UB: { horoscoop: { teken: 'ongunstig', verbruikt: false } } });
  let n = h.posts.length;
  const met = await duelMet(0.55);
  h.ok(met.ok && /UA|Alfa/.test(met.tekst) && /won/.test(met.tekst) && met.tekst.includes('Alfa'), `met sterren wint UA: ${met.tekst}`);
  h.ok(staat().leden.UA.horoscoop.verbruikt && staat().leden.UB.horoscoop.verbruikt, 'beide horoscopen zijn verbruikt');
  h.ok(h.posts.slice(n).some((p) => /🔭/.test(p.text || '')), 'een draadpost bevat 🔭');
  zetStaat({});
  n = h.posts.length;
  const zonder = await duelMet(0.55);
  h.ok(zonder.ok && zonder.tekst.includes('Bravo') && !h.posts.slice(n).some((p) => /🔭/.test(p.text || '')), `zonder sterren verliest UA: ${zonder.tekst}`);

  // Gisteren
  zetStaat({ UD: { horoscoop: { teken: 'gunstig', verbruikt: false } } }, gisteren);
  n = h.posts.length;
  await duelMet(0.55, ['UD', 'UB']);
  h.ok(!h.posts.slice(n).some((p) => /🔭/.test(p.text || '')), 'gisteren: geen 🔭-regel');
  h.ok(!staat().leden?.UD?.horoscoop?.verbruikt, 'gisteren: horoscoop niet verbruikt');

  // Orakel
  zetStaat({ UA: { orakel: { doel: 'UB', actie: 'offer', tekst: '{naam} offert nog vandaag', uitgekomen: false } } });
  h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
  n = h.posts.length;
  await h.commando('UB', 'offer 1');
  const orakel = nawerkingen('orakel');
  h.ok(orakel.length === 1 && orakel[0].doel === 'UA' && orakel[0].punten === 1, `orakel: één nawerking voor UA: ${JSON.stringify(orakel)}`);
  h.ok(h.posts.slice(n).some((p) => /🔮/.test(p.text || '')), 'orakel: post of draadregel met 🔮');
  await h.commando('UB', 'offer 1');
  h.ok(nawerkingen('orakel').length === 1, 'tweede offer geeft geen tweede nawerking');

  // Boete
  zetStaat({ UC: { biecht: { uitkomst: 'boete', boete: { actie: 'offer', tekst: 'breng een offer' }, voldaan: false } } });
  await h.commando('UC', 'offer 1');
  const boete = nawerkingen('biecht');
  h.ok(boete.length === 1 && boete[0].doel === 'UC' && boete[0].punten === 1, `boete: één nawerking voor UC: ${JSON.stringify(boete)}`);

  // Plafond
  zetStaat({ UE: { orakel: { doel: 'UB', actie: 'offer', tekst: '{naam} offert', uitgekomen: false } } });
  h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [{ ts: Date.now(), id: 'x', laag: 'nawerking', doel: 'UF', punten: 15, soort: 'geven' }], verrassing: null });
  n = h.posts.length;
  await h.commando('UB', 'offer 1');
  h.ok(nawerkingen('orakel').length === 0, 'plafond: geen nawerking');
  h.ok(alsTekst().includes('Schatkist van de Kroket God is voor vandaag leeg'), 'plafond: bericht bevat REGIE_GEEN_RUIMTE');
  h.ok(staat().leden.UE.orakel.uitgekomen === true, 'plafond: uitgekomen is true');

  // Home
  zetStaat({ UC: { biecht: { uitkomst: 'boete', boete: { actie: 'offer', tekst: 'breng een offer' }, voldaan: false } }, UA: { horoscoop: { teken: 'gunstig', verbruikt: false } } });
  h.ok(JSON.stringify(bouwAppHomeBlocks('UC')).includes('Boetedoening'), 'Home UC bevat Boetedoening');
  // ACTIEF OP U is sinds de herindeling een venster achter het menu Mijn status.
  h.ok(JSON.stringify(h.index.bouwNaslagVenster('actief', 'UA')).includes('Horoscoop'), 'Venster Actief op u (UA) bevat Horoscoop');
});
