// Tests voor de regisseur: de kiezer, de plafonds en de Schatkist. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('./regie.js');
const { REGIEBOEK, kiesIngreep, ruimte, effectActief, voegEffectToe, ruimOp, betaal, stort, boek, boekNawerking, amsMoment, nieuweStaat } = R;

const UUR = 3_600_000;
const DAG = 24 * UUR;
// Amsterdam in november = UTC+1. Dag 16 = maandag, 18 = woensdag, 21 = zaterdag.
const ams = (dag, uur, min = 0) => Date.UTC(2026, 10, dag, uur - 1, min);
const NU = ams(18, 10); // woensdag 10:00

// Een rng die de gegeven waarden na elkaar geeft en daarna de laatste blijft herhalen.
const rngVan = (...w) => { let i = 0; return () => w[Math.min(i++, w.length - 1)]; };
// Trekkingen per tik: verrassing, ingreep, praatje. Daarna 0.
const ROL_INGREEP = () => rngVan(0.99, 0, 0.99, 0);

const lid = (id, o = {}) => ({
  id, score: 10, actiefVandaag: false, werkdagenStil: 0, verbannen: false, afwezig: false, gast: false,
  zegen: false, goudenKorst: false, geleKaartDezeWeek: false, vergrijpVandaag: false,
  casino: { spellen: 0, netto: 0, winreeks: 0 }, duelGewonnenVandaag: false, ...o,
});
const stand = (o = {}) => ({
  leden: [lid('A'), lid('B'), lid('C'), lid('D')],
  casino: { spellenVandaag: 0, open: true },
  raid: { actief: false, hp: 0, maxHp: 0, weekdag: 3, strijders: 0, leden: 4, extraAanvalVandaag: false },
  kanaal: { laatsteLidBerichtMs: NU - 1000 },
  archiefKandidaat: false,
  ...o,
});
const metLid = (id, o) => stand({ leden: stand().leden.map((l) => (l.id === id ? { ...l, ...o } : l)) });
const rij = (o) => ({ ts: NU - 5 * UUR, id: 'x', laag: 'ingreep', doel: null, punten: 0, soort: 'geven', ...o });
const staatMet = (...log) => ({ ...nieuweStaat(), log });
const kies = (st, staat, o = {}) => kiesIngreep(st, staat, { nu: NU, rng: ROL_INGREEP(), niveau: 'normaal', ...o });
const alleen = (id, st, staat, o = {}) => kies(st, staat, { beschikbaar: [id], ...o });

test('niveau uit geeft altijd null', () => {
  assert.equal(kies(stand(), nieuweStaat(), { niveau: 'uit', rng: () => 0 }), null);
  assert.ok(kies(stand(), nieuweStaat(), { niveau: 'normaal' }));
});

test('buiten het venster (weekend, 18:00) geen ingreep, tenzij forceer', () => {
  const zaterdag = ams(21, 10);
  const avond = ams(18, 18);
  assert.equal(kies(stand(), nieuweStaat(), { nu: zaterdag }), null);
  assert.equal(kies(stand(), nieuweStaat(), { nu: avond }), null);
  assert.equal(kies(stand(), nieuweStaat(), { nu: ams(18, 8, 29) }), null);
  assert.ok(kies(stand(), nieuweStaat(), { nu: zaterdag, forceer: true }));
  assert.ok(kies(stand(), nieuweStaat(), { nu: avond, forceer: true }));
});

test('amsMoment: Amsterdamse dag, weekdag, minuut en week, ook over de wintertijdgrens', () => {
  // Zomertijd eindigt zondag 25 oktober 2026 om 01:00 UTC.
  const voor = amsMoment(Date.UTC(2026, 9, 24, 22, 30)); // 00:30 CEST
  const na = amsMoment(Date.UTC(2026, 9, 25, 22, 30)); // 23:30 CET
  assert.deepEqual(voor, { dag: '2026-10-25', weekdag: 7, minuut: 30, week: '2026-W43' });
  assert.deepEqual(na, { dag: '2026-10-25', weekdag: 7, minuut: 23 * 60 + 30, week: '2026-W43' });
  assert.equal(amsMoment(Date.UTC(2026, 9, 25, 23, 30)).dag, '2026-10-26');
  assert.equal(amsMoment(Date.UTC(2026, 9, 26, 7, 0)).weekdag, 1);
});

