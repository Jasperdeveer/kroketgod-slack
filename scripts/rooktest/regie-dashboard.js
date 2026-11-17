// Rooktest: het regisseur-deel van het dashboard. Run: `node scripts/rooktest/regie-dashboard.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { bouwDashboardData, voerDashboardActie, saveInstellingen, casinoOpen, regieStaat, bewaarRegie } = h.index;
  const ZATERDAG_13 = Date.parse('2026-11-21T12:00:00Z');

  // 1. Stats bevat regie, met een lopend effect en de log.
  const nu = Date.now();
  bewaarRegie({ ...regieStaat(), schatkist: 7, effecten: [
    { id: 'dicht', soort: 'dicht', tot: nu + 3_600_000, data: {} },
    { soort: 'inflatie', tot: nu + 3_600_000, data: {} }, // oude data zonder id
  ], log: [{ ts: nu, id: 'casino_dicht', laag: 'ingreep', doel: null, punten: 0 }] });
  let d = await bouwDashboardData();
  h.ok(d.regie && d.regie.niveau === 'normaal' && d.regie.schatkist === 7, 'stats.regie: niveau en schatkist');
  h.ok(d.regie.effecten.length === 2 && d.regie.effecten.every((e) => e.id && e.tot), 'stats.regie: lopende effecten, ook zonder id');
  h.ok(d.regie.vandaag.length === 1 && d.regie.vandaag[0].id === 'casino_dicht', 'stats.regie: de ingrepen van vandaag');
  h.ok('verrassing' in d.regie, 'stats.regie: verrassing');

  // 2. Effect stoppen: casino meteen open.
  h.ok(!casinoOpen(), 'casino is dicht');
  const m = await voerDashboardActie('regieEffectStop', { id: 'dicht' });
  h.ok(casinoOpen() && !regieStaat().effecten.some((e) => e.soort === 'dicht'), `regieEffectStop: casino meteen open (${m})`);
  await voerDashboardActie('regieEffectStop', { id: 'inflatie' });
  h.ok(regieStaat().effecten.length === 0, 'effect zonder id stopt op soort');
  h.ok(/niet gevonden|geen/i.test(await voerDashboardActie('regieEffectStop', { id: 'bestaatniet' })), 'onbekend id geeft een melding');
  const audit = h.lees('auditlog.json').items.filter((i) => i.endpoint === 'regie');
  h.ok(audit.length >= 2, 'stoppen staat in het auditlog');

  // 3. Niveau.
  saveInstellingen({ regieNiveau: 'wild' });
  h.ok(h.lees('instellingen.json').regieNiveau === 'wild', 'regieNiveau wild wordt opgeslagen');
  saveInstellingen({ regieNiveau: 'gek' });
  h.ok(h.lees('instellingen.json').regieNiveau === 'wild', 'regieNiveau gek wordt genegeerd');

  // 4. Nu: een ingreep, ook op zaterdag.
  const echt = Date.now;
  Date.now = () => ZATERDAG_13;
  let bericht;
  try { bericht = await voerDashboardActie('regisseurNu'); } finally { Date.now = echt; }
  h.ok(h.posts.length >= 1 && regieStaat().log.length >= 1, `regisseurNu doet een ingreep op zaterdag: ${bericht}`);
  h.ok(/\S/.test(bericht), 'regisseurNu meldt wat er gebeurde');
  const veldenlijst = require('fs').readFileSync(require('path').join(__dirname, '../../dashboard.html'), 'utf8');
  h.ok(/regieNiveau:document\.getElementById\('i_regieNiveau'\)/.test(veldenlijst), 'dashboard.html stuurt regieNiveau mee');

  // M7: een lopende verrassing stil beëindigen, zonder uitbetaling.
  bewaarRegie({ ...regieStaat(), verrassing: { id: 'puntenregen', start: Date.now(), tot: Date.now() + 3_600_000, kanaal: 'CKANAAL', ts: '1.1', data: { gehad: [] } } });
  d = await bouwDashboardData();
  h.ok(d.regie.verrassing?.id === 'puntenregen', 'stats.regie: lopende verrassing zichtbaar');
  const sb = h.lees('scores.json'); const postsVoor = h.posts.length;
  const mv = await voerDashboardActie('regieVerrassingStop');
  h.ok(regieStaat().verrassing === null && JSON.stringify(h.lees('scores.json')) === JSON.stringify(sb) && h.posts.length === postsVoor && /beëindigd/.test(mv), `regieVerrassingStop: gewist zonder uitbetaling of bericht (${mv})`);
  h.ok(h.lees('auditlog.json').items.some((i) => i.endpoint === 'regie' && /stil beëindigd/.test(JSON.stringify(i))), 'regieVerrassingStop staat in het auditlog');
  h.ok(/geen/.test(await voerDashboardActie('regieVerrassingStop')), 'zonder verrassing: melding');

  // M7: een lopende zaak van het lichte tribunaal zichtbaar en stil te beëindigen.
  const sluitTs = Date.now() + 600_000;
  bewaarRegie({ ...regieStaat(), zaak: { id: 'zaak-1', doel: 'UB', grond: 'ketterij', citaat: null, titel: 'Ketter van de Dag', stemmen: { UA: 'boete' }, sluitTs, kanaal: 'CKANAAL' } });
  d = await bouwDashboardData();
  h.ok(d.regie.zaak?.doel === 'Bravo' && d.regie.zaak.grond === 'ketterij' && d.regie.zaak.sluitTs === sluitTs && d.regie.zaak.stemmen === 1, `stats.regie: lopende zaak zichtbaar (${JSON.stringify(d.regie.zaak)})`);
  const sc = JSON.stringify(h.lees('scores.json')); const pz = h.posts.length;
  const mz = await voerDashboardActie('regieZaakStop');
  h.ok(!regieStaat().zaak && JSON.stringify(h.lees('scores.json')) === sc && h.posts.length === pz && /beëindigd/.test(mz), `regieZaakStop: zaak gewist zonder uitspraak (${mz})`);
  h.ok(h.lees('auditlog.json').items.some((i) => i.endpoint === 'regie' && /licht tribunaal.*stil beëindigd/.test(JSON.stringify(i))), 'regieZaakStop staat in het auditlog');
  h.ok(/geen/.test(await voerDashboardActie('regieZaakStop')), 'zonder zaak: melding');
  const html = require('fs').readFileSync(require('path').join(__dirname, '../../dashboard.html'), 'utf8');
  h.ok(/regieZaakStop\(\)/.test(html) && /rg\.zaak/.test(html), 'dashboard.html toont de zaak met een beëindig-knop');

  // D1: de strook "Nu bezig" (samenvatting van bestaande state) en zijn knoppen.
  const t0 = Date.now();
  d = await bouwDashboardData();
  h.ok(d.nuBezig && d.nuBezig.regie && d.nuBezig.raid.actief === false && d.nuBezig.veiling.open === false && d.nuBezig.tribunaal.fase === null && d.nuBezig.gelekaart.actief === false && d.nuBezig.gokpauzes === 0, `nuBezig leeg: ${JSON.stringify(d.nuBezig)}`);
  bewaarRegie({ ...regieStaat(), schatkist: 4, effecten: [{ id: 'dicht', soort: 'dicht', tot: t0 + 3_600_000, data: {} }],
    verrassing: { id: 'puntenregen', start: t0, tot: t0 + 3_600_000, kanaal: 'CKANAAL', ts: '1.1', data: { gehad: [] } },
    zaak: { id: 'zaak-2', doel: 'UB', grond: 'ketterij', citaat: null, titel: 'Ketter', stemmen: {}, sluitTs: t0 + 600_000, kanaal: 'CKANAAL' } });
  h.schrijf('bamischijf.json', { actief: true, hp: 40, maxHp: 85, vijand: { key: 'x', naam: 'Testvijand' } });
  h.schrijf('veiling.json', { status: 'open', weekStart: h.index.getMondayOfWeek(), biedingen: [] });
  h.schrijf('tribunaal.json', { doelwitId: 'UB', fase: 'stemming' });
  h.schrijf('gelekaartpoll.json', { actief: true, doelwitId: 'UB', sluitTs: t0 + 900_000 });
  d = await bouwDashboardData();
  const nb = d.nuBezig;
  h.ok(nb.regie.schatkist === 4 && nb.regie.niveau && nb.regie.effecten.length === 1 && nb.regie.verrassing?.id === 'puntenregen' && nb.regie.zaak?.grond === 'ketterij' && Array.isArray(nb.regie.ingrepenVandaag) === false && typeof nb.regie.ingrepenVandaag === 'number', `nuBezig.regie: ${JSON.stringify(nb.regie)}`);
  h.ok(nb.raid.actief && nb.raid.naam === 'Testvijand' && nb.raid.hp === 40 && nb.raid.maxHp === 85, 'nuBezig.raid');
  h.ok(nb.veiling.open === true && nb.tribunaal.fase === 'stemming' && nb.gelekaart.actief && nb.gelekaart.sluitTs === t0 + 900_000, 'nuBezig: veiling, tribunaal, gelekaart');
  h.ok(/id="nubezig"/.test(html) && /nuBezig/.test(html), 'dashboard.html bevat de strook');
  h.ok(!/Wat de Kroket God vandaag deed/.test(html), 'de oude regisseurkaart is weg');
  // Alleen bestaande acties in de strook.
  const strook = html.slice(html.indexOf('function renderNuBezig'), html.indexOf('function renderNuBezig') + 6000);
  const gebruikt = [...strook.matchAll(/nbActie\(\\'(\w+)\\'\)|regieNu\(\)|regieStop\(|regieVerrassingStop\(\)|regieZaakStop\(\)|nbNiveau\(/g)].length;
  h.ok(gebruikt >= 7, `strook roept bestaande acties aan (${gebruikt})`);
  const indexSrc = require('fs').readFileSync(require('path').join(__dirname, '../../index.js'), 'utf8');
  for (const a of [...strook.matchAll(/nbActie\(\\'(\w+)\\'\)/g)].map((m) => m[1])) h.ok(new RegExp(`case '${a}'`).test(indexSrc), `actie ${a} bestaat in voerDashboardActie`);
});
