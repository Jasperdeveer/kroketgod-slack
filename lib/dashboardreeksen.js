// ── Dashboard 2.0: de tijdreeksen voor de grafieken (pure kern) ──────────────
//
// Puur: geen I/O en geen klok. index.js leest de statebestanden en geeft ze in `bron` mee; alles wat
// ontbreekt of kapot is geeft de lege standaardwaarde van die reeks, nooit een fout (elke reeks staat
// los achter `veilig`). Dagsleutels zijn Amsterdams ('JJJJ-MM-DD'); de UI maakt er "19 nov" van.
//
// ── twee vormen (voor de UI) ──
//   Reeks over een as:   { labels: string[], reeksen: [{ naam, punten: (number|null)[] }] }
//     punten[i] hoort bij labels[i]; null = geen meting (nog niet verzameld). Voor lijnen, kolommen,
//     de heatmap (labels = kolommen, reeksen = rijen) en gegroepeerde balken (labels = rijen).
//   Rangorde:            [{ label, value, ...extra }]   (aflopend op value), voor horizontale balken.
//
// ── bron ──
//   { nu, naam(id), itemNaam(key), wapenNaam(key), schatkistNu,
//     puntenhistorie, regie, geleKaarten, berichten, winkel, casinostats, raid, llmstats }
//   berichten = archief-entries [{ ts, sprekerId }]; regie = regie.json; raid = bamischijf.json;
//   winkel = winkelhistorie.json. Windows: puntenWeek = deze week, schatkist en gegevenGenomen 21 dagen,
//   de rest 14 dagen of deze week/maand.
'use strict';
const { amsMoment } = require('./regie.js');

const DAG_MS = 86_400_000;
const WEEKDAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const plusDagen = (dag, n) => new Date(Date.parse(`${dag}T12:00:00Z`) + n * DAG_MS).toISOString().slice(0, 10);
const laatsteDagen = (vandaag, n) => Array.from({ length: n }, (_, i) => plusDagen(vandaag, i - (n - 1)));
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const arr = (x) => (Array.isArray(x) ? x : []);
const getal = (x) => (Number.isFinite(x) ? x : 0);
const reeks = (naam, punten) => ({ naam, punten });
const op = (a, b) => b.value - a.value;

const veilig = (fn, leeg) => { try { return fn(); } catch (_) { return leeg; } };