test('tempo: binnen 45 minuten na de laatste ingreep niets', () => {
  assert.equal(alleen('duelverbod', stand(), staatMet(rij({ ts: NU - 30 * 60_000 })), {}), null);
  assert.ok(alleen('duelverbod', stand(), staatMet(rij({ ts: NU - 50 * 60_000 })), {}));
});

test('dagbudget: 4 ingrepen bij normaal, de vijfde is null; wild laat meer toe', () => {
  const rijen = (n) => Array.from({ length: n }, (_, i) => rij({ ts: NU - (6 - i) * UUR, id: `x${i}` }));
  assert.ok(alleen('duelverbod', stand(), staatMet(...rijen(3))));
  assert.equal(alleen('duelverbod', stand(), staatMet(...rijen(4))), null);
  assert.ok(alleen('duelverbod', stand(), staatMet(...rijen(4)), { niveau: 'wild' }));
  assert.equal(alleen('duelverbod', stand(), staatMet(...rijen(2)), { niveau: 'laag' }), null);
});

test('forceer slaat tempo, budget en niveau uit over', () => {
  const rijen = Array.from({ length: 4 }, (_, i) => rij({ ts: NU - (30 - i) * 60_000, id: `x${i}` }));
  const k = alleen('duelverbod', stand(), staatMet(...rijen), { forceer: true, niveau: 'uit', rng: () => 0 });
  assert.equal(k.ingreep.id, 'duelverbod');
});

test('een doelwit van vandaag wordt niet nog eens gekozen', () => {
  const st = metLid('A', { casino: { spellen: 3, netto: 12, winreeks: 0 } });
  assert.equal(alleen('beslag', st, nieuweStaat()).doel, 'A');
  assert.equal(alleen('beslag', st, staatMet(rij({ doel: 'A', id: 'gunst_stil' }))), null);
});

test('wie gisteren gestraft werd, krijgt vandaag geen straf (een geschenk mag wel)', () => {
  const st = metLid('A', { casino: { spellen: 3, netto: 12, winreeks: 0 } });
  const gisteren = NU - DAG;
  assert.equal(alleen('beslag', st, staatMet(rij({ ts: gisteren, id: 'beslag', doel: 'A', soort: 'nemen', punten: -3 }))), null);
  assert.ok(alleen('beslag', st, staatMet(rij({ ts: gisteren, id: 'gunst_stil', doel: 'A', soort: 'geven' }))));
});

test('plafond: na 10 genomen punten geen nemen-ingreep meer', () => {
  const st = metLid('A', { casino: { spellen: 3, netto: 12, winreeks: 0 } });
  assert.equal(alleen('beslag', st, staatMet(rij({ laag: 'nawerking', doel: 'Z', punten: -10, soort: 'nemen' }))), null);
  // Bij 9 genomen is er nog 1 ruimte: beslag wordt hooguit 1.
  const k = alleen('beslag', st, staatMet(rij({ laag: 'nawerking', doel: 'Z', punten: -9, soort: 'nemen' })));
  assert.equal(k.punten, -1);
});

test('plafond per lid: hoogstens 5 per dag, en nooit onder nul', () => {
  const leider = stand({ leden: [lid('A', { score: 40 }), lid('B', { score: 20 }), lid('C'), lid('D')] });
  assert.equal(alleen('belasting', leider, nieuweStaat()).punten, -4); // 10% van 40
  const k = alleen('belasting', leider, staatMet(rij({ laag: 'nawerking', doel: 'A', punten: -4, soort: 'nemen' })));
  assert.equal(k.punten, -1); // 5 per lid max, 4 al genomen
  const arm = metLid('A', { score: 3, casino: { spellen: 1, netto: 12, winreeks: 0 } });
  assert.equal(alleen('beslag', arm, nieuweStaat()).punten, -3); // 3 punten: neemt hoogstens 3
  assert.equal(alleen('beslag', metLid('A', { score: 2, casino: { spellen: 1, netto: 12, winreeks: 0 } }), nieuweStaat()).punten, -2);
  assert.equal(alleen('beslag', metLid('A', { score: 0, casino: { spellen: 1, netto: 12, winreeks: 0 } }), nieuweStaat()), null);
});

