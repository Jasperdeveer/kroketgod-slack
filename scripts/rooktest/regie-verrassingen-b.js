// Rooktest: de verrassingen van de regisseur, deel B (stadhouder, herverdeling, archief spreekt, omgekeerd uur).
// Run: `node scripts/rooktest/regie-verrassingen-b.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const MIN = 60_000, DAG = 86_400_000;
const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { voerIngreepUit, bouwRegieStand, regieKlok, voegToeAanArchief } = h.index;
  const leeg = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const score = (id) => h.lees('scores.json')[id] || 0;
  const schoon = (scores = {}) => {
    h.schrijf('regie.json', leeg());
    h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 10, UB: 10, UC: 10, UD: 10, UE: 10, UF: 10, ...scores });
    h.posts.length = 0; h.updates.length = 0; h.ephemeral.length = 0;
  };
  const start = async (id, doel = null, duurMinuten = 0) => {
    const nu = Date.now();
    return voerIngreepUit(h.client, { ingreep: boek(id), doel, punten: 0, duurMinuten, reden: 'test' }, bouwRegieStand(nu), nu);
  };
  const laatste = () => h.posts.at(-1);
  const heeftEffect = (soort) => staat().effecten.some((e) => e.soort === soort && e.tot > Date.now());

  // ── Stadhouder ──
  schoon({ UA: 30, UB: 25 });
  await start('stadhouder', 'UC', 60);
  let v = staat().verrassing;
  h.ok(v?.id === 'stadhouder' && v.data.stadhouder === 'UC' && v.ts && Math.abs(v.tot - (Date.now() + 60 * MIN)) < 5000, 'stadhouder: staat met stadhouder, ts en een uur looptijd');
  const ids = laatste().blocks.flatMap((b) => b.elements || []).map((e) => e.action_id);
  h.ok(['regie_stad_casino', 'regie_stad_belasting', 'regie_stad_gunst'].every((a) => ids.includes(a)), `stadhouder: drie knoppen (${ids})`);
  await h.klik('regie_stad_casino', 'UB');
  h.ok(!heeftEffect('dicht') && staat().verrassing, 'stadhouder: een ander lid kan niet drukken');
  await h.klik('regie_stad_casino', 'UC');
  h.ok(heeftEffect('dicht') && staat().verrassing === null, 'stadhouder: de knop sluit het casino');
  await h.klik('regie_stad_belasting', 'UC');
  h.ok(score('UA') === 30 && /al |verlopen/.test(h.ephemeral.at(-1).text), `stadhouder: een tweede druk is geweigerd (${h.ephemeral.at(-1).text})`);

  schoon({ UA: 30, UB: 25 });
  await start('stadhouder', 'UC', 60);
  await h.klik('regie_stad_belasting', 'UC');
  h.ok(score('UA') === 27 && staat().schatkist === 3 && staat().log.some((r) => r.laag === 'nawerking' && r.id === 'stadhouder'), `stadhouder: belasting op de koploper, naar de Schatkist (${score('UA')}/${staat().schatkist})`);

  schoon({ UA: 30 });
  h.schrijf('activiteit.json', { ...h.lees('activiteit.json'), UD: { laatsteBericht: Date.now() - 9 * DAG, laatsteDaad: Date.now() - 9 * DAG } });
  await start('stadhouder', 'UC', 60);
  const voorD = score('UD');
  await h.klik('regie_stad_gunst', 'UC');
  h.ok(score('UC') === 10 && [10, 12].includes(score('UD')) && staat().verrassing === null, `stadhouder: gunst geeft 2 aan een ander lid dan de stadhouder (UC ${score('UC')}, UD ${voorD}->${score('UD')})`);

  schoon();
  await start('stadhouder', 'UC', 60);
  h.schrijf('regie.json', { ...staat(), verrassing: { ...staat().verrassing, tot: Date.now() - 1000 } });
  h.posts.length = 0;
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null && h.posts.length === 1 && /<@UC>/.test(laatste().text), 'stadhouder: zonder keuze spot de Kroket God na het uur');

  // ── Herverdeling ──
  schoon({ UA: 60, UB: 50, UC: 20, UD: 12, UE: 10, UF: 8 });
  await start('herverdeling');
  h.ok(score('UA') === 56 && score('UB') === 46 && score('UE') === 14 && score('UF') === 12 && score('UC') === 20, `herverdeling: van rijk naar arm, hoogstens 4 per lid (${score('UA')},${score('UB')},${score('UE')},${score('UF')})`);
  h.ok(staat().log.filter((r) => r.laag === 'nawerking' && r.id === 'herverdeling').length >= 2, 'herverdeling: geboekt als nawerking');

  schoon({ UA: 45, UB: 30, UC: 20, UD: 12, UE: 10, UF: 4 });
  await start('herverdeling');
  h.ok(score('UA') === 41 && score('UB') === 27 && score('UF') === 8 && score('UE') === 13, `herverdeling: 10% afgerond, pot gelijk verdeeld, restant naar de laagste (${score('UA')},${score('UB')},${score('UF')},${score('UE')})`);

  schoon({ UA: 44, UB: 30, UC: 20, UD: 12, UE: 10, UF: 4 });
  await start('herverdeling');
  h.ok(score('UA') === 44 && score('UF') === 4 && h.posts.length === 0, 'herverdeling: bij een verschil van 40 of minder gebeurt niets');

  // ── Archief spreekt ──
  schoon();
  h.ok(regie.REGIEBOEK.find((i) => i.id === 'archief_spreekt').voorwaarde({ archiefKandidaat: bouwRegieStand(Date.now()).archiefKandidaat }) === false, 'archief: zonder geschikte regel is de voorwaarde onwaar');
  const ts30 = Date.now() - 30 * DAG;
  voegToeAanArchief({ soort: 'lid', spreker: 'Alfa', sprekerId: 'UA', tekst: 'een draadantwoord van een maand terug', ts: ts30, thread: true });
  voegToeAanArchief({ soort: 'lid', spreker: 'Alfa', sprekerId: 'UA', tekst: 'een oud bericht zonder draadveld', ts: ts30 });
  voegToeAanArchief({ soort: 'lid', spreker: 'Alfa', sprekerId: 'UA', tekst: 'te recent bericht van tien dagen terug', ts: Date.now() - 10 * DAG, thread: false });
  h.ok(!bouwRegieStand(Date.now()).archiefKandidaat, 'archief: draad, oude regel zonder veld en een te recente regel tellen niet');
  voegToeAanArchief({ soort: 'kroketgod', spreker: 'Kroket God', tekst: 'een bericht van de bot een maand terug', ts: ts30, thread: false });
  h.ok(!bouwRegieStand(Date.now()).archiefKandidaat, 'archief: een regel van de bot telt niet');
  voegToeAanArchief({ soort: 'lid', spreker: 'Alfa', sprekerId: 'UA', tekst: 'frituren is een levenshouding', ts: ts30, thread: false });
  h.ok(!!bouwRegieStand(Date.now()).archiefKandidaat, 'archief: een lidregel van 30 dagen terug zonder draad is een kandidaat');
  for (const [r, verwacht] of [[0, 11], [0.9, 10]]) {
    schoon();
    const orig = Math.random; Math.random = () => r;
    try { await start('archief_spreekt'); } finally { Math.random = orig; }
    h.ok(/frituren is een levenshouding/.test(laatste().text) && !/draadantwoord|bot/.test(laatste().text), `archief: citaat in het kanaal (${laatste().text.replace(/\n/g, ' | ').slice(0, 100)})`);
    h.ok(score('UA') === verwacht, `archief: ${r === 0 ? 'zegen +1' : 'berisping zonder punten'} (${score('UA')})`);
  }
  // Nooit van vóór gedeeldSinds: een nieuw lid maakt oude regels onbruikbaar.
  h.schrijf('members.json', { ...h.lees('members.json'), UF: { ...h.lees('members.json').UF, lidSinds: new Date(Date.now() - 5 * DAG).toISOString() } });
  h.ok(!bouwRegieStand(Date.now()).archiefKandidaat, 'archief: een regel van vóór het jongste lid wordt nooit geciteerd');

  // logBericht legt het draadveld vast.
  const fs = require('fs'), pad = require('path').join(h.state, 'archief.ndjson');
  await h.gebeurtenis('message', { user: 'UA', text: 'los bericht voor het archiefveld', channel: 'CKANAAL', ts: '1700000001.000100' });
  await h.gebeurtenis('message', { user: 'UA', text: 'draadantwoord voor het archiefveld', channel: 'CKANAAL', ts: '1700000002.000100', thread_ts: '1700000001.000100' });
  const regels = fs.readFileSync(pad, 'utf8').split('\n').filter(Boolean).map((r) => JSON.parse(r));
  h.ok(regels.find((r) => /los bericht voor/.test(r.tekst))?.thread === false && regels.find((r) => /draadantwoord voor/.test(r.tekst))?.thread === true, 'logBericht: thread is false voor een los bericht en true voor een draadantwoord');

  // ── Omgekeerd uur ──
  schoon();
  await start('omgekeerd_uur', null, 60);
  const e = staat().effecten.find((x) => x.soort === 'omgekeerdUur');
  h.ok(e && Math.abs(e.tot - (Date.now() + 60 * MIN)) < 5000, 'omgekeerd uur: effect voor een uur');
  h.ok(h.posts.length === 1 && /omgekeerd|kop|verliez/i.test(laatste().text), `omgekeerd uur: aangekondigd (${laatste().text.slice(0, 80)})`);
});
