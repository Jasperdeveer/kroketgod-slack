// Rooktest: de grillen van de regisseur (duelverbod, inflatie, uitverkoop, dubbele eer) en het omgekeerde uur in duels.
// Run: `node scripts/rooktest/regie-grillen.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const MIN = 60_000;
const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { UITVOERDERS, voerIngreepUit, voerDuel, voerEer, winkelPrijs, prijsToelichting } = h.index;
  const staat = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null, ...h.lees('regie.json') });
  const schoon = () => h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
  const effect = (soort, tot = Date.now() + 60 * MIN) => h.schrijf('regie.json', { ...staat(), effecten: [...staat().effecten, { id: soort, soort, tot, data: {} }] });
  const leesOpt = (f) => { try { return h.lees(f); } catch { return {}; } };
  const score = (id) => h.lees('scores.json')[id] || 0;
  const zetScores = () => { h.schrijf('duels.json', {}); h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 10, UB: 10 }); };
  const duelMet = async (random, wie = ['UA', 'UB']) => {
    const orig = Math.random; Math.random = () => random;
    try { return await voerDuel(h.client, wie[0], wie[1], 'CKANAAL'); } finally { Math.random = orig; }
  };

  // 1. Uitvoerders zetten het juiste effect met de juiste duur.
  const nu = Date.now();
  for (const [id, soort, min] of [['duelverbod', 'duelverbod', 120], ['inflatie', 'inflatie', 60], ['uitverkoop', 'uitverkoop', 60], ['dubbele_eer', 'dubbeleEer', 60]]) {
    schoon();
    await voerIngreepUit(h.client, { ingreep: boek(id), doel: null, punten: 0, duurMinuten: min, reden: 'test' }, {}, nu);
    const e = staat().effecten.find((x) => x.soort === soort);
    h.ok(e && Math.abs(e.tot - (nu + min * MIN)) < 5000, `${id} zet effect '${soort}' voor ${min} minuten`);
  }

  // 2. Duelverbod: geweigerd met de tijd, en er is niets geschreven.
  schoon(); zetScores();
  const tot = Date.now() + 90 * MIN;
  effect('duelverbod', tot);
  const duelsVoor = JSON.stringify(leesOpt('duels.json'));
  const uur = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(tot);
  const geweigerd = await duelMet(0.99);
  h.ok(geweigerd.ok === false && geweigerd.tekst.includes(uur) && /Kroket God/.test(geweigerd.tekst), `duelverbod weigert met tijd ${uur}: ${geweigerd.tekst}`);
  h.ok(JSON.stringify(leesOpt('duels.json')) === duelsVoor && score('UA') === 10 && score('UB') === 10, 'duelverbod schrijft niets (duels.json en scores ongewijzigd)');
  schoon();
  const toegestaan = await duelMet(0.99);
  h.ok(toegestaan.ok === true, 'zonder verbod gaat het duel gewoon door');

  // 3. Prijzen.
  schoon();
  const basis = winkelPrijs('UA', { prijs: 2 });
  h.ok(basis === 2, `basisprijs van een item van 2 is ${basis}`);
  effect('inflatie');
  h.ok(winkelPrijs('UA', { prijs: 2 }) === 4, `inflatie: item van 2 kost ${winkelPrijs('UA', { prijs: 2 })}`);
  const toel = prijsToelichting('UA', 2, 4);
  h.ok(/opslag/.test(toel) && /inflatie/.test(toel) && !/rangkorting|~/.test(toel), `toelichting toont opslag: ${toel}`);
  h.ok(/opslag/.test(await h.commando('UA', 'winkel')), 'het winkelcommando toont inflatie als opslag');
  schoon(); effect('uitverkoop');
  h.ok(winkelPrijs('UA', { prijs: 1 }) === 1, 'uitverkoop: item van 1 kost nog steeds 1');
  h.ok(winkelPrijs('UA', { prijs: 3 }) === 2, 'uitverkoop: item van 3 kost 2');
  h.ok(/uitverkoop/.test(prijsToelichting('UA', 3, 2)), `toelichting noemt uitverkoop: ${prijsToelichting('UA', 3, 2)}`);
  schoon();

  // 4. Dubbele eer: één klasse hoger.
  const eer = (giver, ontv, reden) => voerEer(h.client, giver, [ontv], reden, 'CKANAAL');
  const r0 = await eer('UC', 'UD', 'hielp mij vandaag met het opruimen van de frituurkamer');
  effect('dubbeleEer');
  const r1 = await eer('UE', 'UF', 'hielp mij vandaag met het opruimen van de frituurkeuken');
  const ladder = ['zwak', 'degelijk', 'sterk', 'legendarisch'];
  h.ok(r0.ok && r1.ok && ladder.indexOf(r1.klasse) === Math.min(ladder.indexOf(r0.klasse) + 1, 3), `dubbele eer: klasse ${r0.klasse} -> ${r1.klasse}`);
  schoon();

  // 5. Omgekeerd uur in een duel: random 0.99 = de doelwit (UB) wint normaal; omgekeerd wint de uitdager (UA).
  zetScores(); effect('omgekeerdUur');
  const d = await duelMet(0.99);
  const winst = score('UA') - 10, verlies = 10 - score('UB');
  h.ok(d.ok && winst > 0 && winst <= 5 && verlies === winst, `omgekeerd: de normale verliezer wint ${winst}, de normale winnaar verliest ${verlies}`);
  const rijen = staat().log.filter((r) => r.laag === 'nawerking' && r.id === 'omgekeerd_uur');
  h.ok(rijen.length === 2 && rijen.some((r) => r.doel === 'UA' && r.punten === winst) && rijen.some((r) => r.doel === 'UB' && r.punten === -winst), 'beide kanten staan als nawerking in het log');
  h.ok(staat().schatkist === 0, 'de Schatkist doet niet mee');
  // Gegarandeerde winst gaat voor: UB heeft het Voorrecht en wint echt.
  zetScores(); schoon(); effect('omgekeerdUur');
  h.schrijf('fortuin.json', { UB: { gezet: Date.now(), resterend: 1 } });
  await duelMet(0.01);
  h.ok(score('UB') > 10 && score('UA') < 10, 'pakFortuin wordt niet omgekeerd');
  h.ok(staat().log.filter((r) => r.laag === 'nawerking').length === 0, 'en boekt dan geen nawerking');
  // Geen ruimte: de gewone uitslag.
  zetScores(); schoon(); effect('omgekeerdUur');
  h.schrijf('fortuin.json', {});
  h.schrijf('regie.json', { ...staat(), log: [{ ts: Date.now(), id: 'x', laag: 'nawerking', doel: 'UB', punten: -5, soort: 'nemen' }] });
  await duelMet(0.99);
  h.ok(score('UB') > 10 && score('UA') < 10, 'zonder ruimte (nemenVan UB is op) staat de gewone uitslag');
  // Zonder effect gewoon normaal.
  zetScores(); schoon();
  await duelMet(0.99);
  h.ok(score('UB') > 10 && score('UA') < 10, 'zonder omgekeerd uur wint de normale winnaar');
});
