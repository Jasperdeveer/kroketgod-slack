// Rooktest: een volle werkweek van de regisseur (ma-vr 23-27 nov 2026, elke 20 minuten van 08:00 tot 17:40
// Amsterdam), twee keer: niveau 'normaal' en 'wild'. Controleert de harde plafonds. Run: `ALLEEN=normaal node scripts/rooktest/regie-week.js; ALLEEN=wild node scripts/rooktest/regie-week.js`.
'use strict';
const harnas = require('./harnas.js');
const regieLib = require('../../lib/regie.js');

const DAGEN = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
const LEDEN = ['UA', 'UB', 'UC', 'UD', 'UE', 'UF'];
const SCORES = [4, 12, 25, 40, 50, 70]; // UF staat 20 voor: de koploper komt in aanmerking voor belasting
const BEGIN_UTC = (dag) => Date.parse(`${dag}T00:00:00Z`) - 3_600_000; // 00:00 Amsterdam (november = UTC+1)

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

harnas(async (h) => {
  const { regieTik } = h.index;
  const echteNu = Date.now;
  const gekozen = new Set();
  const t0 = echteNu();

  async function week(niveau, metActiviteit) {
    const rng = mulberry32(niveau === 'wild' ? 7 : 42);
    h.schrijf('instellingen.json', { regieNiveau: niveau, stilModus: false, alleenTestkanaal: false, weekendRust: true });
    h.schrijf('regie.json', { schatkist: 0, effecten: [], log: [], verrassing: null });
    h.schrijf('scores.json', Object.fromEntries(LEDEN.map((id, i) => [id, SCORES[i]])));
    const maxIngrepen = niveau === 'wild' ? 7 : 4;
    const rijen = [];
    let vorigeAantal = 0;
    console.log(`\n== Niveau ${niveau} ==`);
    for (const dag of DAGEN) {
      const start = BEGIN_UTC(dag);
      // Voorwaarden voor beslag, hoge tafel, casino dicht en schorsing: UD won 12 in 16 spellen (winreeks 3), UB had een vergrijp.
      let stats = {}; try { stats = h.lees('casinostats.json'); } catch { /* nog geen bestand */ }
      stats[dag] = { leden: { UD: { gokkast: { spellen: 16, ingezet: 4, uitbetaald: 16 } } }, uitslagen: { UD: 'WWW' } };
      h.schrijf('casinostats.json', stats);
      h.schrijf('vergrijpen.json', { UB: [{ ts: start + 8 * 3_600_000 }] });
      for (let min = 8 * 60; min <= 17 * 60 + 40; min += 20) {
        const nu = start + min * 60_000;
        Date.now = () => nu;
        try {
          if (metActiviteit && rng() < 0.5) { // een lid is actief: bericht of daad
            const act = h.lees('activiteit.json');
            const id = LEDEN[Math.floor(rng() * LEDEN.length)];
            act[id] = { ...(act[id] || {}), laatsteBericht: nu, laatsteDaad: nu };
            h.schrijf('activiteit.json', act);
          }
          if (process.env.DEBUG_TIK) console.error('tik', niveau, new Date(nu).toISOString());
          await regieTik(h.client, { nu, rng });
        } finally { Date.now = echteNu; }
      }
      const staat = h.lees('regie.json');
      const vandaag = (staat.log || []).filter((r) => regieLib.amsMoment(r.ts).dag === dag);
      const ingr = vandaag.filter((r) => r.laag === 'ingreep');
      ingr.forEach((r) => gekozen.add(r.id));
      vandaag.filter((r) => r.laag === 'verrassing').forEach((r) => gekozen.add(r.id));
      const gegeven = vandaag.reduce((a, r) => a + Math.max(0, r.punten || 0), 0);
      const genomen = vandaag.reduce((a, r) => a + Math.max(0, -(r.punten || 0)), 0);
      const perLid = {};
      vandaag.forEach((r) => { if ((r.punten || 0) < 0 && r.doel) perLid[r.doel] = (perLid[r.doel] || 0) + -r.punten; });
      const maxLid = Math.max(0, ...Object.values(perLid));
      const tijden = ingr.map((r) => r.ts).sort((a, b) => a - b);
      const minGap = tijden.length > 1 ? Math.min(...tijden.slice(1).map((t, i) => (t - tijden[i]) / 60_000)) : null;
      const buiten = vandaag.filter((r) => r.laag !== 'nawerking').filter((r) => { const m = regieLib.amsMoment(r.ts).minuut; return m < 8 * 60 + 30 || m > 17 * 60 + 30; });
      const scores = h.lees('scores.json');
      const rij = {
        dag, ingrepen: ingr.map((r) => r.id), praatjes: vandaag.filter((r) => r.laag === 'praatje').length,
        verrassingen: vandaag.filter((r) => r.laag === 'verrassing').length, gegeven, genomen, maxLid,
        schorsingen: vandaag.filter((r) => r.schorsing).length, minGap, laagsteScore: Math.min(...Object.values(scores)),
      };
      rijen.push(rij);
      h.ok(rij.gegeven <= 15, `${niveau} ${dag}: gegeven ${gegeven} <= 15`);
      h.ok(rij.genomen <= 10, `${niveau} ${dag}: genomen ${genomen} <= 10`);
      h.ok(rij.maxLid <= 5, `${niveau} ${dag}: max van een lid ${maxLid} <= 5`);
      h.ok(rij.schorsingen <= 1, `${niveau} ${dag}: schorsingen ${rij.schorsingen} <= 1`);
      h.ok(ingr.length <= maxIngrepen, `${niveau} ${dag}: ingrepen ${ingr.length} <= ${maxIngrepen}`);
      h.ok(rij.praatjes <= 1, `${niveau} ${dag}: praatjes ${rij.praatjes} <= 1`);
      h.ok(minGap === null || minGap >= 45, `${niveau} ${dag}: minimale tussentijd ${minGap ?? '-'} min >= 45`);
      h.ok(buiten.length === 0, `${niveau} ${dag}: geen ingreep of praatje buiten 08:30-17:30`);
      h.ok(rij.verrassingen <= 1, `${niveau} ${dag}: hoogstens een verrassing (${rij.verrassingen})`);
      h.ok(rij.laagsteScore >= 0, `${niveau} ${dag}: laagste score ${rij.laagsteScore} >= 0`);
      vorigeAantal = (staat.log || []).length;
    }
    console.log(`\n${niveau}: datum | ingrepen | praatjes | gegeven | genomen | schorsingen | max lid | min gap`);
    for (const r of rijen) console.log(`${r.dag} | ${r.ingrepen.join(', ') || '-'} | ${r.praatjes} | ${r.gegeven} | ${r.genomen} | ${r.schorsingen} | ${r.maxLid} | ${r.minGap ?? '-'}`);
    return vorigeAantal;
  }

  // Elke run in een eigen proces (ALLEEN=normaal|wild): de gesimuleerde klok vervuilt de providerbank, en daarna hing een tweede run.
  if (process.env.ALLEEN !== 'wild') await week('normaal', true);
  if (process.env.ALLEEN !== 'normaal') await week('wild', true);

  const nooit = regieLib.REGIEBOEK.filter((i) => i.laag === 'ingreep').map((i) => i.id).filter((id) => !gekozen.has(id));
  console.log(`\nNooit gekozen in beide runs: ${nooit.join(', ') || '(geen)'}`);
  console.log(`Looptijd: ${Math.round((echteNu() - t0) / 1000)} s`);
});
