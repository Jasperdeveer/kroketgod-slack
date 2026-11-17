// Rooktest: de telActie-haken van de nieuwe opdrachten (raad, genade, klacht, zegen, tribunaal, verbond, premie, missie, seizoen).
// Run: `node scripts/rooktest/opdrachten-haken.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { sluitGeleKaartPoll, voerDuel, stemTribunaal, vollooiMissie, telActie, getMondayOfWeek } = h.index;
  const teller = (id, actie) => (h.lees('tellers.json')[id] || {})[actie] || 0;
  const nu = Date.now();
  h.schrijf('instellingen.json', { weekendRust: false });
  h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 20, UB: 20, UC: 20, UD: 20 });
  h.schrijf('tellers.json', {});

  // Raad: UB en UC geel, UD op beide; een tweede sluiting telt niet nog eens.
  h.schakel.reacties = [{ name: 'large_yellow_square', users: ['UB', 'UC', 'UD'] }, { name: 'large_green_square', users: ['UD'] }];
  h.schrijf('gelekaartpoll.json', { actief: true, doelwitId: 'UE', aanklagerId: 'UF', reden: 'x', hadAlKaart: false, godStem: 'onterecht', bondgenootIds: [], gestart: nu, sluitTs: nu, kanaal: 'CKANAAL', berichtTs: '1' });
  await sluitGeleKaartPoll(h.client, { rng: () => 0.99 });
  await sluitGeleKaartPoll(h.client, { rng: () => 0.99 });
  h.ok(teller('UB', 'raad_stem') === 1 && teller('UC', 'raad_stem') === 1 && teller('UD', 'raad_stem') === 0, 'raad_stem: UB 1, UC 1, UD 0 en niet dubbel');

  // Begenade
  h.schrijf('verbanning.json', { UB: { tot: new Date(nu + 3_600_000).toISOString() } });
  await h.commando('UA', 'begenade Bravo');
  h.ok(teller('UA', 'begenade') === 1, 'begenade telt voor de gever');

  // Klacht: beide takken
  const orig = Math.random;
  for (const r of [0.01, 0.5]) { Math.random = () => r; try { await h.commando('UA', 'klacht Bravo te veel mayonaise'); } finally { Math.random = orig; } }
  h.ok(teller('UA', 'klacht') === 2, `klacht telt in beide takken (${teller('UA', 'klacht')})`);

  // Zegen
  h.schrijf('profeet.json', { userId: 'UA', weekStart: getMondayOfWeek(), zegenGebruikt: false });
  await h.commando('UA', 'zegen Bravo');
  h.ok(teller('UB', 'gezegend') === 1, 'gezegend telt voor de ontvanger');

  // Tribunaal: alleen de eerste stem
  h.schrijf('tribunaal.json', { fase: 'stemming', doelwitId: 'UE', stemmen: {}, sluitTs: nu + 3_600_000 });
  await stemTribunaal(h.client, 'UA', 'voor');
  await stemTribunaal(h.client, 'UA', 'tegen');
  h.ok(teller('UA', 'tribunaal_stem') === 1, 'tribunaal_stem telt de eerste stem, niet de wijziging');

  // De beschuldigde telt niet mee voor zijn eigen tribunaal
  h.schrijf('tribunaal.json', { fase: 'stemming', doelwitId: 'UD', stemmen: {}, sluitTs: nu + 3_600_000 });
  await stemTribunaal(h.client, 'UD', 'tegen');
  h.ok(teller('UD', 'tribunaal_stem') === 0, 'tribunaal_stem telt niet voor de beschuldigde');

  // Verbond
  h.schrijf('allianties.json', {});
  await h.commando('UA', 'alliantie Charlie');
  h.ok(teller('UA', 'verbond_gesloten') === 1 && teller('UC', 'verbond_gesloten') === 0, 'verbond_gesloten telt voor de aanvrager alleen');

  // Premie
  h.schrijf('duels.json', {});
  h.schrijf('premie.json', { doelwitId: 'UB', bonus: 3, weekStart: getMondayOfWeek(), geind: false });
  Math.random = () => 0.01;
  try { await voerDuel(h.client, 'UA', 'UB', 'CKANAAL'); } finally { Math.random = orig; }
  h.ok(teller('UA', 'premie_geind') === 1, 'premie_geind telt voor de winnaar');

  // Missie
  // De aankondiging heeft geen vangnet en faalt offline; de teller staat dan al.
  await vollooiMissie(h.client, 'CKANAAL', { userId: 'UA', bijnaam: 'Alfa', beschrijving: 'x', deelnemers: ['UA', 'UB'], status: 'actief' }).catch(() => {});
  h.ok(teller('UA', 'missie_voltooid') === 1 && teller('UB', 'missie_voltooid') === 1, 'missie_voltooid telt voor elke deelnemer');

  // Seizoen
  const seizoen = (status) => h.schrijf('seizoen.json', { nummer: 1, status, dreiging: { naam: 'X' }, startWeek: getMondayOfWeek(), maxHp: 100, hp: 100, bijdragen: {} });
  seizoen('actief');
  await telActie(h.client, 'UD', 'offer');
  h.ok(teller('UD', 'seizoen_daad') === 1, 'seizoen_daad telt bij een actief seizoen');
  seizoen('verloren');
  await telActie(h.client, 'UD', 'offer');
  h.ok(teller('UD', 'seizoen_daad') === 1, 'seizoen_daad blijft bij status verloren');

  // Anonieme klacht: de weekopdracht beloont stil, zonder naam of id in kanaal, log of archief.
  const OPD = h.index.alleOpdrachten();
  const bewaard = OPD.splice(0, OPD.length, ...OPD.filter((o) => o.soort !== 'week' || o.id === 'w-klacht'));
  const klachtRegel = OPD.find((o) => o.id === 'w-klacht');
  const vanaf = klachtRegel.vanaf;
  klachtRegel.vanaf = undefined; // los van de lanceerdatum
  try {
    h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 20 });
    const voor = h.lees('scores.json').UA;
    const postsVoor = h.posts.length;
    const t0 = Date.now();
    await telActie(h.client, 'UA', 'klacht');
    h.ok(h.lees('scores.json').UA === voor + 2, `w-klacht beloont (+2): ${voor} -> ${h.lees('scores.json').UA}`);
    const nieuw = JSON.stringify(h.posts.slice(postsVoor)) + JSON.stringify(h.lees('weekgebeurtenissen.json'));
    h.ok(!/klacht/i.test(nieuw) || !/Alfa|"UA"/.test(nieuw), 'w-klacht: geen naam of id bij de opdracht');
    h.ok(!h.lees('weekgebeurtenissen.json').events.some((e) => e.ts >= t0 && e.type === 'opdracht' && (e.userId || /Alfa/.test(e.beschrijving))), 'w-klacht: logregel zonder lid');
    h.ok(!h.posts.slice(postsVoor).some((p) => /WEEKOPDRACHT/.test(p.text)), 'w-klacht: geen kanaalpost');
  } finally { klachtRegel.vanaf = vanaf; OPD.splice(0, OPD.length, ...bewaard); }
});
