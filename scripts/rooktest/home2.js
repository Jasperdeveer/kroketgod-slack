// Rooktest: App Home 2.0 (K2): blokvormen, limieten, deadline-alert, verbannen lid, terugval en uitrol.
// Run: `node scripts/rooktest/home2.js`.
'use strict';
const harnas = require('./harnas.js');
const { getMondayOfWeek } = require('../../lib/tijd.js');

const MIN = 60_000;
const OWNER = 'U08ALFNQB1V'; // OPPERKROKET_ID

harnas(async (h) => {
  const { bouwAppHome2Blocks, bouwAppHomeBlocks, publiceerHome, homeKaart, saveInstellingen } = h.index;
  const nu = Date.now();
  const vandaagIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  const leeg = () => ({ schatkist: 0, zaak: null, effecten: [], log: [], verrassing: null });
  const leden = h.lees('members.json');
  h.schrijf('members.json', { ...leden, [OWNER]: { naam: 'Opper', bijnaam: 'Opper', voornaam: 'opper', lidSinds: '2026-05-01' } });
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
    h.schrijf('personas.json', {});
  };
  const vol = () => { // een volle dag: alles tegelijk
    h.schrijf('gelekaartpoll.json', { actief: true, doelwitId: 'UE', aanklagerId: 'UF', reden: 'x', hadAlKaart: false, godStem: 'onterecht', bondgenootIds: [], gestart: nu, sluitTs: nu + 5 * MIN, kanaal: 'CKANAAL', berichtTs: '1' });
    h.schrijf('tribunaal.json', { fase: 'stemming', doelwitId: 'UE', stemmen: {}, dossier: { dagenStil: 9 }, sluitTs: nu + 3_600_000 });
    h.schrijf('claims.json', { x: { gekerkte: 'UA', dader: 'UB', ts: nu - MIN, soort: 'roof_gelukt' }, y: { gekerkte: 'UA', dader: 'UC', ts: nu - MIN, soort: 'duel_verloren' } });
    h.schrijf('veiling.json', { status: 'open', weekStart: getMondayOfWeek(), artefact: { naam: 'Gouden Spatel', uitleg: 'glanst' }, biedingen: [] });
    h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
    h.schrijf('personas.json', { g1: { naam: 'Gast Een', actief: true, vertrekOp: nu - MIN }, g2: { naam: 'Gast Twee', actief: true, vertrekOp: nu - MIN } });
    h.schrijf('regie.json', { ...leeg(), zaak: { id: `zaak-${nu}`, doel: 'UB', grond: 'kaarten', stemmen: {}, sluitTs: nu + 30 * MIN },
      verrassing: { id: 'hete_kroket', start: nu, tot: nu + 90 * MIN, kanaal: 'CKANAAL', ts: null, data: { houder: 'UA', deadline: nu + 30 * MIN, einde: nu + 90 * MIN, doorgaven: [] } },
      effecten: [{ id: 'dicht', soort: 'dicht', tot: nu + 60 * MIN, data: {} }, { id: `uitdaging_${nu}`, soort: 'uitdaging', tot: nu + 60 * MIN, data: { koploper: 'UA', hekkensluiter: 'UB', gebruikt: false } }] });
    // Twee dagen met een stand: de weekgrafiek heeft dan twee punten.
    const d1 = new Date(Date.parse(`${getMondayOfWeek()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    h.schrijf('puntenhistorie.json', { dagen: { [getMondayOfWeek()]: { UA: 2, UB: 4 }, [d1]: { UA: 5, UB: 4 } } });
  };
  const tekst = (b) => JSON.stringify(b);
  const kinderen = (bl) => bl.flatMap((b) => b.child_blocks || []);
  const ids = (bl) => [...bl, ...kinderen(bl), ...bl.filter((b) => b.type === 'carousel').flatMap((c) => c.elements)]
    .flatMap((b) => [...(b.elements || []), ...(b.actions || []), ...(b.accessory ? [b.accessory] : [])]).map((e) => e.action_id).filter(Boolean);
  const tel = (bl) => bl.reduce((n, b) => n + 1 + (b.child_blocks?.length || 0) + (b.type === 'carousel' ? b.elements.length : 0), 0);
  const idx = (bl, f) => bl.findIndex(f);

  // 1. Volle dag: blokvormen volgens de proef van 17 nov.
  schoon(); vol();
  let bl = bouwAppHome2Blocks('UA');
  const soorten = new Set([...bl, ...kinderen(bl)].map((b) => b.type));
  h.ok(['card', 'carousel', 'container', 'alert', 'table', 'data_visualization'].every((t) => soorten.has(t) || [...bl.filter((b) => b.type === 'carousel').flatMap((c) => c.elements)].some((e) => e.type === t)), `alle 2026-blokken komen voor (${[...soorten]})`);
  const carrousel = bl.find((b) => b.type === 'carousel');
  h.ok(carrousel && carrousel.elements.length >= 1 && carrousel.elements.length <= 10 && carrousel.elements.every((c) => c.type === 'card'), `carrousel met 1-10 kaarten (${carrousel?.elements.length})`);
  const kaart = carrousel.elements[0];
  h.ok(kaart.title?.type === 'plain_text' && kaart.title.text.length <= 150 && kaart.actions.length >= 1 && kaart.actions.length <= 3 && kaart.actions.every((a) => a.type === 'button' && a.action_id), 'kaart: titel en 1-3 knoppen met action_id');
  h.ok(carrousel.elements.every((c) => (!c.body || c.body.text.length <= 200) && (!c.subtitle || c.subtitle.text.length <= 150) && !c.hero_image), 'kaarten: tekstlimieten en (nog) geen hero_image');
  const containers = bl.filter((b) => b.type === 'container');
  h.ok(containers.length >= 4 && containers.every((c) => c.title?.type === 'plain_text' && c.is_collapsible === true && typeof c.default_collapsed === 'boolean' && c.child_blocks.length >= 1 && c.child_blocks.length <= 10), `containers: titel, inklapbaar, <= 10 kinderen (${containers.map((c) => c.title.text).join(' | ')})`);
  h.ok(kinderen(bl).every((k) => !['card', 'carousel', 'data_table', 'data_visualization'].includes(k.type)), 'containers bevatten geen kaart, carrousel of grafiek');
  h.ok(containers.find((c) => c.title.text === 'VANDAAG')?.default_collapsed === false && containers.find((c) => c.title.text === 'UW OPDRACHTEN')?.default_collapsed === false, 'VANDAAG en UW OPDRACHTEN staan open');
  const dicht = containers.filter((c) => c.default_collapsed);
  h.ok(dicht.length >= 4 && ['Ranglijst', 'Spellen', 'Recht', 'status', 'Rijk'].every((t) => dicht.some((c) => c.title.text.includes(t))), `inklapbare secties staan dicht (${dicht.map((c) => c.title.text).join(' | ')})`);
  const alerts = bl.filter((b) => b.type === 'alert');
  h.ok(alerts.length >= 1 && alerts.length <= 3 && alerts.every((a) => ['info', 'warning', 'error', 'success'].includes(a.level) && a.text?.type === 'plain_text' && typeof a.text.text === 'string' && a.text.text.length <= 200), `alerts: hoogstens 3, level + tekst als plain_text-object <= 200 (${alerts.length})`);
  const tabel = kinderen(bl).find((b) => b.type === 'table');
  h.ok(tabel && Array.isArray(tabel.rows) && tabel.rows.length >= 2 && tabel.rows.every((r) => r.every((c) => c.type === 'raw_text' && typeof c.text === 'string')), 'ranglijst als table met raw_text-cellen');
  const grafieken = bl.filter((b) => b.type === 'data_visualization');
  const g = grafieken[0];
  h.ok(grafieken.length === 1 && typeof g.title === 'string' && g.title.length <= 50 && g.chart.type === 'line', 'weekgrafiek: lijn, titel als string <= 50');
  h.ok(g.chart.series.length <= 12 && g.chart.series.every((s) => s.data.length === g.chart.axis_config.categories.length) && g.chart.axis_config.categories.length === 2, 'grafiek: elke reeks één punt per categorie');
  const cats = g.chart.axis_config.categories;
  h.ok(g.chart.series.every((s) => s.data.every((p) => p && typeof p === 'object' && cats.includes(p.label) && typeof p.value === 'number')) && g.chart.series.every((s) => s.data.map((p) => p.label).join() === cats.join()), 'grafiek: elk punt is { label, value } met label uit categories');
  h.ok(tabel.rows.every((r) => r.every((c) => c.type === 'raw_text')) && !tekst(bl).includes('"data_table"'), 'table-cellen raw_text; geen data_table');
  h.ok(tel(bl) < 100, `volle dag: ${tel(bl)} blokken incl. kinderen en kaarten (< 100)`);
  h.ok(carrousel.elements.length + 1 <= 10 + 1 && bl.filter((b) => b.type === 'carousel').length === 1, 'hoogstens 10 kaarten in de carrousel');

  // 2. Geen grafiek zonder twee dagen stand; nooit meer dan twee grafieken.
  h.schrijf('puntenhistorie.json', { dagen: {} });
  h.ok(!bouwAppHome2Blocks('UA').some((b) => b.type === 'data_visualization'), 'zonder dagstanden geen grafiek');
  h.ok(bl.filter((b) => b.type === 'data_visualization').length <= 2, 'hoogstens 2 grafieken');

  // 3. Deadline: alert bovenaan en de knop eronder, vóór de kaarten.
  const iAlert = idx(bl, (b) => b.type === 'alert');
  const iDeadline = idx(bl, (b) => b.type === 'container' && b.title.text.includes('deadlines'));
  const dlContainers = bl.filter((b) => b.type === 'container' && b.title.text.includes('deadlines'));
  const iVandaag = idx(bl, (b) => b.type === 'container' && b.title.text === 'VANDAAG');
  const iKaarten = idx(bl, (b) => b.type === 'carousel');
  h.ok(iAlert >= 0 && iAlert < iDeadline && iDeadline < iVandaag && iVandaag < iKaarten, `volgorde alert < deadlines < VANDAAG < kaarten (${iAlert},${iDeadline},${iVandaag},${iKaarten})`);
  h.ok(/Hete Kroket/.test(alerts.map((a) => a.text.text).join(' ')), 'alert noemt de Hete Kroket');
  const dl = ids(dlContainers);
  h.ok(['regie_hete_kroket', 'regie_zaak_boete', 'regie_uitdaging', 'veiling_bied_1', 'tribunaal_voor', 'claim_vergeven_UB'].every((k) => dl.includes(k)), `deadline-knoppen bereikbaar in de sectie (${dl.join(',')})`);

  // 4. Elke action_id van de klassieke bovenkant blijft werken in 2.0.
  const klassiek = bouwAppHomeBlocks('UA').filter((b) => String(b.block_id || '').startsWith('top_beurt') || String(b.block_id || '').startsWith('top_weekvijand'));
  const klassiekIds = klassiek.flatMap((b) => [...(b.elements || []), ...(b.accessory ? [b.accessory] : [])]).map((e) => e.action_id).filter(Boolean);
  const nieuwIds = new Set(ids(bl));
  h.ok(klassiekIds.length > 5 && klassiekIds.every((i) => nieuwIds.has(i)), `geen actie verdwenen (${klassiekIds.filter((i) => !nieuwIds.has(i))})`);
  h.ok(['home_verversen'].every((i) => nieuwIds.has(i)) && [...nieuwIds].filter((i) => i.startsWith('naslag_')).length >= 15, 'verversknop en de naslag-knoppen van de secties');

  // 5. Weekvijand als kaart met HP en knoppen.
  const vijand = carrousel ? bl.filter((b) => b.type === 'card')[0] : null;
  h.ok(vijand && /AIRFRYER/i.test(vijand.title.text) && /30\/51/.test(vijand.subtitle.text) && vijand.actions.some((a) => a.action_id === 'bamischijf_aanval'), 'weekvijand: kaart met naam, HP en aanvalsknop');

  // 6. Optionele afbeelding voor K3.
  const k3 = bouwAppHome2Blocks('UA', '', [], { beelden: { open_duel: 'https://beeld.voorbeeld.nl/duel.png', weekvijand: 'https://beeld.voorbeeld.nl/vijand.png' } });
  const duelKaart = k3.find((b) => b.type === 'carousel').elements.find((c) => c.actions[0].action_id === 'open_duel');
  h.ok(duelKaart?.hero_image?.type === 'image' && duelKaart.hero_image.image_url === 'https://beeld.voorbeeld.nl/duel.png' && duelKaart.hero_image.alt_text, 'hero_image { type, image_url, alt_text } wanneer er een URL is');
  h.ok(k3.find((b) => b.type === 'card').hero_image?.image_url.endsWith('vijand.png'), 'ook de weekvijandkaart krijgt zijn beeld');
  h.ok(!homeKaart({ titel: 'x', knoppen: [] }).hero_image, 'homeKaart zonder beeld heeft geen hero_image');

  // 6b. Kaartbeelden (K3): zonder cache geen hero_image en geen fout; met cache wel; eenmalig renderen naar R2.
  const { homeBeelden, zorgVoorKaartbeelden } = h.index;
  h.schrijf('kaartbeelden.json', {});
  h.schrijf('bamischijf.json', { actief: true, hp: 30, maxHp: 51, strijders: {}, vijand: { key: 'airfryer_kroket', naam: 'De Airfryer-Kroket' } });
  h.ok(Object.keys(homeBeelden()).length === 0, 'zonder cache geen beelden');
  const kaal = bouwAppHome2Blocks('UA', '', [], { beelden: homeBeelden() });
  h.ok(kaal.find((b) => b.type === 'carousel').elements.every((c) => !c.hero_image) && !kaal.find((b) => b.type === 'card')?.hero_image, 'zonder cache: kaarten zonder hero_image, geen fout');
  const r2Voor = h.r2.length;
  await zorgVoorKaartbeelden();
  const cache = h.lees('kaartbeelden.json');
  h.ok(h.r2.length - r2Voor === 13 && Object.keys(cache).length === 13 && Object.values(cache).every((u) => /^https:\/\/beeld\.voorbeeld\.nl\/home\/[0-9a-f]{40}\.png$/.test(u)), `12 kaartbeelden + 1 vijandportret op R2 onder home/ (${h.r2.length - r2Voor})`);
  h.ok(cache.vijand_airfryer_kroket, 'portret onder vijand_<key>');
  const metBeeld = bouwAppHome2Blocks('UA', '', [], { beelden: homeBeelden() });
  h.ok(metBeeld.find((b) => b.type === 'carousel').elements.every((c) => c.hero_image?.image_url === cache[({ open_raadpleeg: 'raadpleeg', open_duel: 'duel', open_roof: 'roof', open_offer: 'offer', open_casino: 'casino', open_eer: 'eer', open_gunst: 'gunst', open_visioen: 'visioen', open_bingo: 'bingo', open_gok: 'gok' })[c.actions[0].action_id]]), 'met cache: elke kaart krijgt zijn hero_image');
  h.ok(metBeeld.find((b) => b.type === 'card').hero_image.image_url === cache.vijand_airfryer_kroket, 'weekvijandkaart krijgt zijn portret');
  await zorgVoorKaartbeelden();
  h.ok(h.r2.length - r2Voor === 13, 'tweede keer: cache hergebruikt, niets opnieuw gezet');
  schoon(); vol();

  // 7. Verbannen lid: kop, alert, VANDAAG en secties; geen actiekaarten.
  schoon(); vol();
  h.schrijf('verbanning.json', { UA: { tot: new Date(nu + 3_600_000).toISOString() } });
  bl = bouwAppHome2Blocks('UA');
  h.ok(bl[0].type === 'header' && bl.some((b) => b.type === 'alert' && b.level === 'error' && /verbannen/.test(b.text.text)), 'verbannen: kop en alert "verbannen"');
  h.ok(!bl.some((b) => b.type === 'carousel') && !bl.some((b) => b.type === 'container' && b.title.text === 'UW OPDRACHTEN'), 'verbannen: geen kaarten en geen UW OPDRACHTEN');
  h.ok(bl.some((b) => b.type === 'container' && b.title.text === 'VANDAAG') && bl.filter((b) => b.type === 'container' && b.default_collapsed).length >= 4, 'verbannen: wel VANDAAG en de secties');
  h.ok(!ids(bl).some((i) => /^(open_|regie_|veiling_bied|claim_|tribunaal_|gast_vasthouden|handdruk_|bamischijf_)/.test(i)), 'verbannen: geen actieknoppen');
  const nietLid = bouwAppHome2Blocks('UXXX');
  h.ok(nietLid.length === 2 && /geen lid/.test(tekst(nietLid)), 'geen lid: het korte bericht van de klassieke Home');

  // 8. Rustige dag: geen alerts, minder blokken.
  schoon();
  bl = bouwAppHome2Blocks('UA');
  h.ok(!bl.some((b) => b.type === 'alert') && !bl.some((b) => b.type === 'container' && b.title.text.includes('deadlines')) && tel(bl) < 60, `rustige dag: geen alerts, ${tel(bl)} blokken`);

  // 9. Uitrol en terugval via publiceerHome.
  const geplaatst = [];
  let weiger = false;
  const client = new Proxy(h.client, { get: (t, ns) => (ns === 'conversations' ? { members: async () => ({ members: ['UA', 'UB', 'UC', 'UD', 'UE', 'UF', OWNER] }) } : ns === 'views'
    ? { publish: async (a) => { geplaatst.push(a); if (weiger && tekst(a.view.blocks).match(/"type":"(card|carousel|container|alert)"/)) throw Object.assign(new Error('invalid_blocks'), { data: { error: 'invalid_blocks' } }); return { ok: true }; } }
    : t[ns]) });
  const heeft2 = (a) => /"type":"(carousel|container)"/.test(tekst(a.view.blocks));
  schoon();

  h.ok(h.index.STANDAARD_INSTELLINGEN?.homeVersie === 'beta' || require('../../lib/instellingen.js').STANDAARD_INSTELLINGEN.homeVersie === 'beta', 'standaard homeVersie is beta');
  saveInstellingen({ homeVersie: 'onzin' });
  h.ok(h.lees('instellingen.json').homeVersie === undefined || h.lees('instellingen.json').homeVersie === 'beta', 'ongeldige homeVersie wordt geweigerd');
  saveInstellingen({ homeVersie: 'beta' });
  await publiceerHome(client, OWNER);
  await publiceerHome(client, 'UA');
  h.ok(heeft2(geplaatst[0]) && !heeft2(geplaatst[1]), 'beta: alleen de eigenaar krijgt 2.0');
  saveInstellingen({ homeVersie: 'iedereen' });
  geplaatst.length = 0; await publiceerHome(client, 'UA');
  h.ok(geplaatst.length === 1 && heeft2(geplaatst[0]), 'iedereen: een gewoon lid krijgt 2.0');
  saveInstellingen({ homeVersie: 'klassiek' });
  geplaatst.length = 0; await publiceerHome(client, OWNER);
  h.ok(geplaatst.length === 1 && !heeft2(geplaatst[0]), 'klassiek: ook de eigenaar krijgt de klassieke Home');

  // Slack weigert de 2.0-view: het lid krijgt de klassieke Home, geen lege.
  saveInstellingen({ homeVersie: 'iedereen' });
  const echt = console.error; const fouten = [];
  console.error = (...a) => fouten.push(a.join(' '));
  weiger = true; geplaatst.length = 0;
  await publiceerHome(client, 'UA');
  h.ok(geplaatst.length === 2 && heeft2(geplaatst[0]) && !heeft2(geplaatst[1]) && geplaatst[1].view.blocks.length > 5, 'terugval: 2.0 geweigerd, daarna de klassieke Home');
  geplaatst.length = 0;
  await publiceerHome(client, 'UB');
  console.error = echt;
  h.ok(geplaatst.length === 2 && !heeft2(geplaatst[1]), 'terugval werkt voor elk lid, ook bij herhaling');
  h.ok(fouten.filter((f) => /Home 2\.0/.test(f)).length === 1, `de terugvalfout wordt hoogstens één keer per uur gelogd (${fouten.length})`);
  weiger = false;
});
