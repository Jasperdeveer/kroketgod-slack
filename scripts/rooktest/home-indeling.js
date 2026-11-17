// Rooktest: de nieuwe bovenkant van de App Home (kop, melding, perkament, VANDAAG, UW BEURT, WEEKVIJAND).
// Run: `node scripts/rooktest/home-indeling.js`.
'use strict';
const harnas = require('./harnas.js');
const { getMondayOfWeek } = require('../../lib/tijd.js');

const MIN = 60_000;

harnas(async (h) => {
  const { bouwAppHomeBlocks } = h.index;
  const nu = Date.now();
  const vandaagKey = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const vandaagIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const leeg = () => ({ schatkist: 0, zaak: null, effecten: [], log: [], verrassing: null });
  const schoon = () => {
    h.schrijf('instellingen.json', { weekendRust: false });
    h.schrijf('regie.json', leeg());
    h.schrijf('raadpleeg.json', { datum: vandaagIso, leden: {}, heilige: null });
    h.schrijf('verbanning.json', {});
    h.schrijf('bamischijf.json', { actief: false, hp: 0, maxHp: 51, strijders: {} });
    h.schrijf('claims.json', {});
    h.schrijf('veiling.json', {});
    h.schrijf('tribunaal.json', null);
    h.schrijf('gelekaartpoll.json', null);
  };
  const home = (u) => bouwAppHomeBlocks(u);
  const tekst = (b) => JSON.stringify(b);
  const idx = (bl, prefix) => bl.findIndex((b) => String(b.block_id || '').startsWith(prefix));
  const knoppen = (bl, prefix) => bl.filter((b) => String(b.block_id || '').startsWith(prefix))
    .flatMap((b) => [...(b.elements || []), ...(b.accessory ? [b.accessory] : [])]).map((e) => e.action_id);
  const alleIds = (bl) => bl.flatMap((b) => [...(b.elements || []), ...(b.accessory ? [b.accessory] : [])]).map((e) => e.action_id).filter(Boolean);
  const vandaagBl = (bl) => bl.filter((b) => String(b.block_id || '').startsWith('top_vandaag'));
  const beurt = (bl) => bl.filter((b) => String(b.block_id || '').startsWith('top_beurt'));

  // 1. Volgorde: kop < VANDAAG < UW BEURT < WEEKVIJAND, en de rest van de oude kaarten eronder.
  schoon();
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  let bl = home('UA');
  const [iKop, iVandaag, iBeurt, iVijand] = ['top_kop', 'top_vandaag', 'top_beurt', 'top_weekvijand'].map((p) => idx(bl, p));
  h.ok(iKop === 0 && iKop < iVandaag && iVandaag < iBeurt && iBeurt < iVijand, `volgorde kop < VANDAAG < UW BEURT < WEEKVIJAND (${iKop},${iVandaag},${iBeurt},${iVijand})`);
  const iNaslag = bl.findIndex((b) => (b.elements || []).some((e) => String(e.action_id || '').startsWith('naslag_')));
  h.ok(iNaslag > iVijand, 'de naslagknoppen staan onder de vaste bovenkant');
  const ids = bl.map((b) => b.block_id).filter(Boolean);
  h.ok(ids.length === new Set(ids).size, 'block_id\'s zijn uniek');
  h.ok(bl.slice(0, iVijand + 1).every((b) => String(b.block_id || '').startsWith('top_')), 'elk blok van de bovenkant draagt een top_-block_id');

  // 2. De oude dubbelen zijn weg.
  const t = tekst(bl);
  h.ok(!t.includes('NU TE DOEN') && !t.includes('OPDRACHTEN VAN VANDAAG') && !t.includes('DEZE WEEK*'), 'NU TE DOEN en de losse opdrachtenkaart zijn weg');
  h.ok(!t.includes('Raadpleeg de Kroket God') || idx(bl, 'top_beurt') >= 0, 'raadpleegregel zit in UW BEURT');
  const ki = alleIds(bl);
  h.ok(ki.filter((i) => i === 'open_duel').length === 1 && ki.filter((i) => i === 'open_raadpleeg').length === 1, 'duel- en raadpleegknop komen één keer voor');

  // 3. UW BEURT: opdrachten en actieknoppen.
  const b3 = tekst(beurt(bl));
  h.ok(/\*UW BEURT\*/.test(b3) && /\+\d/.test(b3), 'UW BEURT toont opdrachten met beloning');
  const kn = knoppen(bl, 'top_beurt');
  h.ok(['open_duel', 'open_offer', 'open_eer', 'open_raadpleeg'].every((k) => kn.includes(k)), `UW BEURT heeft de actieknoppen (${kn.join(',')})`);
  h.ok(b3.includes('Vandaag nog:'), 'de raadpleegregel meldt wat nog open is');

  // 4. VANDAAG: stil, dan een gezet effect en een lopende verrassing.
  schoon();
  bl = home('UA');
  h.ok(tekst(vandaagBl(bl)).includes('houdt zich vandaag nog stil'), 'stil: de stille regel');
  h.schrijf('regie.json', {
    ...leeg(),
    effecten: [{ id: 'dicht', soort: 'dicht', tot: nu + 2 * 60 * MIN, data: {} }, { id: 'duelverbod', soort: 'duelverbod', tot: nu + 60 * MIN, data: {} }],
    verrassing: { id: 'raadsel', start: nu, tot: nu + 60 * MIN, kanaal: 'CKANAAL', ts: null, data: { idx: 0 } },
    log: [{ ts: nu - 5 * MIN, id: 'inflatie', laag: 'ingreep', doel: null, punten: 0, soort: 'gril' }],
  });
  bl = home('UA');
  const v = tekst(bl.filter((b) => String(b.block_id || '').startsWith('top_vandaag')));
  h.ok(/Casino dicht/i.test(v) && /Duelverbod/i.test(v) && /tot \d\d:\d\d/.test(v), `VANDAAG toont gezette effecten met eindtijd`);
  h.ok(/raadsel/i.test(v), 'VANDAAG toont de lopende verrassing');
  h.ok(/Een uur lang is alles in de Aflatenhandel twee keer zo duur/.test(v), 'VANDAAG toont de laatste ingreep van vandaag');
  h.ok(!v.includes('houdt zich vandaag nog stil'), 'niet stil als er iets loopt');
  const regels = (tekst(vandaagBl(bl)).match(/> /g) || []).length;
  h.ok(regels <= 4, `hoogstens vier regels (${regels})`);

  // 5. Een open licht tribunaal geeft regie_zaak_*-knoppen in UW BEURT (niet voor de beschuldigde).
  schoon();
  h.schrijf('regie.json', { ...leeg(), zaak: { id: `zaak-${nu}`, doel: 'UB', grond: 'kaarten', citaat: null, titel: 'Vaste Klant van de Raad', stemmen: {}, sluitTs: nu + 30 * MIN, kanaal: 'CKANAAL' } });
  let k = knoppen(home('UA'), 'top_beurt');
  h.ok(['regie_zaak_boete', 'regie_zaak_titel', 'regie_zaak_vrij'].every((x) => k.includes(x)), 'zaak: drie stemknoppen in UW BEURT');
  const zaakKnop = beurt(home('UA')).flatMap((b) => b.elements || []).find((e) => e.action_id === 'regie_zaak_boete');
  h.ok(zaakKnop?.value === `zaak-${nu}`, 'zaak: knopwaarde is de zaak-id');
  h.ok(!knoppen(home('UB'), 'top_beurt').includes('regie_zaak_boete'), 'zaak: de beschuldigde krijgt geen stemknoppen');
  const n0 = h.ephemeral.length;
  await h.klik('regie_zaak_boete', 'UA', { value: `zaak-${nu}` });
  h.ok(h.lees('regie.json').zaak.stemmen.UA === 'boete' && h.ephemeral.length > n0, 'zaak: de knop uit UW BEURT werkt nog');

  // 6. Raid actief -> bamischijf_aanval onder WEEKVIJAND; geen knop als de aanval is gedaan.
  schoon();
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  bl = home('UA');
  h.ok(knoppen(bl, 'top_weekvijand').includes('bamischijf_aanval') && knoppen(bl, 'top_weekvijand').includes('bamischijf_offer'), 'raid: aanvalsknoppen in WEEKVIJAND');
  h.ok(/30\/51/.test(tekst(bl.filter((b) => String(b.block_id || '').startsWith('top_weekvijand')))), 'raid: HP in WEEKVIJAND');
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: { UA: { schade: 3, laatsteAanval: vandaagKey } }, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  h.ok(!knoppen(home('UA'), 'top_weekvijand').includes('bamischijf_aanval'), 'raid: aanval gedaan, geen knop');

  // 7. Andere deadline-acties staan als regel met knop in UW BEURT.
  schoon();
  h.schrijf('regie.json', { ...leeg(), verrassing: { id: 'hete_kroket', start: nu, tot: nu + 90 * MIN, kanaal: 'CKANAAL', ts: null, data: { houder: 'UA', deadline: nu + 30 * MIN, einde: nu + 90 * MIN, doorgaven: [] } },
    effecten: [{ id: `uitdaging_${nu}`, soort: 'uitdaging', tot: nu + 60 * MIN, data: { koploper: 'UA', hekkensluiter: 'UB', gebruikt: false } }] });
  k = knoppen(home('UA'), 'top_beurt');
  h.ok(k.includes('regie_hete_kroket') && k.includes('regie_uitdaging'), 'Hete Kroket en uitdaging van de koploper in UW BEURT');
  h.ok(!knoppen(home('UB'), 'top_beurt').some((x) => /regie_hete_kroket|regie_uitdaging/.test(x)), 'andere leden zien die knoppen niet');
  schoon();
  h.schrijf('claims.json', { x: { gekerkte: 'UA', dader: 'UB', ts: nu - MIN, soort: 'roof_gelukt' } });
  bl = home('UA');
  k = knoppen(bl, 'top_beurt');
  h.ok(['claim_vergeven_UB', 'claim_vergelden_UB', 'claim_laten_UB'].every((x) => k.includes(x)), 'open claim: drie knoppen in UW BEURT');
  h.ok(alleIds(bl).filter((i) => i === 'claim_vergeven_UB').length === 1, 'claimknoppen niet dubbel op de Home');
  schoon();
  h.schrijf('veiling.json', { status: 'open', weekStart: getMondayOfWeek(), artefact: { naam: 'Gouden Spatel', uitleg: 'glanst' }, biedingen: [] });
  bl = home('UA');
  k = knoppen(bl, 'top_beurt');
  h.ok(k.includes('veiling_bied_1') && k.includes('veiling_bied_3') && alleIds(bl).filter((i) => i === 'veiling_bied_1').length === 1, 'veiling: biedknoppen één keer, in UW BEURT');
  schoon();
  h.schrijf('tribunaal.json', { fase: 'stemming', doelwitId: 'UE', stemmen: {}, dossier: { dagenStil: 9 }, sluitTs: nu + 3_600_000 });
  bl = home('UA');
  k = knoppen(bl, 'top_beurt');
  h.ok(k.includes('tribunaal_voor') && k.includes('tribunaal_tegen') && alleIds(bl).filter((i) => i === 'tribunaal_voor').length === 1, 'tribunaal: stemknoppen één keer, in UW BEURT');
  schoon();
  h.schrijf('gelekaartpoll.json', { actief: true, doelwitId: 'UE', aanklagerId: 'UF', reden: 'x', hadAlKaart: false, godStem: 'onterecht', bondgenootIds: [], gestart: nu, sluitTs: nu + 5 * MIN, kanaal: 'CKANAAL', berichtTs: '1' });
  h.ok(/Gele-kaartstemming/.test(tekst(beurt(home('UA')))), 'gele-kaartstemming: regel in UW BEURT');
  schoon();
  h.schrijf('personas.json', { gast1: { naam: 'Gast Een', actief: true, vertrekOp: nu - MIN } });
  bl = home('UA');
  h.ok(alleIds(bl).filter((i) => i === 'gast_vasthouden_0').length === 1 && knoppen(bl, 'top_beurt').includes('gast_vasthouden_0'), 'gast vasthouden: één keer, in UW BEURT');
  h.schrijf('personas.json', {});

  // 8. Verbannen lid: kop, melding, VANDAAG, geen actieknoppen.
  schoon();
  h.schrijf('verbanning.json', { UA: { tot: new Date(nu + 3_600_000).toISOString() } });
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  h.schrijf('regie.json', { ...leeg(), zaak: { id: `zaak-${nu}`, doel: 'UB', grond: 'kaarten', stemmen: {}, sluitTs: nu + 30 * MIN, kanaal: 'CKANAAL' } });
  bl = home('UA');
  const gids = alleIds(bl);
  h.ok(tekst(bl).includes('U bent verbannen') && idx(bl, 'top_vandaag') > 0, 'verbannen: melding en VANDAAG');
  h.ok(!tekst(bl).includes('*UW BEURT*') && idx(bl, 'top_beurt') === -1, 'verbannen: geen UW BEURT');
  h.ok(!gids.some((i) => /^(open_|regie_zaak|bamischijf_|veiling_|claim_|tribunaal_|gast_vasthouden|handdruk_|visioen_)/.test(i)), `verbannen: geen actieknoppen (${gids.filter((i) => /^(open_|regie_|bamischijf_)/.test(i)).join(',')})`);

  // 9. Melding en extraBlocks staan boven VANDAAG, en een volle dag blijft onder de blokgrens.
  schoon();
  bl = bouwAppHomeBlocks('UA', 'een melding', [{ type: 'section', text: { type: 'mrkdwn', text: 'extra' } }]);
  h.ok(idx(bl, 'top_melding') > idx(bl, 'top_kop') && idx(bl, 'top_melding') < idx(bl, 'top_vandaag') && tekst(bl).includes('een melding'), 'melding staat tussen kop en VANDAAG');
  h.ok(bl.slice(0, idx(bl, 'top_vandaag')).filter((b) => b.text?.text === 'extra').length === 1, 'extraBlocks staan boven VANDAAG');
  h.ok(bl.length < 100, `blokken: ${bl.length}`);
  // 10. Een volle dag: alles tegelijk. De vaste bovenkant blijft compact en de view onder de Slack-grens.
  schoon();
  const poll = { actief: true, doelwitId: 'UE', aanklagerId: 'UF', reden: 'x', hadAlKaart: false, godStem: 'onterecht', bondgenootIds: [], gestart: nu, sluitTs: nu + 5 * MIN, kanaal: 'CKANAAL', berichtTs: '1' };
  h.schrijf('gelekaartpoll.json', poll);
  h.schrijf('tribunaal.json', { fase: 'stemming', doelwitId: 'UE', stemmen: {}, dossier: { dagenStil: 9 }, sluitTs: nu + 3_600_000 });
  h.schrijf('claims.json', { x: { gekerkte: 'UA', dader: 'UB', ts: nu - MIN, soort: 'roof_gelukt' }, y: { gekerkte: 'UA', dader: 'UC', ts: nu - MIN, soort: 'duel_verloren' } });
  h.schrijf('veiling.json', { status: 'open', weekStart: getMondayOfWeek(), artefact: { naam: 'Gouden Spatel', uitleg: 'glanst' }, biedingen: [] });
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  h.schrijf('personas.json', { g1: { naam: 'Gast Een', actief: true, vertrekOp: nu - MIN }, g2: { naam: 'Gast Twee', actief: true, vertrekOp: nu - MIN } });
  h.schrijf('regie.json', { ...leeg(), zaak: { id: `zaak-${nu}`, doel: 'UB', grond: 'kaarten', stemmen: {}, sluitTs: nu + 30 * MIN },
    verrassing: { id: 'hete_kroket', start: nu, tot: nu + 90 * MIN, kanaal: 'CKANAAL', ts: null, data: { houder: 'UA', deadline: nu + 30 * MIN, einde: nu + 90 * MIN, doorgaven: [] } },
    effecten: [{ id: 'dicht', soort: 'dicht', tot: nu + 60 * MIN, data: {} }, { id: `uitdaging_${nu}`, soort: 'uitdaging', tot: nu + 60 * MIN, data: { koploper: 'UA', hekkensluiter: 'UB', gebruikt: false } }] });
  bl = bouwAppHomeBlocks('UA', 'melding', [{ type: 'section', text: { type: 'mrkdwn', text: 'a' } }, { type: 'section', text: { type: 'mrkdwn', text: 'b' } }]);
  const topN = bl.filter((b) => String(b.block_id || '').startsWith('top_')).length;
  h.ok(topN <= 40 && bl.length < 100, `volle dag: ${topN} bovenste blokken, ${bl.length} in totaal`);
  h.schrijf('personas.json', {});
});
