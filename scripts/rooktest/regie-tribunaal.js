// Rooktest: het lichte tribunaal van de regisseur. Run: `node scripts/rooktest/regie-tribunaal.js`.
'use strict';
const fs = require('fs');
const path = require('path');
const harnas = require('./harnas.js');

harnas(async (h) => {
  const { voegToeAanArchief } = require('../../lib/archief.js'); // pas na harnas(): dat zet KROKET_ARCHIEF_PAD
  const { regieTik, regieKlok, sluitZaak, stemZaak, bouwRegieStand } = h.index;
  const staat = () => h.lees('regie.json');
  const score = (id) => h.lees('scores.json')[id] || 0;
  const maakSchoon = () => {
    h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
    h.schrijf('scores.json', { UA: 10, UB: 10, UC: 10, UD: 10, UE: 10, UF: 10 });
    h.schrijf('verbanning.json', {}); h.schrijf('geleKaarten.json', {}); h.schrijf('powerups.json', {}); h.schrijf('bamischijf.json', {});
    h.posts.length = 0;
  };
  const tik = () => regieTik(h.client, { forceer: true, nu: Date.now(), rng: () => 0, beschikbaar: ['licht_tribunaal'] });
  const stem = (u, k, id = staat().zaak?.id) => stemZaak(h.client, u, id, k);
  const zaakMet = (stemmen, extra = {}) => h.schrijf('regie.json', { ...staat(), zaak: { ...staat().zaak, stemmen, sluitTs: Date.now() - 1000, ...extra } });
  const bestandenVoor = ['tribunaal.json', 'archief.json', 'members.json'].map((f) => [f, fs.existsSync(path.join(h.state, f)) ? fs.readFileSync(path.join(h.state, f), 'utf8') : null]);

  voegToeAanArchief({ soort: 'lid', spreker: 'Bravo', sprekerId: 'UB', tekst: 'airfryer <!channel> is toch beter', ts: Date.now() - 1000, thread: false });

  // Start
  maakSchoon();
  h.ok(bouwRegieStand(Date.now()).zaakLoopt === false, 'zaakLoopt false zonder zaak');
  h.schrijf('geleKaarten.json', { UC: { kaarten: [{ ts: Date.now() - 86_400_000, kleur: 'geel' }, { ts: Date.now() - 40 * 86_400_000, kleur: 'rood' }, { ts: Date.now() - 1000, kleur: 'geel' }] } });
  h.ok(bouwRegieStand(Date.now()).leden.find((l) => l.id === 'UC').kaarten30 === 2, 'kaarten30 telt alleen de laatste 30 dagen');
  h.schrijf('geleKaarten.json', {});
  const keuze = await tik();
  const z = staat().zaak;
  h.ok(keuze?.ingreep.id === 'licht_tribunaal' && z?.doel === 'UB', `zaak op UB (${keuze?.ingreep.id})`);
  const min = (z.sluitTs - Date.now()) / 60_000;
  h.ok(min > 29 && min <= 30, `sluit over ${min.toFixed(1)} minuten`);
  h.ok(z.titel === 'Ketter van de Dag' && z.grond === 'ketterij', 'titel Ketter van de Dag');
  const post = h.posts.at(-1);
  const knoppen = (post.blocks.find((b) => b.type === 'actions')?.elements || []).map((e) => e.action_id + '=' + e.value);
  h.ok(knoppen.length === 3 && ['boete', 'titel', 'vrij'].every((k) => knoppen.includes(`regie_zaak_${k}=${z.id}`)), `drie knoppen: ${knoppen}`);
  h.ok(!/<!channel>/.test(JSON.stringify(post)), 'het ketterbericht is ontsnapt');
  h.ok(/geen kick/i.test(post.text), 'de tekst zegt geen kick');
  h.ok(bouwRegieStand(Date.now()).zaakLoopt === true, 'zaakLoopt true');
  h.ok(staat().log.at(-1).punten === 0 && score('UB') === 10, 'bij het openen wordt niets genomen');

  // Stemmen
  h.ok((await stem('UA', 'boete')).ok && (await stem('UC', 'boete')).ok && (await stem('UD', 'titel')).ok, 'UA, UC, UD stemmen');
  h.ok(!(await stem('UB', 'boete')).ok, 'het doelwit mag niet stemmen');
  h.schrijf('verbanning.json', { UE: { tot: new Date(Date.now() + 3_600_000).toISOString(), reden: 'x' } });
  h.ok(!(await stem('UE', 'boete')).ok, 'een balling mag niet stemmen');
  h.ok(!(await stem('UX', 'boete')).ok, 'een niet-lid mag niet stemmen');
  h.ok(!(await stem('UF', 'boete', 'andere-zaak')).ok, 'een andere zaak telt niet');
  await Promise.all([stem('UA', 'titel'), stem('UA', 'titel'), stem('UA', 'boete')]);
  h.ok(staat().zaak.stemmen.UA === 'boete' && Object.keys(staat().zaak.stemmen).length === 3, 'stem wijzigen, dubbelklik telt één keer');
  h.ok(h.lees('tellers.json').UA?.tribunaal_stem === 1, `tribunaal_stem telt één keer: ${JSON.stringify(h.lees('tellers.json').UA)}`);
  h.schrijf('verbanning.json', {});

  // Herstart: zaak overleeft ruimOp, de klok sluit hem precies één keer
  h.schrijf('regie.json', { ...staat(), zaak: { ...staat().zaak, sluitTs: Date.now() - 1000 } });
  h.ok(await sluitZaak(h.client, Date.now() - 5_000_000) === null, 'sluitZaak vóór sluitTs doet niets');
  await regieTik(h.client, { forceer: true, nu: Date.now(), rng: () => 0, beschikbaar: [] });
  h.ok(!!staat().zaak, 'zaak overleeft regieTik (ruimOp)');
  const posts0 = h.posts.length;
  await regieKlok(h.client);
  h.ok(staat().zaak === null && score('UB') === 8 && staat().schatkist === 2, `boete: UB ${score('UB')}, kist ${staat().schatkist}`);
  h.ok(h.posts.length === posts0 + 1, 'één aankondiging');
  h.ok(staat().log.some((r) => r.id === 'licht_tribunaal' && r.laag === 'nawerking' && r.punten === -2), 'boete geboekt als nawerking');
  h.ok(await sluitZaak(h.client) === null && score('UB') === 8 && h.posts.length === posts0 + 1, 'tweede sluiting doet niets');

  // Nooit een kick
  for (const [f, voor] of bestandenVoor) {
    const nu = fs.existsSync(path.join(h.state, f)) ? fs.readFileSync(path.join(h.state, f), 'utf8') : null;
    h.ok(nu === voor, `${f} ongewijzigd`);
  }
  h.ok(!!h.lees('members.json').UB, 'UB staat nog in members.json');
  h.ok(!h.posts.some((p) => JSON.stringify(p).includes('tribunaal_kick')), 'geen tribunaal_kick-knop');

  // Titel: twee stemmen
  maakSchoon(); await tik();
  zaakMet({ UA: 'titel', UC: 'titel', UD: 'boete' });
  const u = await sluitZaak(h.client);
  const e = staat().effecten.find((x) => x.soort === 'schandtitel');
  h.ok(u && e?.data.doel === 'UB' && e.data.titel === 'Ketter van de Dag', 'schandtitel voor UB');
  h.ok(Math.abs(e.tot - Date.now() - 86_400_000) < 5000, '24 uur looptijd');
  h.ok(score('UB') === 10 && staat().schatkist === 0, 'titel kost geen punten');

  // Te weinig stemmen
  maakSchoon(); await tik(); zaakMet({ UA: 'boete' });
  await sluitZaak(h.client);
  h.ok(score('UB') === 10 && !staat().effecten.some((x) => x.soort === 'schandtitel') && staat().zaak === null, 'één stem: vrijspraak');

  // Gelijkspel: titel
  maakSchoon(); await tik(); zaakMet({ UA: 'boete', UC: 'titel' });
  await sluitZaak(h.client);
  h.ok(score('UB') === 10 && staat().effecten.some((x) => x.soort === 'schandtitel'), 'gelijkspel boete/titel: titel');

  // M6: het doelwit is inmiddels verbannen: vrijspraak, geen boete.
  maakSchoon(); await tik(); zaakMet({ UA: 'boete', UC: 'boete' });
  h.schrijf('verbanning.json', { UB: { tot: new Date(Date.now() + 3_600_000).toISOString(), reden: 'x' } });
  const uV = await sluitZaak(h.client);
  h.ok(uV?.uitspraak === 'vrij' && score('UB') === 10 && staat().schatkist === 0, 'M6: een verbannen doelwit wordt vrijgesproken, geen boete');
  h.schrijf('verbanning.json', {});

  // Zegen
  maakSchoon(); h.schrijf('powerups.json', { UB: [{ item: 'zegen', tot: Date.now() + 3_600_000 }] });
  await tik(); zaakMet({ UA: 'boete', UC: 'boete' });
  const p1 = h.posts.length;
  await sluitZaak(h.client);
  h.ok(score('UB') === 10 && staat().schatkist === 0 && h.posts.length === p1 + 1, 'Zegen: boete neemt 0, aankondiging volgt');
  h.ok(/ketst af|Zegen/i.test(h.posts.at(-1).text), `aankondiging spot: ${h.posts.at(-1).text.slice(0, 100)}`);

  // Mention-prompt kent de schandtitel: de effectregel staat in de staat
  h.ok(typeof stemZaak === 'function', 'stemZaak geëxporteerd');
});