test('plafond: hoogstens 15 punten per dag weggegeven', () => {
  const donderdag = ams(19, 10);
  const geefRij = (p) => rij({ ts: donderdag - 5 * UUR, id: 'x', punten: p, laag: 'nawerking', doel: 'Z' });
  assert.equal(alleen('loterij_gevuld', stand(), staatMet(geefRij(13)), { nu: donderdag }), null);
  assert.equal(alleen('loterij_gevuld', stand(), staatMet(geefRij(12)), { nu: donderdag }).punten, 3);
});

test('plafond: na één schorsing geen tweede', () => {
  const st = metLid('A', { geleKaartDezeWeek: true });
  const k = alleen('schorsing', st, nieuweStaat());
  assert.equal(k.doel, 'A');
  assert.equal(k.duurMinuten, 60);
  const s = boek(nieuweStaat(), k, { nu: NU - 2 * UUR });
  assert.equal(s.log[0].schorsing, true);
  assert.equal(ruimte(s, NU).schorsing, 0);
  assert.equal(alleen('schorsing', metLid('B', { geleKaartDezeWeek: true }), s), null);
  // ook een schorsing als nawerking telt
  const n = boekNawerking(nieuweStaat(), { nu: NU - 2 * UUR, id: 'stadhouder', doel: 'B', schorsing: true });
  assert.equal(ruimte(n, NU).schorsing, 0);
});

test('ballingen, afwezigen en gasten zijn nooit doelwit', () => {
  const netto = { spellen: 3, netto: 12, winreeks: 0 };
  for (const vlag of ['verbannen', 'afwezig', 'gast']) {
    assert.equal(alleen('beslag', metLid('A', { casino: netto, [vlag]: true }), nieuweStaat()), null, vlag);
  }
  const leider = stand({ leden: [lid('A', { score: 60, gast: true }), lid('B', { score: 40 }), lid('C', { score: 10 }), lid('D')] });
  // De gast telt niet mee: B is koploper (40 tegen 10) en wordt belast.
  assert.equal(alleen('belasting', leider, nieuweStaat()).doel, 'B');
});

test('verrassingen: hoogstens 2 per week, niet op dezelfde dag, dezelfde niet binnen 21 dagen', () => {
  const verr = (ts, id) => rij({ ts, id, laag: 'verrassing', soort: 'verrassing' });
  const rolV = () => rngVan(0, 0.99, 0.99, 0);
  const proef = (...log) => alleen('puntenregen', stand(), staatMet(...log), { rng: rolV() });
  assert.equal(proef().ingreep.laag, 'verrassing');
  // Maandag en dinsdag al een verrassing: de week zit vol.
  assert.equal(proef(verr(ams(16, 10), 'raadsel'), verr(ams(17, 10), 'flitsopdracht')), null);
  // Eén eerder deze week mag nog.
  assert.ok(proef(verr(ams(17, 10), 'raadsel')));
  // Vandaag al een verrassing.
  assert.equal(proef(verr(NU - 4 * UUR, 'raadsel')), null);
  // Dezelfde (afkoel 72 uur voor de kleintjes, 21 dagen voor de rest).
  const groot = (...log) => alleen('raadsel', stand(), staatMet(...log), { rng: rolV() });
  assert.equal(groot(verr(NU - 20 * DAG, 'raadsel')), null);
  assert.ok(groot(verr(NU - 22 * DAG, 'raadsel')));
});

