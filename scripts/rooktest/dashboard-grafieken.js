// Rooktest: de pure kern van dashboard.html (grafieken, tegels, lijsten, formulieren) op echte
// bouwDashboardData()-uitvoer, met lege en gevulde state, en de bediening in de juiste sectie.
// Run: `node scripts/rooktest/dashboard-grafieken.js`.
'use strict';
const harnas = require('./harnas.js');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');
const K = vm.runInNewContext(html.match(/<script id="kern">([\s\S]*?)<\/script>/)[1]
  + '\n;({ SECS, SKEL, grafieken, teken, tabel, isLeeg, kpis, lijsten, formulieren, badges })', {});
const LEEG = /nog geen data/;
const ROMMEL = /NaN|undefined|Infinity|\[object /;
const GRAFIEKEN = ['ranglijst', 'puntenWeek', 'activiteit', 'kaarten', 'soorten', 'groei', 'schatkist', 'gegevenGenomen', 'aflaten',
  'casinoInUit', 'huiswinst', 'spellen', 'winnaars', 'ingrepenPerDag', 'ingrepenPerId', 'verrassingen', 'hp', 'schade', 'wapens', 'llm'];
const UIT_REEKSEN = GRAFIEKEN.filter((k) => !['ranglijst', 'soorten', 'groei', 'schatkist'].includes(k));

harnas(async (h) => {
  const { bouwDashboardData, legDagstandVast, dagSleutel, regieStaat, bewaarRegie, getMondayOfWeek } = h.index;
  const data = async () => JSON.parse(JSON.stringify(await bouwDashboardData())); // precies wat de browser krijgt

  // Alles uit de kern draait zonder fout, op telefoon- en desktopbreedte, en zonder NaN/undefined in de html.
  function controleer(d, wat) {
    const fout = [];
    const g = K.grafieken(d);
    for (const [k, s] of Object.entries(g)) {
      for (const w of [300, 640, 1100]) {
        try {
          const r = K.teken(s, w);
          if (ROMMEL.test(r.html)) fout.push(`${k}@${w}: ${r.html.match(ROMMEL)[0]}`);
          for (const m of r.html.matchAll(/data-i="([^"]+)"/g)) if (ROMMEL.test(JSON.stringify(r.tip(m[1])))) fout.push(`${k}@${w}: tooltip ${m[1]}`);
          for (const m of r.html.matchAll(/<svg width="([\d.]+)"/g)) if (+m[1] > w) fout.push(`${k}@${w}: svg ${m[1]} breder dan de kaart`);
        } catch (e) { fout.push(`${k}@${w} gooit: ${e.message}`); }
      }
      try { if (ROMMEL.test(K.tabel(s))) fout.push(`tabel ${k}`); } catch (e) { fout.push(`tabel ${k} gooit: ${e.message}`); }
    }
    for (const f of ['kpis', 'lijsten', 'formulieren', 'badges']) {
      try { for (const [k, v] of Object.entries(K[f](d))) if (ROMMEL.test(v)) fout.push(`${f}.${k}: ${String(v).match(ROMMEL)[0]}`); } catch (e) { fout.push(`${f} gooit: ${e.message}`); }
    }
    h.ok(!fout.length, `${wat}: kern rendert zonder fout${fout.length ? ' — ' + fout.slice(0, 6).join('; ') : ''}`);
    return g;
  }

  // 1. Lege state.
  for (const f of ['casinostats.json', 'winkelhistorie.json', 'llmstats.json', 'geleKaarten.json', 'bamischijf.json']) { try { fs.unlinkSync(path.join(h.state, f)); } catch (_) {} }
  h.schrijf('puntenhistorie.json', {});
  let d = await data();
  let g = controleer(d, 'leeg');
  h.ok(JSON.stringify(Object.keys(g).sort()) === JSON.stringify([...GRAFIEKEN].sort()), `alle grafieken (${Object.keys(g).join(',')})`);
  const skelet = Object.values(K.SKEL).join('');
  h.ok(GRAFIEKEN.every((k) => skelet.includes(`data-c="${k}"`)) && (skelet.match(/data-c="/g) || []).length === GRAFIEKEN.length, 'elke grafiek heeft precies één kaart in het skelet');
  const nietLeeg = UIT_REEKSEN.filter((k) => !LEEG.test(K.teken(g[k], 640).html) || !LEEG.test(K.tabel(g[k])));
  h.ok(!nietLeeg.length, `lege reeksen tonen "nog geen data" (${nietLeeg.join(',') || 'alle'})`);
  controleer({ ...d, reeksen: undefined }, 'zonder reeksen');

  // 2. Bediening in de juiste sectie; panelen dicht, de strook Nu bezig open.
  const f = K.formulieren(d);
  const l = K.lijsten(d);
  const sectie = (s) => K.SKEL[s] + Object.entries({ ...f, ...l }).filter(([id]) => K.SKEL[s].includes(`id="${id}"`)).map(([, v]) => v).join('');
  const act = (...a) => a.map((x) => `data-actie="${x}"`);
  const plek = {
    live: ['id="nubezig"', 'id="i_regieNiveau"', ...act('regisseurNu', 'kroketVanDeDag', 'quizStarten', 'quizOnthul'), 'Wat de Kroket God vandaag deed'],
    spelers: ['data-do="score"', 'data-eer', 'id="e_gever"', 'id="e_reden"', 'id="r-bans"', 'id="r-verbonden"',
      ...act('activiteitBackfill', 'tribunaalKlok', 'gelekaartSluiten', 'groteAmnestie', 'archiefHerstelLaatste')],
    economie: ['data-winkel="geef"', 'data-winkel="verwijder"', 'id="w_lid"', 'id="w_item"', 'id="w_aankondig"', 'id="r-winkel"'],
    casino: ['id="i_casinoAan"', 'id="i_casinoMax"', 'id="i_casinoPerDag"', 'id="i_casinoBonus"', 'data-do="bonus"', 'id="r-gokpauze"', 'data-save'],
    regisseur: ['data-do="niveau"', 'id="r-effecten"'],
    weekvijand: act('bamischijfSpawn', 'weekvijandSpreekt', 'weekvijandBeurt', 'bamischijfOntsnap', 'veilingOpen', 'veilingHamer',
      'seizoenSync', 'seizoenGeveld', 'seizoenVerloren', 'wereldbordVerversen', 'wereldOnderwerp'),
    systeem: ['id="i_stemming"', 'id="i_stil"', 'data-prov', 'id="i_decreet"', 'id="i_huis"', 'id="i_decreetInt"', 'data-save',
      ...act('resetCooldowns', 'ververseQuota', 'statusMeldingen', 'appHomeVerversen'), 'id="i_v_in"', 'id="i_v_out"', 'data-verkondig="plan"',
      'id="r-gepland"', 'id="g_naam"', 'data-gast-uitnodigen', 'id="p_naam"', 'data-persona-save', 'id="persona_lijst"', 'id="test_prompt"', 'data-test',
      'id="logzoek"', 'id="c_logs"', 'id="r-quota"'],
  };
  for (const [s, lijst] of Object.entries(plek)) {
    const x = sectie(s);
    const mist = lijst.filter((n) => !x.includes(n));
    h.ok(!mist.length, `${s}: bediening op zijn plek${mist.length ? ' — mist ' + mist.join(', ') : ''}`);
  }
  h.ok(!/<details[^>]*\bopen\b/.test(skelet), 'alle panelen staan standaard dicht');
  const voorStrook = K.SKEL.live.slice(0, K.SKEL.live.indexOf('id="nubezig"'));
  h.ok((voorStrook.match(/<details/g) || []).length === (voorStrook.match(/<\/details>/g) || []).length, 'de strook Nu bezig staat niet in een dichtgeklapt paneel');

  // 3. Gevulde state (ook een korte reeks: de weekvijand-HP heeft alleen vandaag een punt).
  const nu = Date.now();
  const vandaag = dagSleutel();
  h.schrijf('casinostats.json', { [vandaag]: { leden: { UA: { slots: { spellen: 2, ingezet: 4, uitbetaald: 1 } }, UB: { blackjack: { spellen: 1, ingezet: 2, uitbetaald: 4 } } } } });
  h.schrijf('llmstats.json', { dagen: { [vandaag]: { gemini: 5, groq: 2 } } });
  h.schrijf('winkelhistorie.json', { items: [{ ts: nu, koperId: 'UA', item: 'schild', prijs: 5, bron: 'slack' }] });
  h.schrijf('geleKaarten.json', { UB: { kaarten: [{ ts: nu, kleur: 'rood' }, { ts: nu, kleur: 'geel' }] } });
  h.schrijf('bamischijf.json', { actief: true, hp: 40, maxHp: 85, weekStart: getMondayOfWeek(), vijand: { key: 'x', naam: 'Testvijand' },
    strijders: { UA: { schade: 30 }, UB: { schade: 15 } }, wapenTelling: { knots: 3 } });
  bewaarRegie({ ...regieStaat(), schatkist: 9, effecten: [{ id: 'dicht', soort: 'dicht', tot: nu + 3_600_000, data: {} }],
    log: [{ ts: nu, id: 'zegen', laag: 'ingreep', soort: 'geven', doel: 'UA', punten: 3 }, { ts: nu - 60_000, id: 'puntenregen', laag: 'verrassing', punten: -2 }] });
  legDagstandVast();
  d = await data();
  d.reeksen.activiteitWeekdag = { labels: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], reeksen: [{ naam: 'Alfa', punten: [1, 2, 0, 0.5, 0, 0, 0] }] }; // het rooktest-archief is leeg
  g = controleer(d, 'gevuld');
  const leeg = GRAFIEKEN.filter((k) => K.isLeeg(g[k]) || !/<svg/.test(K.teken(g[k], 640).html));
  h.ok(!leeg.length, `gevuld: elke grafiek tekent (${leeg.join(',') || 'alle'})`);
  const nb = K.lijsten(d).nb_items;
  h.ok(/data-do="effectStop" data-id="dicht"/.test(nb) && /data-actie="weekvijandBeurt"/.test(nb), 'Nu bezig: effect en weekvijand met hun knoppen');
});
