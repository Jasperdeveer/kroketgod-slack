// Rooktest: de casino-effecten van de regisseur. Run: `node scripts/rooktest/regie-casino.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const MIN = 60_000;
const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { UITVOERDERS, voerIngreepUit, casinoToegangReden, casinoMax, casinoPlafond, boekCasinoUitslag } = h.index;
  const staat = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null, ...h.lees('regie.json') });
  const effect = (soort, tot) => h.schrijf('regie.json', { ...staat(), effecten: [{ id: soort, soort, tot, data: {} }] });
  const score = (id) => h.lees('scores.json')[id] || 0;
  const nawerking = () => staat().log.filter((r) => r.laag === 'nawerking');
  const schoon = () => h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });

  // 1. Dicht: via de uitvoerder, 2 uur, daarna weer open.
  const nu = Date.now();
  await voerIngreepUit(h.client, { ingreep: boek('casino_dicht'), doel: null, punten: 0, duurMinuten: 120, reden: 'test' }, {}, nu);
  const e = staat().effecten.find((x) => x.soort === 'dicht');
  h.ok(e && Math.abs(e.tot - (nu + 120 * MIN)) < 5000, `casino_dicht zet het effect 'dicht' voor 120 minuten (${e && (e.tot - nu) / MIN})`);
  const reden = casinoToegangReden('UA');
  h.ok(/dicht tot \d\d:\d\d/.test(reden || ''), `casinoToegangReden zegt "dicht tot HH:MM": ${reden}`);
  const uur = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(e.tot);
  h.ok(reden.includes(uur), `de tijd is Amsterdamse tijd (${uur})`);
  const antwoord = await h.commando('UA', 'casino');
  h.ok(/dicht tot \d\d:\d\d/.test(antwoord), `/kroketgod casino weigert: ${antwoord.trim()}`);
  h.ok(h.posts.length === 1, 'de aankondiging staat in het kanaal');
  // Herstart midden in dicht: het effect staat in regie.json en wordt live gelezen, dus dezelfde tijd.
  h.ok(staat().effecten.find((x) => x.soort === 'dicht').tot === e.tot && casinoToegangReden('UA') === reden, 'dicht blijft tot dezelfde tijd (live uit regie.json)');
  effect('dicht', Date.now() - 1000);
  h.ok(casinoToegangReden('UA') === null, 'na tot werkt het casino weer');

  // 2. Hoge tafel: de maximale inzet is x2.
  schoon();
  const normaal = casinoMax();
  await UITVOERDERS.hoge_tafel(h.client, { duurMinuten: 60 }, {});
  h.ok(casinoMax() === 2 * normaal, `hoge tafel: casinoMax ${normaal} -> ${casinoMax()}`);
  h.ok(staat().effecten.some((x) => x.soort === 'hogeTafel'), "effect 'hogeTafel' staat in regie.json");
  effect('hogeTafel', Date.now() - 1000);
  h.ok(casinoMax() === normaal, 'na tot weer de gewone inzet');

  // 3. Gouden uur: winst + min(5, ceil(netto/2)), uit de Schatkist eerst, geboekt als nawerking.
  schoon();
  await UITVOERDERS.gouden_uur(h.client, { duurMinuten: 60 }, {});
  let voor = score('UA');
  boekCasinoUitslag('UA', 'dobbelen', 4, 8, 'test'); // netto 4 -> +2
  h.ok(score('UA') - voor === 10, `gouden uur: winst van 4 betaalt +2 extra (${score('UA') - voor})`);
  voor = score('UA');
  boekCasinoUitslag('UA', 'dobbelen', 10, 40, 'test'); // netto 30 -> +5
  h.ok(score('UA') - voor === 45, `gouden uur: extra is hoogstens 5 (${score('UA') - voor - 40})`);
  h.ok(nawerking().map((r) => r.punten).join() === '2,5', `nawerking geboekt (${nawerking().map((r) => r.punten)})`);
  h.schrijf('regie.json', { ...staat(), schatkist: 3 });
  boekCasinoUitslag('UA', 'dobbelen', 10, 40, 'test');
  h.ok(staat().schatkist === 0, `de Schatkist betaalt eerst (${staat().schatkist})`);
  voor = score('UA');
  boekCasinoUitslag('UA', 'dobbelen', 4, 0, 'test'); // verlies: geen extra
  h.ok(score('UA') === voor, 'gouden uur: een verlies krijgt niets');
  schoon(); // zonder ruimte: normale uitslag
  h.schrijf('regie.json', { ...staat(), log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: 15, soort: 'geven' }], effecten: [{ id: 'g', soort: 'goudenUur', tot: Date.now() + 60 * MIN }] });
  voor = score('UA');
  boekCasinoUitslag('UA', 'dobbelen', 4, 8, 'test');
  h.ok(score('UA') - voor === 8, `zonder ruimte staat de normale uitslag (${score('UA') - voor})`);

  // 4. Omgekeerd uur: winst en verlies wisselen, hoogstens 5 per spel.
  schoon(); effect('omgekeerdUur', Date.now() + 60 * MIN);
  voor = score('UB');
  const w = boekCasinoUitslag('UB', 'dobbelen', 10, 12, 'test'); // normaal +2 -> -2 (verschil -4, past binnen 5 per lid)
  h.ok(score('UB') - voor === 8 && w.netto === -2, `omgekeerd: winst van 2 wordt verlies van 2 (uitbetaald ${score('UB') - voor}, netto ${w.netto})`);
  voor = score('UC');
  boekCasinoUitslag('UC', 'dobbelen', 10, 40, 'test'); // normaal +30 -> -5, verschil -35, begrensd op nemenPerLid 5
  h.ok(score('UC') - voor === 35, `omgekeerd: nemen is begrensd op 5 per lid per dag (${score('UC') - voor})`);
  voor = score('UC');
  boekCasinoUitslag('UC', 'dobbelen', 10, 40, 'test');
  h.ok(score('UC') - voor === 40, 'omgekeerd: zonder ruimte voor dit lid staat de normale uitslag');
  voor = score('UB');
  const v = boekCasinoUitslag('UB', 'dobbelen', 3, 0, 'test'); // normaal -3 -> +3
  h.ok(v.netto === 3 && score('UB') - voor === 6, `omgekeerd: verlies van 3 wordt winst van 3 (${score('UB') - voor})`);
  voor = score('UB');
  boekCasinoUitslag('UB', 'dobbelen', 3, 3, 'test');
  h.ok(score('UB') === voor + 3, 'omgekeerd: gelijkspel blijft gelijk');
  h.ok(nawerking().length >= 3 && nawerking().some((r) => r.punten < 0) && nawerking().some((r) => r.punten > 0), 'nawerking geboekt in beide richtingen');
});
