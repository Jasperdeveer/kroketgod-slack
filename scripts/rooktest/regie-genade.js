// Rooktest: genade bij berouw, de vrijgevige bui en de bedeluitkomst (spoor 3, B6).
// Run: `node scripts/rooktest/regie-genade.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { regieTik, getMondayOfWeek, bedelUitkomst, BINGO_POOL } = h.index;
  const nu = Date.parse(`${getMondayOfWeek()}T12:00:00Z`);
  const uur = (n) => new Date(nu + n * 3_600_000).toISOString();
  const leeg = () => ({ schatkist: 20, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const schoon = (extra = {}) => { h.schrijf('regie.json', { ...leeg(), ...extra }); h.posts.length = 0; };
  const score = (id) => h.lees('scores.json')[id] || 0;
  const tik = () => regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['genade'] });
  h.schrijf('instellingen.json', { weekendRust: false, stilModus: false });
  h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 20, UB: 20, UC: 20 });
  h.schrijf('allianties.json', {});
  h.schrijf('profeet.json', {});

  // Genade: twee uur verbannen met beroep.
  schoon();
  h.schrijf('verbanning.json', { UB: { tot: uur(2), beroepGeprobeerd: true } });
  const k = await tik();
  h.ok(k?.ingreep.id === 'genade' && k.doel === 'UB', 'genade kiest UB');
  h.ok(!h.lees('verbanning.json').UB, 'UB is vrij');

  // Verbond: UC komt mee vrij.
  schoon();
  h.schrijf('allianties.json', { UB: ['UC'], UC: ['UB'] });
  h.schrijf('verbanning.json', { UB: { tot: uur(2), beroepGeprobeerd: true }, UC: { tot: new Date(Date.now() + 7_200_000).toISOString() } }); // bevrijdAlliantiePartnerMee rekent met Date.now()
  await tik();
  const v = h.lees('verbanning.json');
  h.ok(!v.UB && !v.UC, `UC komt mee vrij: ${JSON.stringify(Object.keys(v))}`);
  h.schrijf('allianties.json', {});

  // Geen genade.
  for (const [naam, rec] of [
    ['rode kaart', { tot: uur(2), beroepGeprobeerd: true, kaart: 'rood' }],
    ['zonder beroep', { tot: uur(2) }],
    ['nog 20 minuten', { tot: new Date(nu + 20 * 60_000).toISOString(), beroepGeprobeerd: true }],
    ['ban verlengd door de eigenaar (M4)', { tot: uur(2), beroepGeprobeerd: true, beheerder: true }],
  ]) {
    schoon();
    h.schrijf('verbanning.json', { UB: rec });
    h.ok(!(await tik()) && !!h.lees('verbanning.json').UB, `geen genade: ${naam}`);
  }
  // M4: een bondgenoot met een lopende rode kaart komt niet via genade vrij.
  schoon();
  h.schrijf('allianties.json', { UB: ['UC'], UC: ['UB'] });
  h.schrijf('verbanning.json', { UB: { tot: uur(2), beroepGeprobeerd: true }, UC: { tot: new Date(Date.now() + 7_200_000).toISOString(), kaart: 'rood' } });
  h.ok(!(await tik()) && !!h.lees('verbanning.json').UB && !!h.lees('verbanning.json').UC, 'geen genade: de bondgenoot heeft een rode kaart');
  h.schrijf('allianties.json', {});
  h.schrijf('verbanning.json', {});

  // Vrijgevige bui.
  const bui = (begiftigd = []) => ({ id: 'vrijgevig', soort: 'vrijgevig', tot: Date.now() + 3_600_000, data: { begiftigd } });
  schoon({ effecten: [bui()] });
  const ua = score('UA');
  const r1 = await bedelUitkomst('UA', Date.now());
  h.ok(r1.soort === 'gift' && r1.punten === 1 && score('UA') === ua + 1, `gift +1: ${JSON.stringify(r1)}`);
  const orig = Math.random; Math.random = () => 0;
  const r2 = await bedelUitkomst('UA', Date.now());
  h.ok(r2.soort === 'niets' && score('UA') === ua + 1, 'tweede keer: niets, ook met random 0');
  // Zonder bui: straf; met Zegen nooit.
  schoon();
  const r3 = await bedelUitkomst('UA', Date.now());
  h.ok(r3.soort === 'straf' && r3.punten === -1 && score('UA') === ua, `zonder bui straf: ${JSON.stringify(r3)}`);
  h.schrijf('powerups.json', { UA: [{ item: 'zegen', tot: Date.now() + 3_600_000 }] });
  const r4 = await bedelUitkomst('UA', Date.now());
  Math.random = orig;
  h.ok(r4.soort !== 'straf', `Zegen-houder krijgt nooit straf: ${JSON.stringify(r4)}`);
  // Plafond.
  schoon({ log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }], effecten: [bui()] });
  const r5 = await bedelUitkomst('UA', Date.now());
  h.ok(r5.soort === 'niets' && !staat().effecten.find((e) => e.soort === 'vrijgevig').data.begiftigd.includes('UA'), 'plafond: niets, niet in begiftigd');
  h.ok(BINGO_POOL[BINGO_POOL.length - 1] === 'Bedel om een kroketpunt tijdens een vrijgevige bui', 'bingovak achteraan');
});