test('praatjes: hoogstens 1 per dag, en ze tellen niet voor het dagbudget', () => {
  const rolP = () => rngVan(0.99, 0.99, 0, 0);
  const alleenPraatje = (staat) => alleen('kroketfeitje', stand(), staat, { rng: rolP() });
  assert.equal(alleenPraatje(nieuweStaat()).ingreep.laag, 'praatje');
  assert.equal(alleenPraatje(staatMet(rij({ id: 'gedachte', laag: 'praatje', soort: 'praatje' }))), null);
  // Een praatje in het log eet het dagbudget niet op: 3 ingrepen + 1 praatje, dan nog een ingreep.
  const log = [0, 1, 2].map((i) => rij({ ts: NU - (6 - i) * UUR, id: `x${i}` }));
  log.push(rij({ ts: NU - 2 * UUR, id: 'gedachte', laag: 'praatje', soort: 'praatje' }));
  assert.equal(alleen('duelverbod', stand(), staatMet(...log)).ingreep.id, 'duelverbod');
  // Een vol dagbudget houdt het praatje niet tegen.
  const vol = [0, 1, 2, 3].map((i) => rij({ ts: NU - (6 - i) * UUR, id: `x${i}` }));
  assert.equal(kies(stand(), staatMet(...vol), { beschikbaar: ['kroketfeitje'], rng: rngVan(0.99, 0, 0, 0) }).ingreep.id, 'kroketfeitje');
});

test('forceer zonder ingreep valt terug op een praatje (max 1 per dag), anders null', () => {
  const geen = metLid('A', {});
  const k = kies(geen, nieuweStaat(), { forceer: true, beschikbaar: ['beslag', 'kroketfeitje'], rng: () => 0 });
  assert.equal(k.ingreep.id, 'kroketfeitje');
  const al = staatMet(rij({ id: 'kroketfeitje', laag: 'praatje', soort: 'praatje' }));
  assert.equal(kies(geen, al, { forceer: true, beschikbaar: ['beslag', 'kroketfeitje'], rng: () => 0 }), null);
});

test('forceer slaat de verrassingslaag over', () => {
  const k = kies(stand(), nieuweStaat(), { forceer: true, beschikbaar: ['puntenregen'], rng: () => 0 });
  assert.equal(k, null);
});

test('beschikbaar (array of Set) beperkt de kandidaten', () => {
  const k = (b) => kies(stand(), nieuweStaat(), { forceer: true, beschikbaar: b, rng: () => 0 });
  assert.equal(k(['inflatie']).ingreep.id, 'inflatie');
  assert.equal(k(new Set(['uitverkoop'])).ingreep.id, 'uitverkoop');
});

test('gewogen keuze: rng 0 kiest de eerste, 0,999 de laatste kandidaat', () => {
  const b = ['duelverbod', 'inflatie', 'dubbele_eer'];
  const k = (r) => kies(stand(), nieuweStaat(), { forceer: true, beschikbaar: b, rng: () => r }).ingreep.id;
  assert.equal(k(0), 'duelverbod');
  assert.equal(k(0.999), 'dubbele_eer');
});

test('na een straf krijgen geef-ingrepen dubbel gewicht', () => {
  const dertien = ams(18, 13);
  const b = ['huis_geeft', 'duelverbod']; // gewicht 2 en 1
  const k = (staat) => kies(stand(), staat, { nu: dertien, forceer: true, beschikbaar: b, rng: () => 0.7 }).ingreep.id;
  assert.equal(k(nieuweStaat()), 'duelverbod'); // 0,7 * 3 = 2,1
  assert.equal(k(staatMet(rij({ ts: dertien - 3 * UUR, id: 'beslag', soort: 'nemen', punten: -3, doel: 'Z' }))), 'huis_geeft'); // 0,7 * 5 = 3,5 < 4
});

test('afkoeltijd en maximum per dag per ingreep', () => {
  const eerder = rij({ ts: NU - 3 * UUR, id: 'duelverbod', soort: 'gril' });
  assert.equal(alleen('duelverbod', stand(), staatMet(eerder)), null); // afkoel 12 uur
  assert.ok(alleen('duelverbod', stand(), staatMet({ ...eerder, ts: NU - 13 * UUR })));
});

