// Rooktest: ketterij uit het archief, de gele kaart van de Kroket God en het klachtenuur. Run: `node scripts/rooktest/regie-raad.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');
const { voegToeAanArchief } = require('../../lib/archief.js');

harnas(async (h) => {
  const { bouwRegieStand, regieTik, sluitGeleKaartPoll, regieStaat, UITVOERDERS } = h.index;
  const nu = Date.now();
  const schoon = () => {
    h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
    h.schrijf('verbanning.json', {}); h.schrijf('geleKaarten.json', {}); h.schrijf('powerups.json', {}); h.schrijf('bamischijf.json', {});
    try { fs.unlinkSync(path.join(h.state, 'gelekaartpoll.json')); } catch { /* er was er geen */ }
    h.schakel.reacties = []; h.posts.length = 0;
  };
  const poll = () => { try { return h.lees('gelekaartpoll.json'); } catch { return null; } };
  const bannen = () => h.lees('verbanning.json');
  const staat = () => h.lees('regie.json');
  const ub = (st) => st.leden.find((l) => l.id === 'UB');
  const tik = () => regieTik(h.client, { forceer: true, nu: Date.now(), rng: () => 0, beschikbaar: ['ketter_voordracht'] });

  voegToeAanArchief({ soort: 'lid', spreker: 'Bravo', sprekerId: 'UB', tekst: 'ketchup op mijn kroket, heerlijk', ts: nu - 1000, thread: false });
  voegToeAanArchief({ soort: 'lid', spreker: 'Bravo', sprekerId: 'UB', tekst: 'ik vind dat de kroket van gisteren echt veel te droog was voor een dinsdag', ts: nu - 2000, thread: false });

  // 1. Ketterij herkend, en niet in de week van de Airfryer-Kroket.
  schoon();
  h.ok(/ketchup/.test(ub(bouwRegieStand(nu))?.ketterij || ''), `UB heeft ketterij: ${ub(bouwRegieStand(nu))?.ketterij}`);
  h.ok(ub(bouwRegieStand(nu)).ketterij.length <= 120 && !bouwRegieStand(nu).leden.find((l) => l.id === 'UA').ketterij, 'alleen UB, hoogstens 120 tekens');
  h.schrijf('bamischijf.json', { actief: true, hp: 10, maxHp: 20, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  h.ok(ub(bouwRegieStand(nu)).ketterij === null, 'in de week van airfryer_kroket is ketterij null');
  h.ok(Array.isArray(bouwRegieStand(nu).opdrachtActies), 'opdrachtActies blijft een array');
  schoon();
  h.ok(bouwRegieStand(nu).raad.pollLoopt === false, 'raad.pollLoopt is false zonder poll');

  // 2. Voordracht door de Kroket God.
  const keuze = await tik();
  const p = poll();
  h.ok(keuze?.ingreep.id === 'ketter_voordracht' && keuze.doel === 'UB', `tik koos ketter_voordracht op ${keuze?.doel}`);
  h.ok(p?.actief && p.door === 'regisseur' && p.godStem === 'onthouden' && p.aanklagerId === null, `poll: door regisseur, godStem onthouden (${JSON.stringify(p && { d: p.door, g: p.godStem })})`);
  const minuten = (p.sluitTs - Date.now()) / 60_000;
  h.ok(minuten > 14 && minuten <= 15, `sluit over ${minuten.toFixed(1)} minuten`);
  const bord = JSON.stringify(h.posts.at(-1)?.blocks || '');
  h.ok(/de Kroket God/.test(bord) && !/anonieme/.test(bord), 'het bord noemt de Kroket God en niet "anonieme"');
  h.ok(/stemt niet over zijn eigen voordracht/.test(bord), 'het bord zegt dat hij niet stemt');
  h.ok(bouwRegieStand(Date.now()).raad.pollLoopt === true, 'raad.pollLoopt is true');
  h.ok(staat().log.at(-1).schorsing === true, 'de voordracht telt als schorsing in het plafond');
  h.ok(h.posts.length === 1, `alleen het bord is de aankondiging (${h.posts.length} posts)`);

  // 3. God stemt niet mee: 0-0 geeft geen kaart, geen overrule.
  const sluit = () => { h.schrijf('gelekaartpoll.json', { ...poll(), sluitTs: Date.now() - 1 }); return sluitGeleKaartPoll(h.client, { rng: () => 0 }); };
  await sluit();
  h.ok(poll().uitkomst === 'onterecht' && !poll().uitslag.regisseur && !bannen().UB && !h.lees('geleKaarten.json').UB, 'God stemt niet mee: 0-0, geen ban, geen kaart, geen overrule');
  h.ok(!/dubbel/.test(h.posts.at(-1).text), `de tekst zegt niet dat zijn stem dubbel woog: ${h.posts.at(-1).text.slice(0, 80)}`);
  h.ok(!staat().log.some((r) => r.id === 'overrule'), 'geen overrule geboekt');

  // 4. De Raad beslist: twee gele reacties.
  schoon(); await tik();
  h.schakel.reacties = [{ name: 'large_yellow_square', users: ['UC', 'UD'] }];
  await sluit();
  const b = bannen().UB;
  h.ok(poll().uitkomst === 'terecht' && b && Date.parse(b.tot) - Date.now() > 3_000_000 && h.lees('geleKaarten.json').UB?.kaarten?.length === 1, 'twee gele stemmen: UB een uur verbannen, een kaart op het dossier');
  h.ok(!staat().log.some((r) => r.id === 'overrule'), 'geen overrule bij zijn eigen voordracht (rng 0)');
  h.ok(b.kaart === 'geel' && h.lees('geleKaarten.json').UB.kaarten[0].kleur === 'geel', `kleur geel: ${b.kaart}`);

  // 5. Nooit rood: UB heeft al een kaart deze week.
  schoon();
  h.schrijf('geleKaarten.json', { UB: { kaarten: [{ ts: nu, reden: 'test', weekSleutel: h.index.getMondayOfWeek(), kleur: 'geel' }] } });
  const st = bouwRegieStand(nu);
  h.ok(ub(st).geleKaartDezeWeek === true, `UB heeft geleKaartDezeWeek (${JSON.stringify(h.lees('geleKaarten.json'))})`);
  h.ok(regie.kiesIngreep(st, regieStaat(), { nu, rng: () => 0, forceer: true, beschikbaar: ['ketter_voordracht'], niveau: 'wild' }) === null, 'nooit rood: geen voordracht tegen wie al geel heeft');

  // 6. Klachtenuur.
  schoon();
  const orig = Math.random;
  const klacht = async (user) => { Math.random = () => 0.5; try { return await h.commando(user, 'klacht Bravo eet ketchup'); } finally { Math.random = orig; } };
  await klacht('UA'); // zonder klachtenuur
  h.ok(poll() === null, 'zonder klachtenuur: geen poll');
  await UITVOERDERS.klachtenuur(h.client, { duurMinuten: 60 }, {}, Date.now());
  await klacht('UA');
  const k = poll();
  h.ok(k?.actief && k.doelwitId === 'UB' && k.aanklagerId === 'UA' && !k.door, `klacht in het uur: poll op UB door UA (${JSON.stringify(k && { d: k.doelwitId, a: k.aanklagerId, door: k.door })})`);
  h.ok(!/Alfa/.test(JSON.stringify(h.posts.map((x) => x.blocks))), 'de klager blijft anoniem op het bord');
  await klacht('UC');
  h.ok(poll().aanklagerId === 'UA', 'tweede klacht: geen tweede poll');
  h.schrijf('gelekaartpoll.json', { ...poll(), actief: false, uitkomst: 'onterecht', beslistTs: 0 });
  await klacht('UC');
  h.ok(poll().aanklagerId === 'UA' && !poll().actief, 'ook na het sluiten: hoogstens één voordracht per uur');

  // 7. De reden bevat tekst van een lid: mentions en links breken niet uit.
  schoon();
  voegToeAanArchief({ soort: 'lid', spreker: 'Bravo', sprekerId: 'UB', tekst: 'airfryer <!channel> <https://boze.nl|klik> ik haat jullie allemaal', ts: Date.now(), thread: false });
  await tik();
  const bord2 = JSON.stringify(h.posts.at(-1).blocks);
  h.ok(!/<!channel>|<https/.test(bord2), 'geen <!channel> of link in het bord');
  h.ok(Array.isArray(bouwRegieStand(Date.now()).opdrachtActies), 'opdrachtActies is nog een array');
});
