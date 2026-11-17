// Rooktest: toespraken en praatjes van de regisseur (gunst, uitdaging, loterij, praatjes) en de vier verdwenen crons.
// Run: `node scripts/rooktest/regie-toespraken.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const MIN = 60_000;
const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { UITVOERDERS, voerIngreepUit, voerDuel, bouwRegieStand } = h.index;
  const leeg = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const schoon = () => { h.schrijf('regie.json', leeg()); h.posts.length = 0; h.ephemeral.length = 0; };
  const score = (id) => h.lees('scores.json')[id] || 0;
  const zetScores = (o) => { h.schrijf('duels.json', {}); h.schrijf('scores.json', { ...h.lees('scores.json'), ...o }); };
  const knopId = (post, actionId) => post.blocks.flatMap((b) => b.elements || []).find((e) => e.action_id === actionId)?.value;
  const duelMet = async (random, wie, ...rest) => {
    const orig = Math.random; Math.random = () => random;
    try { return await voerDuel(h.client, wie[0], wie[1], 'CKANAAL', ...rest); } finally { Math.random = orig; }
  };

  // 1. De gunst: alleen het doelwit, binnen het uur, één keer, begrensd tegen de ruimte.
  schoon(); zetScores({ UC: 10 });
  const nu = Date.now();
  await voerIngreepUit(h.client, { ingreep: boek('gunst_stil'), doel: 'UC', punten: 0, reden: 'test' }, {}, nu);
  const gp = h.posts.at(-1);
  const gid = knopId(gp, 'regie_gunst');
  h.ok(h.posts.length === 1 && /<@UC>/.test(gp.text) && !/test/.test(gp.text) && gid, `gunst: bericht met knop voor UC: ${gp?.text}`);
  const e0 = staat().effecten.find((e) => e.soort === 'gunst');
  h.ok(e0 && Math.abs(e0.tot - (nu + 60 * MIN)) < 5000 && e0.data.doel === 'UC', 'gunst: knopstaat staat in regie.json met een uur looptijd');
  await h.klik('regie_gunst', 'UA', { value: gid });
  h.ok(score('UC') === 10 && score('UA') !== 12 && /iemand anders/.test(h.ephemeral.at(-1).text), `een ander lid krijgt niets: ${h.ephemeral.at(-1)?.text}`);
  await h.klik('regie_gunst', 'UC', { value: gid });
  const na1 = staat();
  h.ok(score('UC') === 12, `UC krijgt 2 punten (${score('UC')})`);
  h.ok(na1.log.some((r) => r.laag === 'nawerking' && r.id === 'gunst_stil' && r.doel === 'UC' && r.punten === 2), 'uitbetaling staat als nawerking in het log');
  await h.klik('regie_gunst', 'UC', { value: gid });
  h.ok(score('UC') === 12 && /al opgeëist/.test(h.ephemeral.at(-1).text), 'tweede klik geeft niets meer');
  // Na het uur: vriendelijke weigering.
  schoon(); zetScores({ UC: 10 });
  await voerIngreepUit(h.client, { ingreep: boek('gunst_stil'), doel: 'UC', punten: 0 }, {}, nu);
  const gid2 = knopId(h.posts.at(-1), 'regie_gunst');
  h.schrijf('regie.json', { ...staat(), effecten: staat().effecten.map((e) => ({ ...e, tot: Date.now() - 1000 })) });
  await h.klik('regie_gunst', 'UC', { value: gid2 });
  h.ok(score('UC') === 10 && /verlopen/.test(h.ephemeral.at(-1).text), `na het uur: weigering, geen punten: ${h.ephemeral.at(-1)?.text}`);
  // Geen ruimte (P16): het dagplafond is op.
  schoon(); zetScores({ UC: 10 });
  await voerIngreepUit(h.client, { ingreep: boek('gunst_stil'), doel: 'UC', punten: 0 }, {}, nu);
  const gid3 = knopId(h.posts.at(-1), 'regie_gunst');
  h.schrijf('regie.json', { ...staat(), log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }] });
  await h.klik('regie_gunst', 'UC', { value: gid3 });
  h.ok(score('UC') === 10 && /genoeg weggegeven/.test(h.ephemeral.at(-1).text), 'dagplafond op: vriendelijk bericht, geen punten');
  // Schatkist eerst.
  h.schrijf('regie.json', { ...staat(), log: [], schatkist: 5 });
  await h.klik('regie_gunst', 'UC', { value: gid3 });
  h.ok(score('UC') === 12 && staat().schatkist === 3, `gunst komt uit de Schatkist (${staat().schatkist})`);

  // 2. De uitdaging: UA koploper, UF hekkensluiter.
  const stel = () => { schoon(); zetScores({ UA: 40, UB: 10, UC: 10, UD: 10, UE: 10, UF: 1 }); };
  const stuur = async (extra = {}) => {
    const n = Date.now();
    await voerIngreepUit(h.client, { ingreep: boek('koploper_uitdagen'), doel: null, punten: 0, duurMinuten: 120, reden: 'test', ...extra }, bouwRegieStand(n), n);
    return knopId(h.posts.at(-1), 'regie_uitdaging');
  };
  stel();
  const uid = await stuur();
  const up = h.posts.at(-1);
  const ue = staat().effecten.find((e) => e.soort === 'uitdaging');
  h.ok(uid && /<@UA>/.test(up.text) && /<@UF>/.test(up.text) && ue.data.koploper === 'UA' && ue.data.hekkensluiter === 'UF', `uitdaging: koploper UA, hekkensluiter UF: ${up.text}`);
  h.ok(Math.abs(ue.tot - (Date.now() + 120 * MIN)) < 5000, 'uitdaging: twee uur looptijd');
  await h.klik('regie_uitdaging', 'UB', { value: uid });
  h.ok(/alleen voor de koploper/.test(h.ephemeral.at(-1).text) && !h.lees('duels.json').UB, 'een ander lid kan de uitdaging niet starten');
  // De koploper start het duel; random 0.99 laat de doelwit (de hekkensluiter) winnen.
  const orig = Math.random; Math.random = () => 0.99;
  try { await h.klik('regie_uitdaging', 'UA', { value: uid }); } finally { Math.random = orig; }
  const winst = score('UF');
  h.ok(winst >= 5, `UF won het duel en kreeg inzet plus 3 (score ${winst})`);
  const na = staat();
  h.ok(na.log.some((r) => r.laag === 'nawerking' && r.id === 'koploper_uitdagen' && r.doel === 'UF' && r.punten === 3), 'de 3 punten staan als nawerking in het log');
  h.ok(na.effecten.find((e) => e.soort === 'uitdaging').data.gebruikt === true, 'uitdaging is verbruikt');
  // Nog een duel van dezelfde twee: geen tweede uitbetaling.
  h.schrijf('duels.json', {});
  const voor = score('UF'); await duelMet(0.99, ['UA', 'UF']);
  h.ok(staat().log.filter((r) => r.id === 'koploper_uitdagen' && r.laag === 'nawerking').length === 1, 'betaalt maar één keer');
  void voor;
  // Wint de koploper, dan niets.
  stel(); await stuur();
  await duelMet(0, ['UA', 'UF']);
  h.ok(!staat().log.some((r) => r.laag === 'nawerking'), 'wint de koploper, dan geen extra punten');
  // Een duel van de hekkensluiter tegen een ander lid telt niet.
  stel(); await stuur();
  h.schrijf('scores.json', { ...h.lees('scores.json'), UF: 10 });
  await duelMet(0.99, ['UC', 'UF']); // UF is doelwit en wint, maar tegen UC
  h.ok(!staat().log.some((r) => r.laag === 'nawerking'), 'een duel tegen een ander lid telt niet');
  // Na de looptijd telt het niet meer.
  stel(); await stuur();
  h.schrijf('regie.json', { ...staat(), effecten: staat().effecten.map((e) => ({ ...e, tot: Date.now() - 1000 })) });
  await duelMet(0.99, ['UA', 'UF']);
  h.ok(!staat().log.some((r) => r.laag === 'nawerking'), 'na de looptijd geen uitbetaling');
  // Duelverbod: de knop start geen duel.
  stel(); const uid2 = await stuur();
  h.schrijf('regie.json', { ...staat(), effecten: [...staat().effecten, { id: 'duelverbod', soort: 'duelverbod', tot: Date.now() + 30 * MIN, data: {} }] });
  await h.klik('regie_uitdaging', 'UA', { value: uid2 });
  h.ok(/rust/.test(h.ephemeral.at(-1).text) && !h.lees('duels.json').UA, `duelverbod geldt voor de knop: ${h.ephemeral.at(-1)?.text}`);
  // Geen ruimte: duel gaat door, geen punten, wel een vriendelijk bericht.
  stel(); await stuur();
  h.schrijf('regie.json', { ...staat(), log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }] });
  await duelMet(0.99, ['UA', 'UF']);
  h.ok(!staat().log.some((r) => r.laag === 'nawerking'), 'geen ruimte: geen uitbetaling');

  // 3. Loterij: bonus, geen lot op naam van een lid; Schatkist eerst; begrensd.
  schoon();
  h.schrijf('loterij.json', { loten: [{ userId: 'UA', dag: '2026-11-16' }], historie: [] });
  h.schrijf('regie.json', { ...leeg(), schatkist: 2 });
  await voerIngreepUit(h.client, { ingreep: boek('loterij_gevuld'), doel: null, punten: 3, reden: 'test' }, {}, Date.now());
  const lot = h.lees('loterij.json');
  h.ok(lot.bonus === 3 && lot.loten.length === 1, `loterij: bonus +3, geen extra lot (${JSON.stringify(lot)})`);
  h.ok(staat().schatkist === 0 && staat().log.at(-1).punten === 3, 'Schatkist eerst leeg, 3 geboekt');
  h.ok(h.posts.length === 1 && !/🔱/.test(h.posts[0].text) && /3 punten/.test(h.posts[0].text), `tekst-override: ${h.posts[0]?.text}`);
  h.schrijf('regie.json', { ...leeg(), log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 14, soort: 'geven' }] });
  await voerIngreepUit(h.client, { ingreep: boek('loterij_gevuld'), doel: null, punten: 3 }, {}, Date.now());
  h.ok(h.lees('loterij.json').bonus === 4 && staat().log.at(-1).punten === 1, `begrensd op de ruimte: bonus ${h.lees('loterij.json').bonus}`);

  // 4. Praatjes: tekst letterlijk, geen aankondiging, wel geboekt. De kelder levert de tekst (geen netwerk in de rooktest).
  const kelder = (tekst) => ({ tekst, gemaakt: Date.now(), dagKey: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date()) });
  for (const id of ['casinoroddel', 'kroketfeitje', 'gedachte']) {
    schoon();
    h.schrijf('voorraad.json', { feitje: [kelder('Een kroket is een kroket, zegt de Kroket God.')], spontaan: [kelder('De frituur ziet alles en vergeeft weinig.')] });
    const orig2 = Math.random; Math.random = () => 0.999; // vaste takken
    try { await voerIngreepUit(h.client, { ingreep: boek(id), doel: null, punten: 0, reden: 'x' }, {}, Date.now()); } finally { Math.random = orig2; }
    h.ok(UITVOERDERS[id] && h.posts.length === 1 && h.posts[0].text.length > 10 && !/^🔱/.test(h.posts[0].text), `praatje ${id} post tekst: ${String(h.posts[0]?.text).slice(0, 60)}`);
    h.ok(staat().log.at(-1)?.id === id && staat().log.at(-1).laag === 'praatje', `praatje ${id} is geboekt`);
  }

  // Zonder tekst (keten plat): niets gepost, wel geboekt.
  schoon(); h.schrijf('voorraad.json', {});
  await voerIngreepUit(h.client, { ingreep: boek('kroketfeitje'), doel: null, punten: 0 }, {}, Date.now());
  h.ok(h.posts.length === 0 && staat().log.at(-1)?.id === 'kroketfeitje', 'praatje zonder tekst: niets gepost, wel geboekt');

  // 5. De vier crons zijn weg.
  const bron = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  for (const expr of ['30 16 * * 2', '30 7 * * 1-5', '0 10 * * 2,4', '0 14 * * 2,4']) {
    h.ok(!bron.includes(`planCron('${expr}'`) && !(expr in h.index.CRON_LABELS), `cron '${expr}' bestaat niet meer`);
  }
  const labels = h.index.geplandeCronMeta.map((m) => m.label);
  h.ok(!['Kroketfeitje', 'Spontane post', 'Casinoroddel'].some((l) => labels.includes(l)), 'het dashboard toont de labels niet');
});