test('effecten: een lopend effect blokkeert een tweede en een botsend effect', () => {
  const duel = voegEffectToe(nieuweStaat(), { id: 'e1', soort: 'duelverbod', tot: NU + UUR, data: {} });
  assert.equal(alleen('duelverbod', stand(), duel), null);
  const inflatie = voegEffectToe(nieuweStaat(), { id: 'e2', soort: 'inflatie', tot: NU + UUR, data: {} });
  assert.equal(alleen('uitverkoop', stand(), inflatie), null);
});

test('Schatkist: betaal haalt eerst uit de kist en schept de rest; stort verhoogt', () => {
  const s = stort(nieuweStaat(), 4);
  assert.equal(s.schatkist, 4);
  const r = betaal(s, 6);
  assert.deepEqual([r.uitSchatkist, r.geschapen, r.staat.schatkist], [4, 2, 0]);
  const r2 = betaal(s, 3);
  assert.deepEqual([r2.uitSchatkist, r2.geschapen, r2.staat.schatkist], [3, 0, 1]);
  assert.equal(s.schatkist, 4); // geen mutatie
});

test('effectActief en ruimOp', () => {
  let s = voegEffectToe(nieuweStaat(), { id: 'a', soort: 'dicht', tot: NU + 1000, data: { x: 1 } });
  assert.equal(effectActief(s, 'dicht', NU).id, 'a');
  assert.equal(effectActief(s, 'dicht', NU + 1000), null);
  assert.equal(effectActief(s, 'hogeTafel', NU), null);
  s = { ...s, log: [rij({ ts: NU - 20 * DAG }), rij({ ts: NU - 22 * DAG })] };
  const op = ruimOp(s, NU + 2000);
  assert.deepEqual(op.effecten, []);
  assert.equal(op.log.length, 1);
  assert.equal(op.log[0].ts, NU - 20 * DAG);
});

test('boek en boekNawerking schrijven logregels; nawerking telt niet voor het budget', () => {
  const k = alleen('beslag', metLid('A', { casino: { spellen: 3, netto: 12, winreeks: 0 } }), nieuweStaat());
  const s = boek(nieuweStaat(), k, { nu: NU });
  assert.deepEqual(s.log[0], { ts: NU, id: 'beslag', laag: 'ingreep', doel: 'A', punten: -3, soort: 'nemen' });
  const n = boekNawerking(s, { nu: NU, id: 'gunst_stil', doel: 'B', punten: 2 });
  assert.deepEqual(n.log[1], { ts: NU, id: 'gunst_stil', laag: 'nawerking', doel: 'B', punten: 2, soort: 'geven' });
  const r = ruimte(n, NU);
  assert.deepEqual([r.geven, r.nemen, r.nemenVan('A'), r.nemenVan('B')], [13, 7, 2, 5]);
  // Vier nawerkingen vullen het dagbudget niet.
  let m = nieuweStaat();
  for (let i = 0; i < 4; i++) m = boekNawerking(m, { nu: NU - (5 - i) * UUR, id: `n${i}`, punten: 1 });
  assert.ok(alleen('duelverbod', stand(), m));
});

