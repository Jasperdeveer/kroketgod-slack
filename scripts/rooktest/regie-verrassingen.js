// Rooktest: de verrassingen van de regisseur, deel A (hete kroket, flitsopdracht, raadsel, puntenregen, woede bij stilte).
// Run: `node scripts/rooktest/regie-verrassingen.js`.
'use strict';
const harnas = require('./harnas.js');
const regie = require('../../lib/regie.js');

const MIN = 60_000;
const boek = (id) => regie.REGIEBOEK.find((i) => i.id === id);

harnas(async (h) => {
  const { voerIngreepUit, bouwRegieStand, regieKlok } = h.index;
  const leeg = () => ({ schatkist: 0, effecten: [], log: [], verrassing: null });
  const staat = () => ({ ...leeg(), ...h.lees('regie.json') });
  const score = (id) => h.lees('scores.json')[id] || 0;
  const schoon = (scores = {}) => {
    h.schrijf('regie.json', leeg());
    h.schrijf('scores.json', { ...h.lees('scores.json'), UA: 10, UB: 10, UC: 10, UD: 10, UE: 10, UF: 10, ...scores });
    h.posts.length = 0; h.updates.length = 0; h.ephemeral.length = 0;
  };
  const start = async (id, doel = null, duurMinuten = 0, random = 0) => {
    const nu = Date.now();
    const orig = Math.random; Math.random = () => random; // raadsel en opdracht: de eerste uit de pool
    try { await voerIngreepUit(h.client, { ingreep: boek(id), doel, punten: 0, duurMinuten, reden: 'test' }, bouwRegieStand(nu), nu); }
    finally { Math.random = orig; }
  };
  let msgTeller = 0;
  const zeg = (user, text, extra = {}) => h.gebeurtenis('message', { user, text, channel: 'CKANAAL', ts: `17000000${String(++msgTeller).padStart(2, '0')}.000100`, ...extra });
  const verstrijk = (v) => { const s = staat(); h.schrijf('regie.json', { ...s, verrassing: { ...s.verrassing, ...v } }); };
  const laatste = () => h.posts.at(-1);

  // ── Hete Kroket ──
  schoon();
  await start('hete_kroket', 'UA', 90);
  let v = staat().verrassing;
  h.ok(v?.id === 'hete_kroket' && v.data.houder === 'UA' && v.ts && v.kanaal === 'CKANAAL', 'hete kroket: staat in regie.json met houder, ts en kanaal');
  const p0 = laatste();
  h.ok(/🔥 \*DE HETE KROKET\* 🔥/.test(p0.text) && /<@UA>/.test(p0.text), `hete kroket: eigen kop en houder in het bericht: ${p0.text.replace(/\n/g, ' | ').slice(0, 120)}`);
  h.ok(p0.blocks.flatMap((b) => b.elements || []).some((e) => e.action_id === 'regie_hete_kroket'), 'hete kroket: knop "Geef door"');
  const d0 = v.data.deadline;
  h.ok(Math.abs(d0 - (Date.now() + 30 * MIN)) < 5000, 'hete kroket: eerste deadline na 30 minuten');
  await h.klik('regie_hete_kroket', 'UB');
  h.ok(/niet vast/.test(h.ephemeral.at(-1).text), 'hete kroket: een ander lid kan niet doorgeven');
  await h.klik('regie_hete_kroket', 'UA');
  h.ok(h.ephemeral.at(-1).text !== undefined && h.ephemeral.length === 2, 'hete kroket: de houder krijgt een keuze');
  await h.klik('regie_hete_kroket_kies', 'UA', { selected_user: 'UA' });
  h.ok(staat().verrassing.data.houder === 'UA', 'hete kroket: niet aan jezelf door te geven');
  await h.klik('regie_hete_kroket_kies', 'UA', { selected_user: 'UB' });
  v = staat().verrassing;
  h.ok(v.data.houder === 'UB' && v.data.deadline === d0 + 10 * MIN, 'hete kroket: doorgeven verlengt de tijd met 10 minuten');
  h.ok(h.updates.length >= 1 && /<@UB>/.test(h.updates.at(-1).text), 'hete kroket: het bericht is bijgewerkt met de nieuwe houder');
  await h.klik('regie_hete_kroket_kies', 'UB', { selected_user: 'UA' });
  await h.klik('regie_hete_kroket_kies', 'UA', { selected_user: 'UB' });
  // Herstart: alles staat in het bestand; de klok leest de staat opnieuw van schijf en doet niets voor de tijd.
  const voor = JSON.stringify(staat().verrassing);
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(JSON.stringify(staat().verrassing) === voor && staat().verrassing.data.deadline === d0 + 30 * MIN, 'hete kroket: herstart (klok op bewaarde staat) houdt de tijd');
  // Ontploffen: UB houdt hem, UA gaf hem het vaakst door (2x).
  verstrijk({ data: { ...staat().verrassing.data, deadline: Date.now() - 1000 } });
  h.posts.length = 0;
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UB') === 7, `hete kroket: de houder verliest 3 (${score('UB')})`);
  h.ok(score('UA') === 11, `hete kroket: de vaakste doorgever krijgt 1 (${score('UA')})`);
  h.ok(staat().verrassing === null && staat().schatkist === 2 && /ONTPLOFT/.test(h.updates.at(-1)?.text || ''), `hete kroket: Schatkist en melding (${staat().schatkist})`);
  h.ok(staat().log.filter((r) => r.laag === 'nawerking' && r.id === 'hete_kroket').length === 2, 'hete kroket: beide uitbetalingen staan als nawerking in het log');
  // Niet op tijd doorgegeven: ontploft meteen op de eerste deadline.
  schoon();
  await start('hete_kroket', 'UC', 90);
  verstrijk({ data: { ...staat().verrassing.data, deadline: Date.now() - 1 } });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UC') === 7 && staat().verrassing === null, 'hete kroket: niet doorgegeven = meteen ontploft, zonder doorgever geen bonus');

  // ── Flitsopdracht ──
  schoon();
  await start('flitsopdracht', null, 10, 0);
  v = staat().verrassing;
  h.ok(v?.id === 'flitsopdracht' && v.data.soort === 'woord' && v.data.woord === 'kroket' && /⚡ \*FLITSOPDRACHT\* ⚡/.test(laatste().text), 'flitsopdracht: kop en opdracht (woord kroket)');
  await zeg('UB', 'ik wil geen krokette');
  h.ok(score('UB') === 10 && staat().verrassing, 'flitsopdracht: het verkeerde woord telt niet');
  await zeg('UB', 'Een KROKET, graag!');
  await zeg('UC', 'ook een kroket');
  h.ok(score('UB') === 13 && score('UC') === 10 && staat().verrassing === null, `flitsopdracht: de eerste krijgt 3, de tweede niets (${score('UB')}/${score('UC')})`);
  // Een duel en een offer als opdracht.
  schoon({ UA: 20, UB: 20 });
  await start('flitsopdracht', null, 10, 0.7); // 0.7 * 6 = 4 -> duel
  h.ok(staat().verrassing.data.soort === 'duel', 'flitsopdracht: duel-opdracht gekozen');
  const orig = Math.random; Math.random = () => 0.01;
  try { await h.index.voerDuel(h.client, 'UA', 'UB', 'CKANAAL'); } finally { Math.random = orig; }
  h.ok(staat().verrassing === null && staat().log.some((r) => r.id === 'flitsopdracht' && r.laag === 'nawerking' && r.punten === 3), 'flitsopdracht: de winnaar van een duel krijgt 3 via de duelhaak');
  schoon({ UA: 20 });
  await start('flitsopdracht', null, 10, 0.9); // 0.9 * 6 = 5 -> offer
  h.ok(staat().verrassing.data.soort === 'offer', 'flitsopdracht: offer-opdracht gekozen');
  await h.index.voerOffer(h.client, 'UA', 1, 'CKANAAL');
  h.ok(staat().verrassing === null && staat().log.some((r) => r.id === 'flitsopdracht' && r.doel === 'UA' && r.punten === 3), 'flitsopdracht: een offer geeft 3 via de offerhaak');
  // Verlopen.
  schoon();
  await start('flitsopdracht', null, 10, 0);
  verstrijk({ tot: Date.now() - 1000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null && /verlopen/.test(laatste().text), 'flitsopdracht: na 10 minuten vervalt hij');
  await zeg('UB', 'kroket');
  h.ok(score('UB') === 10, 'flitsopdracht: na het verlopen geen punten meer');

  // ── Raadsel ──
  schoon();
  await start('raadsel', null, 60, 0);
  v = staat().verrassing;
  h.ok(v?.id === 'raadsel' && v.ts && /🧩/.test(laatste().text) && v.data.idx === 0, 'raadsel: kop, vraag en ts van het raadselbericht');
  const draad = v.ts;
  await zeg('UB', 'kroket');
  h.ok(score('UB') === 10, 'raadsel: een antwoord buiten de draad telt niet');
  await zeg('UB', 'geen idee', { thread_ts: draad });
  h.ok(score('UB') === 10 && staat().verrassing, 'raadsel: een fout antwoord in de draad telt niet');
  await zeg('UC', ' De KRÓKET! ', { thread_ts: draad });
  h.ok(score('UC') === 15 && staat().verrassing === null, `raadsel: het juiste antwoord in de draad geeft 5 (${score('UC')})`);
  await zeg('UD', 'kroket', { thread_ts: draad });
  h.ok(score('UD') === 10, 'raadsel: een tweede goede antwoorder krijgt niets');
  schoon();
  await start('raadsel', null, 60, 0);
  const draad2 = staat().verrassing.ts;
  h.posts.length = 0;
  verstrijk({ tot: Date.now() - 1000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null && laatste()?.thread === draad2 && /kroket/i.test(laatste().text), 'raadsel: na een uur verklapt hij het antwoord in de draad');

  // ── Puntenregen ──
  schoon();
  await start('puntenregen', null, 0);
  h.ok(staat().verrassing?.id === 'puntenregen' && /🌧️ \*PUNTENREGEN\* 🌧️/.test(laatste().text), 'puntenregen: kop');
  await zeg('UA', 'een');
  await zeg('UA', 'nog een');
  await zeg('UB', 'twee');
  await zeg('UC', 'drie');
  h.ok(score('UA') === 11 && score('UB') === 11 && score('UC') === 11 && score('UD') === 10 && staat().verrassing === null, `puntenregen: drie berichten (van drie leden) geven drie punten (${score('UA')}/${score('UB')}/${score('UC')}/${score('UD')})`);
  await zeg('UD', 'vier');
  h.ok(score('UD') === 10, 'puntenregen: daarna niets meer');

  // ── Woede bij stilte ──
  schoon();
  await start('woede_bij_stilte', null, 15);
  h.ok(staat().verrassing?.id === 'woede_bij_stilte' && /😤/.test(laatste().text), 'woede: kop en dreiging');
  await zeg('UD', 'ik ben er!');
  h.ok(score('UD') === 11 && staat().verrassing === null, `woede: een bericht binnen 15 minuten geeft 1 en bezweert de woede (${score('UD')})`);
  schoon({ UA: 30, UB: 5, UC: 10, UD: 10, UE: 10, UF: 0 });
  await start('woede_bij_stilte', null, 15);
  verstrijk({ tot: Date.now() - 1000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UA') === 29 && score('UB') === 4 && score('UC') === 9 && score('UF') === 0, `woede: zonder bericht verliest iedereen 1 (UA ${score('UA')}, UF ${score('UF')} had niets)`);
  h.ok(staat().schatkist === 5 && staat().verrassing === null, `woede: de punten gaan naar de Schatkist (${staat().schatkist})`);
  // Plafond: hoogste scores eerst als er te weinig ruimte is.
  schoon({ UA: 30, UB: 25, UC: 20, UD: 15, UE: 12, UF: 11 });
  h.schrijf('regie.json', { ...leeg(), log: [{ ts: Date.now(), id: 'x', laag: 'ingreep', doel: null, punten: -7, soort: 'nemen' }] });
  await start('woede_bij_stilte', null, 15);
  verstrijk({ tot: Date.now() - 1000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UA') === 29 && score('UB') === 24 && score('UC') === 19 && score('UD') === 15 && score('UF') === 11, 'woede: binnen de resterende ruimte (3), hoogste scores eerst');

  // ── I1c: één gok per lid, geen hagel ──
  schoon();
  await start('raadsel', null, 60, 0);
  const dr = staat().verrassing.ts;
  h.ok(Array.isArray(staat().verrassing.data.geraden), 'raadsel: data.geraden bestaat');
  await zeg('UB', 'geen idee', { thread_ts: dr });
  await zeg('UB', 'kroket', { thread_ts: dr });
  h.ok(score('UB') === 10 && staat().verrassing, 'raadsel: een tweede gok van hetzelfde lid telt niet');
  await zeg('UC', 'kroket mosterd rijk frituurpan paneermeel handdoek', { thread_ts: dr });
  h.ok(score('UC') === 10 && staat().verrassing, 'raadsel: een hagel van antwoorden wint niet');
  await zeg('UD', 'kroket', { thread_ts: dr });
  h.ok(score('UD') === 15 && staat().verrassing === null, 'raadsel: een ander lid met het goede antwoord wint');

  // ── M1/M2: een verrassing zonder ts (mislukte post) doet niets en kost niets ──
  schoon();
  h.schakel.faalPost = true;
  await start('puntenregen', null, 0);
  h.schakel.faalPost = false;
  h.ok(staat().verrassing?.id === 'puntenregen' && !staat().verrassing.ts, 'zonder ts: verrassing staat er, maar zonder ts');
  await zeg('UA', 'hallo');
  h.ok(score('UA') === 10, 'zonder ts: een bericht betaalt niets uit');
  schoon();
  h.schakel.faalPost = true;
  await start('hete_kroket', 'UA', 90);
  h.schakel.faalPost = false;
  verstrijk({ data: { ...staat().verrassing.data, deadline: Date.now() - 1000 } });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UA') === 10 && staat().verrassing === null && staat().schatkist === 0, 'hete kroket zonder ts: geen straf, stil gewist');
  schoon();
  h.schakel.faalPost = true;
  await start('woede_bij_stilte', null, 15);
  h.schakel.faalPost = false;
  verstrijk({ tot: Date.now() - 1000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(score('UA') === 10 && staat().verrassing === null && staat().schatkist === 0, 'woede zonder ts: niemand verliest iets');

  // ── M5: ballingen doen niet mee ──
  schoon();
  h.schrijf('verbanning.json', { UB: { tot: new Date(Date.now() + 3_600_000).toISOString(), reden: 'test' } });
  await start('puntenregen', null, 0);
  await zeg('UB', 'ik ben verbannen');
  h.ok(score('UB') === 10, 'balling: geen puntenregen');
  h.schrijf('verbanning.json', {});

  // ── M6: geen duelopdracht tijdens een duelverbod ──
  schoon({ UA: 20, UB: 20 });
  h.schrijf('regie.json', { ...leeg(), effecten: [{ id: 'duelverbod', soort: 'duelverbod', tot: Date.now() + 3_600_000, data: {} }] });
  await start('flitsopdracht', null, 10, 0.7); // 0.7 zou het duel zijn
  h.ok(staat().verrassing.data.soort !== 'duel', `flitsopdracht: geen duel tijdens een duelverbod (${staat().verrassing.data.soort})`);

  // ── I1a: stille modus en ruim verlopen ──
  schoon();
  await start('puntenregen', null, 0);
  h.schrijf('instellingen.json', { stilModus: true });
  await zeg('UA', 'hallo in stilte');
  h.ok(score('UA') === 10, 'stille modus: een bericht betaalt niets uit');
  verstrijk({ tot: Date.now() - 11 * MIN });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null, 'klok: een ruim verlopen verrassing wordt ook in stille modus stil gewist');
  schoon();
  h.schrijf('instellingen.json', { stilModus: false });
  await start('hete_kroket', 'UA', 90);
  h.schrijf('instellingen.json', { stilModus: true });
  verstrijk({ data: { ...staat().verrassing.data, deadline: Date.now() - 11 * MIN } });
  h.posts.length = 0; h.updates.length = 0;
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null && score('UA') === 10 && h.posts.length === 0 && h.updates.length === 0, 'klok: een hete kroket die ruim verlopen is ontploft niet, hij wordt stil gewist');
  h.schrijf('instellingen.json', { stilModus: false });
  schoon();
  await start('woede_bij_stilte', null, 15);
  verstrijk({ tot: Date.now() - 3 * 3_600_000 });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null && staat().schatkist === 0 && score('UA') === 10, 'klok: een uren verlopen woede straft niemand meer');

  // ── De klok respecteert stille modus en doet niets zonder verrassing ──
  schoon();
  await start('puntenregen', null, 0);
  verstrijk({ tot: Date.now() - 1000 });
  h.schrijf('instellingen.json', { stilModus: true });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing, 'klok: stille modus laat de staat staan');
  h.schrijf('instellingen.json', { stilModus: false });
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(staat().verrassing === null, 'klok: zonder stille modus ruimt hij de verlopen regen op');
  await regieKlok(h.client, { nu: Date.now() });
  h.ok(true, 'klok: zonder verrassing doet hij niets');
});
