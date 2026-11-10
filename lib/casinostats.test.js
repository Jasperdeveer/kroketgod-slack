// Tests voor de casinocijfers: boeken, opruimen en samenvatten. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BEWAAR_DAGEN, boekSpel, vatSamen, langsteReeks, feiten, kiesFeiten } = require('./casinostats.js');

test('boeken en samenvatten per spel en per lid', () => {
  let s = {};
  s = boekSpel(s, '2026-10-28', 'A', 'roulette', 2, 0);
  s = boekSpel(s, '2026-10-28', 'A', 'roulette', 1, 36);
  s = boekSpel(s, '2026-10-29', 'B', 'blackjack', 4, 8);
  const alles = vatSamen(s, '2026-10-28', '2026-10-29');
  assert.equal(alles.spellen, 3);
  assert.equal(alles.ingezet, 7);
  assert.equal(alles.uitbetaald, 44);
  assert.equal(alles.netto, 37);
  assert.deepEqual(alles.perSpel.roulette, { spellen: 2, ingezet: 3, uitbetaald: 36 });
  assert.deepEqual(alles.perLid.B, { spellen: 1, ingezet: 4, uitbetaald: 8 });
  assert.deepEqual(alles.grootste, { netto: 35, userId: 'A', spel: 'roulette', dag: '2026-10-28' });
});

test('een periode en één lid', () => {
  let s = {};
  s = boekSpel(s, '2026-10-27', 'A', 'gokkast', 5, 0);
  s = boekSpel(s, '2026-10-28', 'A', 'gokkast', 5, 20);
  s = boekSpel(s, '2026-10-28', 'B', 'dobbelen', 3, 0);
  const a = vatSamen(s, '2026-10-28', '2026-10-28', 'A');
  assert.equal(a.spellen, 1);
  assert.equal(a.netto, 15);
  assert.deepEqual(Object.keys(a.perLid), ['A']);
  assert.equal(vatSamen(s, '2026-10-28', '2026-10-28', 'B').grootste, null); // B won niets
});

test('verlies maakt geen grootste winst', () => {
  const s = boekSpel({}, '2026-10-28', 'A', 'dobbelen', 3, 0);
  assert.equal(s['2026-10-28'].grootste, null);
});

test('alleen de laatste dagen blijven staan', () => {
  let s = boekSpel({}, '2026-08-01', 'A', 'roulette', 1, 0);
  s = boekSpel(s, '2026-10-29', 'A', 'roulette', 1, 0);
  assert.equal(BEWAAR_DAGEN, 60);
  assert.deepEqual(Object.keys(s), ['2026-10-29']);
});

// 5 november 2026: reeksen, bijzondere momenten en de roddels voor het kanaal.
test('reeksen lopen over dagen door, bijzondere momenten tellen per lid', () => {
  let s = {};
  s = boekSpel(s, '2026-11-02', 'A', 'roulette', 1, 2);
  s = boekSpel(s, '2026-11-02', 'A', 'roulette', 1, 2);
  s = boekSpel(s, '2026-11-03', 'A', 'roulette', 1, 36, { bijzonder: 'getal' });
  s = boekSpel(s, '2026-11-03', 'A', 'dobbelen', 2, 2);
  s = boekSpel(s, '2026-11-03', 'B', 'blackjack', 5, 12, { bijzonder: 'blackjack' });
  s = boekSpel(s, '2026-11-04', 'B', 'blackjack', 5, 12, { bijzonder: 'blackjack' });
  s = boekSpel(s, '2026-11-04', 'B', 'hogerlager', 5, 0, { reeks: 3 });
  s = boekSpel(s, '2026-11-04', 'A', 'hogerlager', 5, 50, { reeks: 6, bijzonder: 'plafond' });
  const w = vatSamen(s, '2026-11-02', '2026-11-08');
  assert.deepEqual(w.uitslagen, { A: 'WWWGW', B: 'WWV' });
  assert.deepEqual(langsteReeks(w.uitslagen, 'W'), { n: 3, userId: 'A' });
  assert.deepEqual(w.bijzonder, { getal: { A: 1 }, blackjack: { B: 2 }, plafond: { A: 1 } });
  assert.deepEqual(w.hlReeks, { n: 6, userId: 'A', dag: '2026-11-04' });
  assert.equal(w.zwarteDag, null); // niemand verloor netto op een dag
  assert.deepEqual(vatSamen(s, '2026-11-02', '2026-11-08', 'B').bijzonder, { blackjack: { B: 2 } });
});

test('oude dagen zonder de nieuwe velden tellen gewoon mee', () => {
  const oud = { '2026-10-30': { leden: { A: { gokkast: { spellen: 2, ingezet: 10, uitbetaald: 0 } } }, grootste: null } };
  const w = vatSamen(boekSpel(oud, '2026-10-31', 'A', 'gokkast', 5, 0), '2026-10-30', '2026-10-31');
  assert.equal(w.spellen, 3);
  assert.deepEqual(w.uitslagen, { A: 'V' });
  assert.deepEqual(w.zwarteDag, { netto: -10, userId: 'A', dag: '2026-10-30' });
});

test('feiten: alleen wat er echt is, met namen en plekken van de aanroeper', () => {
  let s = {};
  for (let i = 0; i < 5; i++) s = boekSpel(s, '2026-11-03', 'A', 'gokkast', 5, 0);
  s = boekSpel(s, '2026-11-03', 'B', 'roulette', 1, 36, { bijzonder: 'getal' });
  s = boekSpel(s, '2026-11-03', 'B', 'gokkast', 5, 40, { bijzonder: 'jackpot' });
  s = boekSpel(s, '2026-11-03', 'C', 'schuifkast', 1, 1); // gelijk: verandert niets aan de rest
  s = boekSpel(s, '2026-11-04', 'C', 'schuifkast', 5, 12, { bijzonder: 'lawine' });
  const regels = feiten(vatSamen(s, '2026-11-02', '2026-11-08'), { naam: (id) => `lid ${id}`, plek: (spel) => `de ${spel}` });
  const tekst = regels.join('\n');
  assert.match(tekst, /Grootste klapper:\* lid B won \*\+35\* aan de gokkast|Grootste klapper:\* lid B won \*\+35\* aan de roulette/);
  assert.match(tekst, /Pechvogel:\* lid A liet \*25\* punten achter in 5 spellen/);
  assert.match(tekst, /Koude reeks:\* lid A verloor 5 spellen achter elkaar/);
  assert.match(tekst, /Zwarte dag:\* op dinsdag verloor lid A in het casino \*25\* punten/);
  assert.match(tekst, /Jackpot:\* lid B trok/);
  assert.match(tekst, /Los getal raak:\* lid B\./);
  assert.match(tekst, /Vaste gast:\* lid A speelde 5 van de 9 spellen/);
  assert.match(tekst, /Lawine in de schuifkast:\* lid C\./);
  assert.doesNotMatch(tekst, /Blackjack|Winstreeks|Kaartenlezer|plafond/);
  assert.deepEqual(feiten(vatSamen({}, '2026-11-02', '2026-11-08'), { naam: String, plek: String }), []);
});

test('kiesFeiten: n verschillende regels in de oorspronkelijke volgorde', () => {
  const regels = ['a', 'b', 'c', 'd', 'e'];
  let n = 7;
  const rnd = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 50; i++) {
    const k = kiesFeiten(regels, 3, rnd);
    assert.equal(k.length, 3);
    assert.deepEqual(k, regels.filter(r => k.includes(r)));
  }
  assert.deepEqual(kiesFeiten(['x'], 4, rnd), ['x']);
});