// ── Voorwaarden: per ingreep een ja en een nee ──
const VOORWAARDEN = {
  huis_geeft: { ja: { nu: ams(18, 13) }, nee: [{ nu: ams(18, 13), stand: stand({ casino: { spellenVandaag: 3, open: true } }) }, { nu: ams(18, 11) }] },
  gunst_stil: { ja: { stand: metLid('C', { werkdagenStil: 3 }) }, nee: { stand: metLid('C', { werkdagenStil: 2 }) } },
  loterij_gevuld: { ja: [{ nu: ams(19, 10) }, { nu: ams(20, 15) }], nee: [{ nu: ams(20, 16, 30) }, { nu: ams(18, 10) }] },
  belasting: {
    ja: { stand: stand({ leden: [lid('A', { score: 40 }), lid('B', { score: 25 }), lid('C'), lid('D')] }) },
    nee: { stand: stand({ leden: [lid('A', { score: 40 }), lid('B', { score: 26 }), lid('C'), lid('D')] }) },
  },
  beslag: { ja: { stand: metLid('A', { casino: { spellen: 3, netto: 10, winreeks: 0 } }) }, nee: { stand: metLid('A', { casino: { spellen: 3, netto: 9, winreeks: 0 } }) } },
  schorsing: { ja: [{ stand: metLid('A', { geleKaartDezeWeek: true }) }, { stand: metLid('A', { vergrijpVandaag: true }) }], nee: { stand: stand() } },
  hoge_tafel: {
    ja: [{ stand: stand({ casino: { spellenVandaag: 10, open: true } }) }, { stand: metLid('A', { casino: { spellen: 3, netto: 0, winreeks: 3 } }) }],
    nee: { stand: stand({ casino: { spellenVandaag: 9, open: true } }) },
  },
  casino_dicht: {
    ja: [{ stand: stand({ casino: { spellenVandaag: 15, open: true } }) }, { stand: metLid('A', { casino: { spellen: 3, netto: -10, winreeks: 0 } }) }],
    nee: [{ stand: stand({ casino: { spellenVandaag: 14, open: true } }) }, { nu: ams(18, 16, 45), stand: stand({ casino: { spellenVandaag: 15, open: true } }) }],
  },
  gouden_uur: { ja: {}, nee: { stand: stand({ casino: { spellenVandaag: 0, open: false } }) } },
  duelverbod: { ja: {}, nee: { staat: voegEffectToe(nieuweStaat(), { id: 'e', soort: 'duelverbod', tot: NU + UUR, data: {} }) } },
  inflatie: { ja: {}, nee: { staat: voegEffectToe(nieuweStaat(), { id: 'e', soort: 'uitverkoop', tot: NU + UUR, data: {} }) } },
  uitverkoop: { ja: {}, nee: { staat: voegEffectToe(nieuweStaat(), { id: 'e', soort: 'inflatie', tot: NU + UUR, data: {} }) } },
  dubbele_eer: { ja: {}, nee: { staat: voegEffectToe(nieuweStaat(), { id: 'e', soort: 'dubbeleEer', tot: NU + UUR, data: {} }) } },
  koploper_uitdagen: { ja: {}, nee: { stand: stand({ leden: [lid('A'), lid('B')] }) } },
  extra_aanvalsdag: {
    ja: { stand: stand({ raid: { actief: true, hp: 70, maxHp: 100, strijders: 1, leden: 4, extraAanvalVandaag: false } }) },
    nee: [
      { nu: ams(17, 10), stand: stand({ raid: { actief: true, hp: 70, maxHp: 100, strijders: 1, leden: 4 } }) },
      { stand: stand({ raid: { actief: true, hp: 60, maxHp: 100, strijders: 1, leden: 4 } }) },
      { stand: stand({ raid: { actief: true, hp: 70, maxHp: 100, strijders: 2, leden: 4 } }) },
      { stand: stand({ raid: { actief: true, hp: 70, maxHp: 100, strijders: 1, leden: 4, extraAanvalVandaag: true } }) },
    ],
  },
  hete_kroket: { ja: { stand: stand({ leden: ['A', 'B', 'C', 'D'].map((id, i) => lid(id, { actiefVandaag: i < 3 })) }) }, nee: { stand: stand({ leden: ['A', 'B', 'C', 'D'].map((id, i) => lid(id, { actiefVandaag: i < 2 })) }) } },
  flitsopdracht: { ja: { stand: stand({ leden: ['A', 'B', 'C'].map((id, i) => lid(id, { actiefVandaag: i < 2 })) }) }, nee: { stand: stand({ leden: ['A', 'B', 'C'].map((id, i) => lid(id, { actiefVandaag: i < 1 })) }) } },
  raadsel: { ja: {}, nee: { staat: staatMet(rij({ ts: NU - 2 * DAG, id: 'raadsel', laag: 'verrassing', soort: 'verrassing' })) } },
  stadhouder: { ja: { stand: metLid('B', { actiefVandaag: true }) }, nee: { stand: stand() } },
  herverdeling: {
    ja: { stand: stand({ leden: [lid('A', { score: 60 }), lid('B', { score: 30 }), lid('C', { score: 20 }), lid('D', { score: 19 })] }) },
    nee: { stand: stand({ leden: [lid('A', { score: 60 }), lid('B', { score: 30 }), lid('C', { score: 20 }), lid('D', { score: 20 })] }) },
  },
  archief_spreekt: { ja: { stand: stand({ archiefKandidaat: { tekst: 'x' } }) }, nee: { stand: stand() } },
  bliksem: { ja: { stand: stand({ raid: { actief: true, hp: 50, maxHp: 100, strijders: 1, leden: 4 } }) }, nee: { stand: stand() } },
  omgekeerd_uur: { ja: {}, nee: { staat: voegEffectToe(nieuweStaat(), { id: 'e', soort: 'omgekeerdUur', tot: NU + UUR, data: {} }) } },
  puntenregen: { ja: {}, nee: { staat: staatMet(rij({ ts: NU - DAG, id: 'puntenregen', laag: 'verrassing', soort: 'verrassing' })) } },
  woede_bij_stilte: {
    ja: { stand: stand({ kanaal: { laatsteLidBerichtMs: NU - 3 * UUR } }) },
    nee: [{ stand: stand({ kanaal: { laatsteLidBerichtMs: NU - 2 * UUR } }) }, { stand: stand({ kanaal: { laatsteLidBerichtMs: null } }) }],
  },
  casinoroddel: { ja: { stand: stand({ casino: { spellenVandaag: 1, open: true } }) }, nee: { stand: stand() } },
  kroketfeitje: { ja: {}, nee: { staat: staatMet(rij({ ts: NU - 2 * UUR, id: 'kroketfeitje', laag: 'praatje', soort: 'praatje' })) } },
  gedachte: { ja: {}, nee: { staat: staatMet(rij({ ts: NU - 2 * UUR, id: 'gedachte', laag: 'praatje', soort: 'praatje' })) } },
};

