// Rooktest: zegendag, verbondsdag en seizoensdag als regisseursingreep, en de Verbondszegen alleen in de draad (spoor 3, B5).
// Run: `node scripts/rooktest/regie-dagen.js`.
'use strict';
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { regieTik, bouwRegieStand, getMondayOfWeek, kenAlliantiePuntenBonus, draagBijAanSeizoen, opdrachtHaalbaar, alleOpdrachten, opdrachtTekst } = h.index;
  const nu = Date.parse(`${getMondayOfWeek()}T12:00:00Z`);
  const leeg = () => ({ schatkist: 20, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const effect = (soort) => staat().effecten.find((e) => e.soort === soort);
  const dagEffect = (soort, data) => ({ id: soort, soort, tot: Date.now() + 3_600_000, data });
  const schoon = (extra = {}) => { h.schrijf('regie.json', { ...leeg(), ...extra }); h.posts.length = 0; h.ephemeral.length = 0; };
  const score = (id) => h.lees('scores.json')[id] || 0;
  const teller = (id, actie) => (h.lees('tellers.json')[id] || {})[actie] || 0;
  const seizoen = (hp) => h.schrijf('seizoen.json', { ...h.lees('seizoen.json'), status: 'actief', hp });
  h.schrijf('instellingen.json', { weekendRust: false, stilModus: false });
  h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 20, UB: 20, UC: 20, UD: 20 });
  h.schrijf('tellers.json', {});
  h.schrijf('profeet.json', {});
  h.schrijf('verbanning.json', {});
  h.schrijf('allianties.json', {});

  // 1. Zegendag: een niet-profeet zegent één keer.
  schoon({ effecten: [dagEffect('zegendag', { gezegend: [] })] });
  const ub = score('UB');
  await h.commando('UA', 'zegen Bravo');
  h.ok(score('UB') === ub + 1, `UB krijgt +1 (${score('UB') - ub})`);
  h.ok(staat().log.some((r) => r.laag === 'nawerking' && r.id === 'zegendag' && r.doel === 'UB' && r.punten === 1), 'nawerking zegendag +1');
  h.ok(teller('UB', 'gezegend') === 1, 'tellers: UB gezegend 1');
  h.ok(effect('zegendag').data.gezegend.includes('UA'), 'UA staat in gezegend');
  h.ok(h.posts.some((p) => /Bravo/.test(p.text) && /zegen/i.test(p.text)), 'templated regel in het kanaal');
  const uc = score('UC');
  const tweede = await h.commando('UA', 'zegen Charlie');
  h.ok(score('UC') === uc && /zegendag/i.test(tweede), `tweede zegen geweigerd en noemt de zegendag: ${tweede.trim()}`);
  const zelf = await h.commando('UC', 'zegen Charlie');
  h.ok(score('UC') === uc && !effect('zegendag').data.gezegend.includes('UC'), `zelf zegenen geweigerd: ${zelf.trim()}`);
  h.schrijf('verbanning.json', { UD: { tot: new Date(Date.now() + 3_600_000).toISOString() } });
  const ud = score('UD');
  await h.commando('UC', 'zegen Delta');
  h.ok(score('UD') === ud && !effect('zegendag').data.gezegend.includes('UC'), 'een balling zegenen mag niet');
  h.schrijf('verbanning.json', {});

  // De profeet met een ongebruikte weekzegen zegent zoals nu, naast de zegendag.
  h.schrijf('profeet.json', { userId: 'UE', weekStart: getMondayOfWeek(), zegenGebruikt: false });
  const uf = score('UC');
  await h.commando('UE', 'zegen Charlie');
  h.ok(h.lees('profeet.json').zegenGebruikt === true && score('UC') === uf + 1, 'profeet zegent nog zoals nu');
  h.ok(!effect('zegendag').data.gezegend.includes('UE'), 'de profeetszegen telt niet als zegendag-zegen');
  h.schrijf('profeet.json', {});

  // Zonder profeet en zonder zegendag noemt de weigering de zegendag.
  schoon();
  const geen = await h.commando('UA', 'zegen Bravo');
  h.ok(/zegendag/i.test(geen), `weigertekst noemt de zegendag: ${geen.trim()}`);

  // 2. Zegendag op het plafond: al +15 vandaag.
  schoon({ log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }], effecten: [dagEffect('zegendag', { gezegend: [] })] });
  const ub2 = score('UB');
  const vol = await h.commando('UA', 'zegen Bravo');
  h.ok(score('UB') === ub2, 'op het plafond: geen punt');
  h.ok(/Schatkist|leeg/i.test(vol) || h.ephemeral.length > 0, `op het plafond: wel een melding: ${vol.trim()}`);
  h.ok(!effect('zegendag').data.gezegend.includes('UA'), 'op het plafond: UA staat niet in gezegend');

  // 3. Verbondsdag: een nieuw paar komt in gesloten.
  schoon({ effecten: [dagEffect('verbondsdag', { gesloten: [] })] });
  h.schrijf('allianties.json', {});
  await h.commando('UA', 'alliantie Charlie');
  const gesloten = effect('verbondsdag').data.gesloten;
  h.ok(gesloten.includes('UA') && gesloten.includes('UC'), `UA en UC in gesloten (${gesloten})`);
  const orig = Math.random;
  Math.random = () => 0;
  try {
    // Zonder naspel: bonus 2 (random 0), geen losse post, en dezelfde extra via de verbondsdag.
    h.posts.length = 0;
    const voor = score('UC');
    await kenAlliantiePuntenBonus(h.client, 'UA', { channelId: 'CKANAAL' });
    h.ok(score('UC') === voor + 4, `UC krijgt de bonus en dezelfde extra (${score('UC') - voor})`);
    h.ok(staat().log.some((r) => r.laag === 'nawerking' && r.id === 'verbondsdag' && r.doel === 'UC' && r.punten === 2), 'nawerking verbondsdag +2');
    h.ok(h.posts.length === 0, `zonder naspel geen nieuwe post (${h.posts.length})`);
    // Met naspel: één regel, met "×2".
    const naspel = { regels: [], actorId: 'UA', betrokken: new Set(), zegenGehad: new Set() };
    await kenAlliantiePuntenBonus(h.client, 'UA', { channelId: 'CKANAAL', naspel });
    h.ok(naspel.regels.length === 1 && /×2/.test(naspel.regels[0]) && h.posts.length === 0, `met naspel één regel met ×2: ${naspel.regels}`);
  } finally { Math.random = orig; }
  // Zonder verbondsdag geen extra.
  schoon();
  Math.random = () => 0;
  try {
    const voor = score('UC');
    await kenAlliantiePuntenBonus(h.client, 'UA', { channelId: 'CKANAAL' });
    h.ok(score('UC') === voor + 2 && !staat().log.some((r) => r.id === 'verbondsdag'), 'zonder verbondsdag geen extra');
  } finally { Math.random = orig; }

  // 4. Seizoensdag: dubbel voor één actie.
  schoon({ effecten: [dagEffect('seizoensdag', { actie: 'offer', naam: 'Vetdag' })] });
  seizoen(304);
  draagBijAanSeizoen('UA', 'offer');
  h.ok(h.lees('seizoen.json').hp === 302, `offer telt dubbel (${h.lees('seizoen.json').hp})`);
  draagBijAanSeizoen('UA', 'duel');
  h.ok(h.lees('seizoen.json').hp === 301, `duel telt enkel (${h.lees('seizoen.json').hp})`);
  schoon();
  seizoen(304);
  draagBijAanSeizoen('UA', 'offer');
  h.ok(h.lees('seizoen.json').hp === 303, 'zonder seizoensdag telt offer enkel');

  // De tik: stand, uitvoerders.
  h.schrijf('allianties.json', {});
  schoon();
  seizoen(304);
  const stand = bouwRegieStand(nu);
  h.ok(stand.seizoen?.actief === true && stand.seizoen.dreiging === 'verkilling', `stand: seizoen ${JSON.stringify(stand.seizoen)}`);
  h.ok(stand.verbondenAan === true && stand.leden.every((l) => l.inVerbond === false), 'stand: verbondenAan, niemand in een verbond');
  const k = await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['seizoensdag'] });
  h.ok(k?.ingreep.id === 'seizoensdag' && effect('seizoensdag')?.data.actie === 'offer' && effect('seizoensdag').data.naam === 'Vetdag', `tik kiest seizoensdag: ${JSON.stringify(effect('seizoensdag'))}`);
  schoon();
  h.schrijf('seizoen.json', { ...h.lees('seizoen.json'), status: 'geveld' });
  h.ok(bouwRegieStand(nu).seizoen.actief === false, 'stand: geen actief seizoen');
  h.ok(!(await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['seizoensdag'] })), 'zonder actief seizoen kiest de tik seizoensdag niet');
  seizoen(304);
  schoon();
  const z = await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['zegendag'] });
  h.ok(z?.ingreep.id === 'zegendag' && Array.isArray(effect('zegendag')?.data.gezegend) && effect('zegendag').tot > nu, 'tik zet een zegendag met gezegend []');
  schoon();
  const v = await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['verbondsdag'] });
  h.ok(v?.ingreep.id === 'verbondsdag' && Array.isArray(effect('verbondsdag')?.data.gesloten), 'tik zet een verbondsdag met gesloten []');
  h.schrijf('allianties.json', {});
  await h.commando('UA', 'alliantie Charlie');
  h.ok(bouwRegieStand(nu).leden.find((l) => l.id === 'UA').inVerbond === true, 'stand: UA zit in een verbond');

  // 5. De dagopdracht "zegenen" en zijn tekst.
  const dZegen = alleOpdrachten().find((o) => o.id === 'd-zegen');
  h.ok(/profeet of op een zegendag/.test(opdrachtTekst(dZegen)), `tekst noemt de zegendag: ${opdrachtTekst(dZegen)}`);
  schoon({ effecten: [dagEffect('zegendag', { gezegend: [] })] });
  h.ok(opdrachtHaalbaar('UB', dZegen) === true, 'gezegend is haalbaar op een zegendag');
});
