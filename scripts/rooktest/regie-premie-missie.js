// Rooktest: de premie en de stille missie als regisseursingreep (spoor 3, B2).
// Run: `node scripts/rooktest/regie-premie-missie.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { regieTik, bouwRegieStand, voerDuel, vollooiMissie, kiesOpdrachten, getMondayOfWeek, startStilleMissie } = h.index;
  const maandag = getMondayOfWeek();
  const nu = Date.parse(`${maandag}T12:00:00Z`); // maandag 13:00 Amsterdam, deze week
  const leeg = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const schoon = (extra = {}) => { h.schrijf('regie.json', { ...leeg(), ...extra }); h.posts.length = 0; h.ephemeral.length = 0; };
  const score = (id) => h.lees('scores.json')[id] || 0;
  const zetScores = (o) => { h.schrijf('duels.json', {}); h.schrijf('scores.json', { ...h.lees('scores.json'), ...o }); };
  const duel = async (random, wie, tegen) => {
    const orig = Math.random; Math.random = () => random;
    try { await voerDuel(h.client, wie, tegen, 'CKANAAL'); } finally { Math.random = orig; }
  };
  h.schrijf('instellingen.json', { weekendRust: false, stilModus: false });

  // 1. Premie op de ontsnapte: UA staat bovenaan, UC is ontsnapt.
  schoon({ effecten: [{ id: 'ontsnapt_UC', soort: 'ontsnapt', tot: Date.now() + 3_600_000, data: { doel: 'UC' } }] });
  zetScores({ UA: 40, UB: 10, UC: 10, UD: 10, UE: 10, UF: 10 });
  h.schrijf('premie.json', {});
  h.ok(bouwRegieStand(nu).leden.find((l) => l.id === 'UC').ontsnapt === true, 'stand: UC is ontsnapt');
  const k = await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['premie'] });
  const p = h.lees('premie.json');
  h.ok(k?.ingreep.id === 'premie' && p.doelwitId === 'UC' && p.door === 'regisseur' && p.weekStart === maandag && p.bonus === 3 && p.geind === false,
    `premie op de ontsnapte: ${JSON.stringify(p)}`);
  h.ok(bouwRegieStand(nu).premieDezeWeek === true, 'stand: premieDezeWeek');

  // 2. Premie geïnd: Schatkist 2, UA wint van UC.
  schoon({ schatkist: 2 });
  zetScores({ UA: 40, UC: 10 });
  const uaVoor = score('UA');
  await duel(0, 'UA', 'UC');
  const winst = score('UA') - uaVoor; // de gewone duelwinst plus de premie
  h.ok(winst >= 4, `UA krijgt de inzet plus 3 (${winst})`);
  h.ok(staat().schatkist === 0 && staat().log.some((r) => r.laag === 'nawerking' && r.id === 'premie' && r.punten === 3), 'Schatkist op 0, nawerking premie +3');
  h.ok(h.lees('premie.json').geind === true, 'premie is geind');

  // 3. Boven het plafond: al +15 vandaag.
  h.schrijf('premie.json', { doelwitId: 'UC', bonus: 3, weekStart: maandag, geind: false, door: 'regisseur' });
  schoon({ log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }] });
  zetScores({ UA: 40, UC: 10 });
  const ua2 = score('UA');
  await duel(0, 'UA', 'UC');
  h.ok(score('UA') - ua2 === winst - 3, `boven het plafond: geen premiepunten (${score('UA') - ua2})`);
  h.ok(h.lees('premie.json').geind === true, 'boven het plafond: toch geind');
  h.ok(h.posts.some((x) => /Schatkist/.test(x.text) && /leeg/.test(x.text)), 'duelbericht noemt de lege Schatkist');

  // 4. Cron weg.
  const bron = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  h.ok(!bron.includes("planCron('0 11 * * 3'") && !('0 11 * * 3' in h.index.CRON_LABELS), "cron '0 11 * * 3' bestaat niet meer");
  h.ok(!h.index.geplandeCronMeta.some((m) => m.label === 'Premiejacht (kans)'), 'dashboard toont de premiejacht niet');

  // 5. Stille missie zonder beheerder.
  schoon(); h.schrijf('missie.json', null);
  const k2 = await regieTik(h.client, { forceer: true, rng: () => 0, nu, beschikbaar: ['stille_missie'] });
  const m = h.lees('missie.json');
  h.ok(k2?.ingreep.id === 'stille_missie' && m?.status === 'actief' && m.door === 'regisseur', `missie actief door regisseur: ${JSON.stringify(m)?.slice(0, 120)}`);
  const kanaal = h.posts.filter((x) => !x.thread);
  h.ok(kanaal.length === 1 && !new RegExp(m.bijnaam).test(kanaal[0].text), `kanaalbericht noemt het doelwit niet: ${kanaal[0]?.text}`);
  h.ok(h.ephemeral.some((e) => e.user === m.userId), 'ephemeral naar het doelwit');
  h.ok(bouwRegieStand(nu).missieLoopt === true, 'stand: missieLoopt');
  // beheerderspad blijft werken
  h.schrijf('missie.json', null);
  await startStilleMissie(h.client, 'CKANAAL', 'UB', { door: 'beheerder' });
  h.ok(h.lees('missie.json').door === 'beheerder' && h.lees('missie.json').userId === 'UB', 'startStilleMissie voor de beheerder');

  // 6. Missie via het plafond.
  schoon(); zetScores({ UA: 10, UB: 10 });
  h.schrijf('missie.json', { userId: 'UA', bijnaam: 'Alfa', deelnemers: ['UA', 'UB'], beschrijving: 'x', status: 'actief', door: 'regisseur' });
  await vollooiMissie(h.client, 'CKANAAL', h.lees('missie.json'));
  const nw = staat().log.filter((r) => r.laag === 'nawerking' && r.id === 'stille_missie');
  h.ok(nw.length === 2 && nw.every((r) => r.punten === 3) && score('UA') === 13 && score('UB') === 13, `missie: +3 per deelnemer als nawerking (${nw.length})`);
  // Plafond: 4 ruimte over, dus 3 + 1.
  schoon({ log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 11, soort: 'geven' }] }); zetScores({ UA: 10, UB: 10 });
  h.schrijf('missie.json', { userId: 'UA', bijnaam: 'Alfa', deelnemers: ['UA', 'UB'], beschrijving: 'x', status: 'actief', door: 'regisseur' });
  await vollooiMissie(h.client, 'CKANAAL', h.lees('missie.json'));
  h.ok(score('UA') + score('UB') === 24, `missie begrensd op de ruimte (${score('UA')}+${score('UB')})`);

  // 7. Uitlokken.
  const acties = bouwRegieStand(nu).opdrachtActies;
  h.ok([...kiesOpdrachten('dag', h.index.dagSleutel(), 3), ...kiesOpdrachten('week', maandag, 2)].every((o) => acties.includes(o.actie)), `opdrachtActies bevat de dag- en weekacties (${acties})`);
});