const kan = (id, { stand: st = stand(), nu = NU, staat = nieuweStaat() } = {}) => {
  const laag = REGIEBOEK.find((i) => i.id === id).laag;
  const rng = rngVan(...{ verrassing: [0, 0.99, 0.99], ingreep: [0.99, 0, 0.99], praatje: [0.99, 0.99, 0] }[laag], 0);
  return kiesIngreep(st, staat, { nu, rng, niveau: 'wild', beschikbaar: [id] })?.ingreep.id === id;
};
const lijst = (x) => (Array.isArray(x) ? x : [x]);

for (const [id, { ja, nee }] of Object.entries(VOORWAARDEN)) {
  test(`voorwaarde ${id}`, () => {
    lijst(ja).forEach((o, i) => assert.ok(kan(id, o), `${id} ja #${i}`));
    lijst(nee).forEach((o, i) => assert.equal(kan(id, o), false, `${id} nee #${i}`));
  });
}

test('elke regel in het regieboek heeft een voorwaarde-test en de vereiste velden', () => {
  assert.deepEqual(REGIEBOEK.map((i) => i.id).filter((id) => !VOORWAARDEN[id]), []);
  for (const i of REGIEBOEK) {
    assert.ok(['ingreep', 'verrassing', 'praatje'].includes(i.laag), i.id);
    assert.equal(typeof i.voorwaarde, 'function', i.id);
    assert.equal(typeof i.kiesDoel, 'function', i.id);
    assert.ok(i.gewicht > 0 && i.afkoelUren >= 0 && i.maxPerDag >= 1, i.id);
    assert.equal(typeof i.opdracht, 'string', i.id);
  }
});

test('de belasting noemt de reden en rekent 10% met minimum 2 en maximum 5', () => {
  const k = (score) => alleen('belasting', stand({ leden: [lid('A', { score }), lid('B', { score: 0 }), lid('C', { score: 0 })] }), nieuweStaat());
  assert.equal(k(20).punten, -2);
  assert.equal(k(100).punten, -5);
  assert.match(k(20).reden, /20 punten voor/);
});
