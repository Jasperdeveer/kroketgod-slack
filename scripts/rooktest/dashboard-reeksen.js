// Rooktest: bouwDashboardData().reeksen (Dashboard 2.0) met lege en gevulde state.
// Run: `node scripts/rooktest/dashboard-reeksen.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { bouwDashboardData, legDagstandVast, dagSleutel, regieStaat, bewaarRegie } = h.index;
  const VORM = ['puntenWeek', 'activiteitWeekdag', 'kaartenMaand', 'schatkist', 'gegevenGenomen', 'ingrepenPerDag', 'ingrepenPerId',
    'verrassingen', 'aflaten', 'casinoPerDag', 'huiswinst', 'spellen', 'winnaarsVerliezers', 'weekvijand', 'llm'];
  const vormOk = (r) => VORM.every((k) => (Array.isArray(r[k]) || (Array.isArray(r[k]?.labels) && Array.isArray(r[k]?.reeksen))));

  // 1. Lege state: ontbrekende bestanden en een kapot bestand geven lege reeksen, geen fout.
  for (const f of ['casinostats.json', 'winkelhistorie.json', 'llmstats.json', 'geleKaarten.json']) { try { require('fs').unlinkSync(h.state + '/' + f); } catch (_) {} }
  h.schrijf('puntenhistorie.json', {});
  let d = await bouwDashboardData();
  h.ok(d.reeksen && vormOk(d.reeksen), 'reeksen bestaat met alle vormen bij lege state');
  h.ok(d.reeksen.schatkist.labels.length === 21 && d.reeksen.casinoPerDag.labels.length === 14 && d.reeksen.puntenWeek.labels.length === 7, 'vensters: 21, 14 en 7 dagen');
  require('fs').writeFileSync(h.state + '/casinostats.json', '{kapot');
  d = await bouwDashboardData();
  h.ok(vormOk(d.reeksen) && d.reeksen.spellen.length === 0, 'kapot casinostats-bestand geeft een lege reeks');

  // 2. Gevulde state.
  const nu = Date.now();
  const vandaag = dagSleutel();
  h.schrijf('casinostats.json', { [vandaag]: { leden: { UA: { slots: { spellen: 2, ingezet: 4, uitbetaald: 1 } } } } });
  h.schrijf('llmstats.json', { dagen: { [vandaag]: { gemini: 5 } } });
  h.schrijf('winkelhistorie.json', { items: [{ ts: nu, koperId: 'UA', item: 'schild', prijs: 5, bron: 'slack' }] });
  h.schrijf('geleKaarten.json', { UB: { kaarten: [{ ts: nu, kleur: 'rood' }] } });
  bewaarRegie({ ...regieStaat(), schatkist: 9, log: [{ ts: nu, id: 'zegen', laag: 'ingreep', soort: 'geven', doel: 'UA', punten: 3 }] });
  legDagstandVast();
  d = await bouwDashboardData();
  const r = d.reeksen;
  h.ok(vormOk(r), 'gevulde state: vormen kloppen');
  h.ok(r.spellen[0]?.label === 'slots' && r.spellen[0].value === 2, 'casino: spellen per soort');
  h.ok(r.casinoPerDag.reeksen.find((x) => x.naam === 'ingezet').punten.at(-1) === 4, 'casino: ingezet vandaag');
  h.ok(r.llm.reeksen[0]?.naam === 'gemini' && r.llm.reeksen[0].punten.at(-1) === 5, 'llm: calls per provider');
  h.ok(r.aflaten[0]?.value === 5, 'aflatenhandel: omzet per item');
  h.ok(r.kaartenMaand.reeksen.find((x) => x.naam === 'rood').punten[0] === 1, 'kaarten: rood deze maand');
  h.ok(r.gegevenGenomen.reeksen[0].punten.at(-1) === 3 && r.ingrepenPerId[0]?.label === 'zegen', 'regielog: gegeven en ingrepen');
  h.ok(r.schatkist.reeksen[0].punten.at(-1) === 9, 'schatkist: vandaag is de live stand');
  const hist = h.lees('puntenhistorie.json');
  h.ok(hist.schatkist?.[vandaag] === 9, 'dagstand bewaart de schatkist');
  h.ok(r.puntenWeek.reeksen.length > 0, 'puntenWeek heeft leden uit de dagstand');
  const wk = h.lees('bamischijf.json');
  h.ok(!wk.actief || hist.raid?.[vandaag]?.hp === wk.hp, 'dagstand bewaart de weekvijand-HP (als er een raid actief is)');
});