function bouwReeksen(bron = {}) {
  const nu = Number.isFinite(bron.nu) ? bron.nu : 0;
  const naam = typeof bron.naam === 'function' ? bron.naam : (id) => id;
  const vandaag = amsMoment(nu).dag;
  const maandag = plusDagen(vandaag, 1 - amsMoment(nu).weekdag);
  const weekDagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const dagenWeek = new Set(weekDagen);
  const d14 = laatsteDagen(vandaag, 14);
  const d21 = laatsteDagen(vandaag, 21);
  const dagVan = (ts) => amsMoment(ts).dag;
  const regieLog = arr(obj(bron.regie).log).filter((r) => r && Number.isFinite(r.ts));
  const stats = obj(bron.casinostats);
  const hist = obj(bron.puntenhistorie);
  const raid = obj(bron.raid);

  // Spelers: weekscore per lid per dag (de dagstand is al cumulatief over de week).
  const puntenWeek = () => {
    const dagen = obj(hist.dagen);
    const ids = [...new Set(weekDagen.flatMap((d) => Object.keys(obj(dagen[d]))))];
    return { labels: weekDagen, reeksen: ids.map((id) => reeks(naam(id), weekDagen.map((d) => (dagen[d] ? getal(dagen[d][id]) : null)))) };
  };

  // Gemiddeld aantal berichten per weekdag over de laatste 4 weken (28 dagen), per lid.
  const activiteitWeekdag = () => {
    const per = {};
    for (const b of arr(bron.berichten)) {
      if (!b?.sprekerId || !(b.ts > nu - 28 * DAG_MS && b.ts <= nu)) continue;
      const rij = (per[b.sprekerId] ||= [0, 0, 0, 0, 0, 0, 0]);
      rij[amsMoment(b.ts).weekdag - 1]++;
    }
    return { labels: WEEKDAGEN, reeksen: Object.entries(per).map(([id, r]) => reeks(naam(id), r.map((n) => Math.round((n / 4) * 10) / 10))) };
  };

  // Kaarten in de huidige maand: rijen = leden, series = geel en rood.
  const kaartenMaand = () => {
    const maand = vandaag.slice(0, 7);
    const rijen = Object.entries(obj(bron.geleKaarten)).map(([id, dos]) => {
      const k = arr(obj(dos).kaarten).filter((x) => Number.isFinite(x?.ts) && dagVan(x.ts).startsWith(maand));
      const rood = k.filter((x) => x.kleur === 'rood').length;
      return { id, geel: k.length - rood, rood };
    }).filter((r) => r.geel + r.rood > 0).sort((a, b) => (b.geel + b.rood) - (a.geel + a.rood));
    return { labels: rijen.map((r) => naam(r.id)), reeksen: [reeks('geel', rijen.map((r) => r.geel)), reeks('rood', rijen.map((r) => r.rood))] };
  };

  // Schatkist per dag uit de dagstanden; vandaag is de live stand.
  const schatkist = () => {
    const s = obj(hist.schatkist);
    return { labels: d21, reeksen: [reeks('Schatkist', d21.map((d) => (d === vandaag && Number.isFinite(bron.schatkistNu) ? bron.schatkistNu : Number.isFinite(s[d]) ? s[d] : null)))] };
  };

  const gegevenGenomen = () => {
    const dagen = Object.fromEntries(d21.map((d) => [d, { gegeven: 0, genomen: 0 }]));
    for (const r of regieLog) {
      const t = dagen[dagVan(r.ts)];
      if (!t || !Number.isFinite(r.punten)) continue;
      if (r.punten > 0) t.gegeven += r.punten; else t.genomen -= r.punten;
    }
    return { labels: d21, reeksen: [reeks('gegeven', d21.map((d) => dagen[d].gegeven)), reeks('genomen', d21.map((d) => dagen[d].genomen))] };
  };

  const ingrepen = regieLog.filter((r) => r.laag === 'ingreep' && d14.includes(dagVan(r.ts)));
  const ingrepenPerDag = () => {
    const soorten = [...new Set(ingrepen.map((r) => r.soort || 'overig'))].sort();
    return { labels: d14, reeksen: soorten.map((s) => reeks(s, d14.map((d) => ingrepen.filter((r) => (r.soort || 'overig') === s && dagVan(r.ts) === d).length))) };
  };
  const ingrepenPerId = () => {
    const tel = {};
    for (const r of ingrepen) { const t = (tel[r.id] ||= { label: r.id, value: 0, soort: r.soort || 'overig' }); t.value++; }
    return Object.values(tel).sort(op);
  };

  const verrassingen = () => regieLog.filter((r) => r.laag === 'verrassing' && dagenWeek.has(dagVan(r.ts)))
    .map((r) => ({ ts: r.ts, dag: dagVan(r.ts), minuut: amsMoment(r.ts).minuut, id: r.id })).sort((a, b) => a.ts - b.ts);

  const aflaten = () => {
    const tel = {};
    for (const h of arr(obj(bron.winkel).items)) {
      if (!Number.isFinite(h?.ts) || !dagenWeek.has(dagVan(h.ts))) continue;
      const t = (tel[h.item] ||= { label: (bron.itemNaam && bron.itemNaam(h.item)) || h.item, value: 0, verkocht: 0 });
      t.value += getal(h.prijs); t.verkocht++;
    }
    return Object.values(tel).sort(op);
  };

  // Casino: per dag uit casinostats ({ dag: { leden: { id: { spel: { spellen, ingezet, uitbetaald } } } } }).
  const perDagCasino = (d) => {
    const t = { spellen: 0, ingezet: 0, uitbetaald: 0 };
    for (const lid of Object.values(obj(obj(stats[d]).leden))) {
      for (const s of Object.values(obj(lid))) { t.spellen += getal(s.spellen); t.ingezet += getal(s.ingezet); t.uitbetaald += getal(s.uitbetaald); }
    }
    return t;
  };
  const casinoDagen = () => d14.map(perDagCasino);
  const casinoPerDag = () => {
    const c = casinoDagen();
    return { labels: d14, reeksen: [reeks('ingezet', c.map((x) => x.ingezet)), reeks('uitbetaald', c.map((x) => x.uitbetaald)), reeks('spellen', c.map((x) => x.spellen))] };
  };
  const huiswinst = () => {
    let som = 0;
    return { labels: d14, reeksen: [reeks('huiswinst', casinoDagen().map((x) => (som += x.ingezet - x.uitbetaald)))] };
  };
  const spellen = () => {
    const tel = {};
    for (const d of d14) {
      for (const lid of Object.values(obj(obj(stats[d]).leden))) {
        for (const [spel, s] of Object.entries(obj(lid))) { const t = (tel[spel] ||= { label: spel, value: 0, ingezet: 0 }); t.value += getal(s.spellen); t.ingezet += getal(s.ingezet); }
      }
    }
    return Object.values(tel).sort(op);
  };
  const winnaarsVerliezers = () => {
    const tel = {};
    for (const d of weekDagen) {
      for (const [id, lid] of Object.entries(obj(obj(stats[d]).leden))) {
        for (const s of Object.values(obj(lid))) tel[id] = (tel[id] || 0) + getal(s.uitbetaald) - getal(s.ingezet);
      }
    }
    return Object.entries(tel).map(([id, value]) => ({ label: naam(id), value })).sort(op);
  };

  // Weekvijand: HP aan het eind van elke dag van déze vijand (dagstand), met de live stand voor vandaag.
  const weekvijand = () => {
    const key = raid.weekStart || raid.vijand?.key || null;
    const snap = obj(hist.raid);
    const punten = weekDagen.map((d) => {
      if (d === vandaag && key && raid.actief) return getal(raid.hp);
      const s = snap[d];
      return s && key && s.key === key && Number.isFinite(s.hp) ? s.hp : null;
    });
    const schade = Object.entries(obj(raid.strijders)).map(([id, s]) => ({ label: naam(id), value: getal(obj(s).schade) })).filter((r) => r.value > 0).sort(op);
    let tel = obj(raid.wapenTelling);
    if (!Object.keys(tel).length) { // oudere raid: alleen de laatste tien klappen staan in het log
      tel = {};
      for (const k of arr(raid.log)) if (k?.wapen) tel[k.wapen] = (tel[k.wapen] || 0) + 1;
    }
    const wapens = Object.entries(tel).map(([k, value]) => ({ label: (bron.wapenNaam && bron.wapenNaam(k)) || k, value: getal(value) })).sort(op);
    return { labels: weekDagen, reeksen: [reeks('HP', punten)], maxHp: getal(raid.maxHp), schade, wapens };
  };

  const llm = () => {
    const dagen = obj(obj(bron.llmstats).dagen);
    const provs = [...new Set(d14.flatMap((d) => Object.keys(obj(dagen[d]))))].sort();
    return { labels: d14, reeksen: provs.map((p) => reeks(p, d14.map((d) => getal(obj(dagen[d])[p])))) };
  };

  const leeg = (labels) => ({ labels, reeksen: [] });
  return {
    puntenWeek: veilig(puntenWeek, leeg(weekDagen)),
    activiteitWeekdag: veilig(activiteitWeekdag, leeg(WEEKDAGEN)),
    kaartenMaand: veilig(kaartenMaand, leeg([])),
    schatkist: veilig(schatkist, leeg(d21)),
    gegevenGenomen: veilig(gegevenGenomen, leeg(d21)),
    ingrepenPerDag: veilig(ingrepenPerDag, leeg(d14)),
    ingrepenPerId: veilig(ingrepenPerId, []),
    verrassingen: veilig(verrassingen, []),
    aflaten: veilig(aflaten, []),
    casinoPerDag: veilig(casinoPerDag, leeg(d14)),
    huiswinst: veilig(huiswinst, leeg(d14)),
    spellen: veilig(spellen, []),
    winnaarsVerliezers: veilig(winnaarsVerliezers, []),
    weekvijand: veilig(weekvijand, { labels: weekDagen, reeksen: [], maxHp: 0, schade: [], wapens: [] }),
    llm: veilig(llm, leeg(d14)),
  };
}

module.exports = { bouwReeksen };
