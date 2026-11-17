// Rooktest: canonisatie (voordragen, bevestigen met een 😇, titel in Home en dossier).
// Run: `node scripts/rooktest/raadpleeg-heilige.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { bouwAppHomeBlocks, bouwDossierBlok } = h.index;
  const dag = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(d);
  const vandaag = dag();
  const gisteren = dag(new Date(Date.now() - 86_400_000));
  const staat = () => h.lees('raadpleeg.json');
  const heiligPosts = () => h.posts.filter((p) => /✨/.test(p.text || ''));
  h.schrijf('instellingen.json', { weekendRust: false });
  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: null });
  let n = h.posts.length;

  await h.commando('UA', 'raadpleeg canoniseer Alfa');
  h.ok(!staat().heilige && h.posts.length === n, 'zelf voordragen wordt geweigerd');
  await h.commando('UA', 'raadpleeg canoniseer Bravo');
  const voordracht = h.posts.slice(n).find((p) => /:innocent:/.test(p.text || ''));
  h.ok(!!voordracht, 'voordracht post met :innocent:');
  h.ok(staat().heilige?.kandidaat === 'UB' && voordracht && staat().heilige.ts === voordracht.ts, 'heilige.kandidaat is UB met de ts van de post');

  const reactie = (user, extra = {}) => h.gebeurtenis('reaction_added', {
    user, reaction: 'innocent', item: { channel: 'CKANAAL', ts: voordracht.ts }, item_user: 'UBOT', event_ts: `e${user}${Math.random()}`, ...extra });
  await reactie('UA'); await reactie('UB');
  h.ok(staat().heilige.bevestigers.length === 0, 'voorsteller en kandidaat tellen niet');
  await reactie('UC'); await reactie('UC');
  h.ok(staat().heilige.bevestigers.length === 1, 'UC twee keer telt één keer');
  await reactie('UD');
  h.ok(staat().heilige.heilig === true && heiligPosts().length === 1, 'UD maakt UB heilig, met één ✨-post');
  await reactie('UE');
  h.ok(heiligPosts().length === 1, 'UE daarna geeft geen tweede post');

  const ephN = h.ephemeral.length;
  const antw = await h.commando('UC', 'raadpleeg canoniseer Delta');
  h.ok(staat().heilige.kandidaat === 'UB', 'tweede voordracht geweigerd: kandidaat blijft UB');
  h.ok(antw.length > 0 || h.ephemeral.length > ephN, 'tweede voordracht krijgt een weigering');

  h.ok(JSON.stringify(bouwAppHomeBlocks('UB')).includes('Heilige van de Dag'), 'Home UB bevat Heilige van de Dag');
  h.ok(bouwDossierBlok('UB').includes('Heilige van de Dag'), 'dossier UB bevat Heilige van de Dag');

  const s = staat();
  h.schrijf('raadpleeg.json', { datum: gisteren, leden: s.leden, heilige: s.heilige });
  h.ok(!JSON.stringify(bouwAppHomeBlocks('UB')).includes('Heilige van de Dag'), 'gisteren: heilige niet in Home');
  h.ok(!bouwDossierBlok('UB').includes('Heilige van de Dag'), 'gisteren: heilige niet in dossier');

  // Een balling kan niet worden voorgedragen.
  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: null });
  h.schrijf('verbanning.json', { UC: { tot: new Date(Date.now() + 3_600_000).toISOString() } });
  await h.commando('UA', 'raadpleeg canoniseer Charlie');
  h.ok(!staat().heilige, 'balling wordt niet voorgedragen');
  h.schrijf('verbanning.json', {});

  // I3: twee voordrachten vlak na elkaar: alleen de eerste telt.
  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: null });
  await Promise.all([h.commando('UA', 'raadpleeg canoniseer Bravo'), h.commando('UC', 'raadpleeg canoniseer Delta')]);
  const st = staat();
  h.ok(!!st.heilige && !!st.heilige.ts && Object.values(st.leden).filter((l) => l.voordracht).length === 1, 'twee voordrachten tegelijk: er blijft er één over, met ts');

  // I2: een voordracht is ook vanuit een ander kanaal te bevestigen.
  h.schrijf('raadpleeg.json', { datum: vandaag, leden: {}, heilige: { kandidaat: 'UB', voorsteller: 'UA', ts: '777.1', kanaal: 'CANDERS', tot: Date.now() + 3_600_000, bevestigers: [], heilig: false } });
  for (const u of ['UC', 'UD']) await h.gebeurtenis('reaction_added', { user: u, reaction: 'innocent', item: { channel: 'CANDERS', ts: '777.1' }, item_user: 'UBOT', event_ts: `x${u}` });
  h.ok(staat().heilige.heilig === true, 'voordracht in een ander kanaal is te bevestigen');
});
