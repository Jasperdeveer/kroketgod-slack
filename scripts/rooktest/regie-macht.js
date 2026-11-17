// Rooktest: de macht van de regisseur (belasting, beslag, schorsing, overrule). Run: `node scripts/rooktest/regie-macht.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { voerIngreepUit, bouwRegieStand, sluitGeleKaartPoll } = h.index;
  const staat = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null, ...h.lees('regie.json') });
  const schoon = () => h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
  const score = (id) => h.lees('scores.json')[id] || 0;
  const scores = (s) => h.schrijf('scores.json', { UA: 0, UB: 0, UC: 0, UD: 0, UE: 0, UF: 0, ...s });
  const bannen = () => { try { return h.lees('verbanning.json'); } catch { return {}; } };
  const kaarten = () => { try { return h.lees('gelekaarten.json'); } catch { return {}; } };
  const powerups = (p) => h.schrijf('powerups.json', p);
  const heeft = (id, item) => (h.lees('powerups.json')[id] || []).some((p) => p.item === item);
  const ver = (item) => ({ item, tot: Date.now() + 3_600_000 });
  const regel = (ingreep, doel, punten) => ({ ingreep: boek(ingreep), doel, punten, duurMinuten: ingreep === 'schorsing' ? 60 : 0, reden: 'test' });
  const laatste = () => h.posts[h.posts.length - 1]?.text || '';

  // 1. Belasting: koploper 40, nummer twee 20 -> de kiezer vraagt 4, de uitvoerder neemt 4, de Schatkist krijgt 4.
  scores({ UA: 40, UB: 20 }); schoon(); powerups({});
  const nu = Date.now();
  const k = regie.kiesIngreep(bouwRegieStand(nu), staat(), { nu, rng: () => 0, forceer: true, beschikbaar: ['belasting'], niveau: 'wild' });
  h.ok(k?.ingreep.id === 'belasting' && k.doel === 'UA' && k.punten === -4, `de kiezer vraagt 4 van de koploper (${k?.doel} ${k?.punten})`);
  await voerIngreepUit(h.client, k, bouwRegieStand(nu), nu);
  h.ok(score('UA') === 36 && staat().schatkist === 4, `belasting: UA ${score('UA')}, Schatkist ${staat().schatkist}`);
  h.ok(staat().log.at(-1).punten === -4 && /Reden/.test(laatste()), `geboekt als -4 en de reden staat erbij: ${laatste()}`);

  // 2. Zegen: niets afgenomen, Zegen blijft, het bericht spot (geen "Reden:") en 0 punten geboekt.
  scores({ UA: 40, UB: 20 }); schoon(); powerups({ UA: [ver('zegen')] });
  h.posts.length = 0;
  await voerIngreepUit(h.client, regel('belasting', 'UA', -4), {}, nu);
  h.ok(score('UA') === 40 && staat().schatkist === 0 && heeft('UA', 'zegen'), 'Zegen: niets genomen, Schatkist leeg, Zegen blijft');
  h.ok(!/Reden/.test(laatste()) && /Zegen|ketst/i.test(laatste()), `het bericht spot: ${laatste()}`);
  h.ok(staat().log.at(-1).punten === 0, 'afgekapte straf boekt 0 punten');
  await voerIngreepUit(h.client, regel('beslag', 'UA', -3), {}, nu + 25 * 3_600_000);
  h.ok(score('UA') === 40 && heeft('UA', 'zegen'), 'Zegen vangt ook beslag op');

  // 3. Beslag zonder Zegen: 3 naar de Schatkist.
  scores({ UA: 40 }); schoon(); powerups({});
  await voerIngreepUit(h.client, regel('beslag', 'UA', -3), {}, nu);
  h.ok(score('UA') === 37 && staat().schatkist === 3, `beslag: UA ${score('UA')}, Schatkist ${staat().schatkist}`);

  // 4. Plafonds: er is vandaag al 8 genomen (van UC); belasting 4 wordt 2, samen 10.
  scores({ UA: 40, UC: 20 }); powerups({});
  h.schrijf('regie.json', { schatkist: 0, effecten: [], verrassing: null, log: [{ ts: nu, id: 'beslag', laag: 'ingreep', doel: 'UC', punten: -8, soort: 'nemen' }] });
  await voerIngreepUit(h.client, regel('belasting', 'UA', -4), {}, nu);
  const genomen = staat().log.reduce((a, r) => a + Math.max(-r.punten, 0), 0);
  h.ok(score('UA') === 38 && genomen === 10 && staat().schatkist === 2, `plafond: UA ${score('UA')}, samen ${genomen} genomen, Schatkist ${staat().schatkist}`);
  await voerIngreepUit(h.client, regel('beslag', 'UB', -3), {}, nu);
  h.ok(staat().log.reduce((a, r) => a + Math.max(-r.punten, 0), 0) <= 10, 'nooit meer dan 10 per dag');

  // 5. Schorsing: een uur balling, zonder kaart.
  scores({}); schoon(); powerups({}); h.schrijf('verbanning.json', {});
  await voerIngreepUit(h.client, regel('schorsing', 'UB', 0), {}, nu);
  const b = bannen().UB;
  const uur = b && Date.parse(b.tot) - Date.parse(b.opgelegd);
  h.ok(b && uur === 3_600_000 && b.citaat === null && b.dagen === null && !b.kaart, `schorsing: een uur balling (${uur})`);
  h.ok(!kaarten().UB, 'geen kaart in gelekaarten.json');
  h.ok(Object.keys(bannen()).join() === 'UB', 'het verbond wordt niet meegesleept');
  h.ok(staat().log.at(-1).schorsing === true, 'de schorsing staat geboekt');

  // 6. Gouden Korst: geen ban, de korst is op, geen schorsing geboekt.
  schoon(); h.schrijf('verbanning.json', {}); powerups({ UB: [ver('gouden_korst')] });
  h.posts.length = 0;
  await voerIngreepUit(h.client, regel('schorsing', 'UB', 0), {}, nu);
  h.ok(!bannen().UB && !heeft('UB', 'gouden_korst'), 'Gouden Korst: geen ban en de korst is op');
  h.ok(!staat().log.at(-1).schorsing && !/Reden/.test(laatste()), `geen schorsing geboekt, geen reden-regel: ${laatste()}`);

  // 7. Overrule.
  const poll = (godStem, extra = {}) => h.schrijf('gelekaartpoll.json', { actief: true, doelwitId: 'UB', aanklagerId: 'UC', reden: 'te veel kroketten', hadAlKaart: false, godStem, bondgenootIds: [], gestart: nu, sluitTs: nu, kanaal: 'CKANAAL', berichtTs: '1', ...extra });
  const klaar = () => h.lees('gelekaartpoll.json');
  const aanklager = h.lees('members.json').UC.bijnaam;
  const schoonOverrule = () => { schoon(); h.schrijf('verbanning.json', {}); h.schrijf('gelekaarten.json', {}); powerups({}); h.posts.length = 0; };

  // 7a. kans 0,99: geen overrule, de Raad beslist (de God stemt onterecht: verworpen).
  schoonOverrule(); poll('onterecht');
  await sluitGeleKaartPoll(h.client, { rng: () => 0.99 });
  h.ok(klaar().uitkomst === 'onterecht' && !klaar().uitslag.regisseur && !bannen().UB, 'zonder worp: geen overrule');
  // 7b. kans 0: een verworpen kaart wordt toegekend.
  schoonOverrule(); poll('onterecht');
  await sluitGeleKaartPoll(h.client, { rng: () => 0 });
  h.ok(klaar().uitkomst === 'terecht' && klaar().uitslag.regisseur === true && bannen().UB, 'overrule: verworpen wordt toegekend, vastgelegd in de poll, UB geschorst');
  const rij = staat().log.at(-1);
  h.ok(rij.id === 'overrule' && rij.schorsing === true && rij.punten === 0 && rij.laag === 'nawerking' && rij.doel === 'UB', 'overrule geboekt als nawerking met schorsing');
  const alles = h.posts.map((p) => p.text).join('\n');
  h.ok(/overrul/i.test(alles) && !alles.includes(aanklager) && !alles.includes('UC'), 'de overrule is aangekondigd zonder de aanklager te noemen');
  // 7c. nog een keer in dezelfde week: niet.
  poll('onterecht'); h.schrijf('verbanning.json', {});
  await sluitGeleKaartPoll(h.client, { rng: () => 0 });
  h.ok(klaar().uitkomst === 'onterecht' && !klaar().uitslag.regisseur, 'hoogstens een overrule per week');
  // 7d. schorsing van vandaag is op: een verworpen kaart blijft verworpen, niets aangekondigd.
  schoonOverrule(); poll('onterecht');
  h.schrijf('regie.json', { schatkist: 0, effecten: [], verrassing: null, log: [{ ts: Date.now(), id: 'schorsing', laag: 'ingreep', doel: 'UE', punten: 0, soort: 'nemen', schorsing: true }] });
  await sluitGeleKaartPoll(h.client, { rng: () => 0 });
  h.ok(klaar().uitkomst === 'onterecht' && !klaar().uitslag.regisseur && !/overrul/i.test(h.posts.map((p) => p.text).join('\n')), 'zonder schorsingsruimte: geen overrule, geen aankondiging');
  // 7e. een toegekende kaart wordt geannuleerd; dat kost geen schorsingsruimte.
  schoonOverrule(); poll('terecht');
  h.schrijf('regie.json', { schatkist: 0, effecten: [], verrassing: null, log: [{ ts: Date.now(), id: 'schorsing', laag: 'ingreep', doel: 'UE', punten: 0, soort: 'nemen', schorsing: true }] });
  await sluitGeleKaartPoll(h.client, { rng: () => 0 });
  h.ok(klaar().uitkomst === 'onterecht' && klaar().uitslag.regisseur === true && !bannen().UB && !kaarten().UB, 'overrule: toegekend wordt geannuleerd, geen ban, geen kaart');
  const rij2 = staat().log.at(-1);
  h.ok(rij2.id === 'overrule' && !rij2.schorsing && rij2.punten === 0, 'annulering geboekt zonder schorsing');

  // M7: het vangnet noemt het echt afgenomen bedrag (beslag vroeg 3, UA heeft er 2).
  scores({ UA: 2, UB: 20 }); schoon(); powerups({}); h.posts.length = 0;
  await voerIngreepUit(h.client, regel('beslag', 'UA', -3), {}, nu);
  h.ok(score('UA') === 0 && /2 punten/.test(laatste()) && !/3 punten/.test(laatste()), `vangnet noemt het echte bedrag: ${laatste()}`);
  // M8: de uitdaging kiest een hekkensluiter die kan duelleren (UD..UF hebben 0 punten, UC is bondgenoot van de koploper).
  scores({ UA: 50, UB: 8, UC: 1, UD: 0, UE: 0, UF: 0 }); schoon(); powerups({});
  h.schrijf('allianties.json', { UA: ['UC'], UC: ['UA'] });
  const uitd = await voerIngreepUit(h.client, { ingreep: boek('koploper_uitdagen'), doel: null, punten: 0, duurMinuten: 120, reden: 'test' }, bouwRegieStand(nu), nu);
  const knop = staat().effecten.find((e) => e.soort === 'uitdaging');
  h.ok(knop?.data.hekkensluiter === 'UB', `hekkensluiter is UB, niet 0 punten of bondgenoot (${knop?.data.hekkensluiter})`);
  scores({ UA: 50, UB: 0, UC: 0, UD: 0, UE: 0, UF: 0 }); schoon(); h.posts.length = 0;
  await voerIngreepUit(h.client, { ingreep: boek('koploper_uitdagen'), doel: null, punten: 0, duurMinuten: 120, reden: 'test' }, bouwRegieStand(nu), nu);
  h.ok(!staat().effecten.some((e) => e.soort === 'uitdaging') && h.posts.length === 0, 'zonder mogelijke hekkensluiter: geen knop, geen aankondiging');
  // 7f. (I2) niveau uit, stille modus of alleen-testkanaal: geen overrule, ook niet met rng 0.
  for (const inst of [{ regieNiveau: 'uit' }, { stilModus: true }, { alleenTestkanaal: true }]) {
    schoonOverrule(); poll('onterecht'); h.schrijf('instellingen.json', inst);
    await sluitGeleKaartPoll(h.client, { rng: () => 0 });
    h.ok(klaar().uitkomst === 'onterecht' && !klaar().uitslag.regisseur && !bannen().UB, `${JSON.stringify(inst)}: geen overrule`);
  }
  h.schrijf('instellingen.json', {});
  // 7g. (M10) een overrule staat in het auditlog, zonder de aanklager.
  schoonOverrule(); poll('onterecht');
  await sluitGeleKaartPoll(h.client, { rng: () => 0 });
  const audit = JSON.stringify(h.lees('auditlog.json'));
  h.ok(/overrule/.test(audit) && !audit.includes('UC') && !audit.includes(aanklager), 'overrule staat in het auditlog zonder de aanklager');

  // 8. (I1) twee gelijktijdige geforceerde tikken: één ingreep, één straf.
  scores({ UA: 40, UB: 20, UC: 10 }); schoon(); powerups({}); h.schrijf('instellingen.json', {});
  const maandag = Date.parse('2026-11-23T10:00:00Z');
  await Promise.all([h.index.regieTik(h.client, { forceer: true, nu: maandag, rng: () => 0 }), h.index.regieTik(h.client, { forceer: true, nu: maandag, rng: () => 0 })]);
  h.ok(staat().log.filter((r) => r.laag === 'ingreep').length === 1, `twee gelijktijdige tikken: ${staat().log.filter((r) => r.laag === 'ingreep').length} ingreep`);
});
