// Tests voor de graafrekenkunde van Het Sociale Weefsel. Pure functies, geen state.
// Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  randSleutel,
  telRand,
  warmte,
  wrijving,
  graadPerLid,
  paren,
  sterksteBand,
  grootsteVete,
  meestScheef,
  spil,
  eenlingen,
  relatiesVan,
} = require('./weefsel');

const LEDEN = ['A', 'B', 'C', 'D'];

// Handige bouwer: randen({'A>B': {eer: 3}, ...})
function randen(obj) { return obj; }

// ── Basis ──────────────────────────────────────────────────────────────────────

test('randSleutel is gericht', () => {
  assert.equal(randSleutel('A', 'B'), 'A>B');
  assert.notEqual(randSleutel('A', 'B'), randSleutel('B', 'A'));
});

test('telRand en warmte lezen een ontbrekende rand als nul', () => {
  assert.equal(telRand({}, 'A', 'B', 'eer'), 0);
  assert.equal(warmte({}, 'A', 'B'), 0);
  assert.equal(wrijving({}, 'A', 'B'), 0);
  assert.equal(warmte(undefined, 'A', 'B'), 0);
});

test('warmte komt alleen van eer, wrijving alleen van de rest', () => {
  const r = randen({ 'A>B': { eer: 3, duel_win: 2, roof: 1 } });
  assert.equal(warmte(r, 'A', 'B'), 3);
  // duel 2×0,5 + roof 1×1,5 = 2,5
  assert.equal(wrijving(r, 'A', 'B'), 2.5);
});

test('een roof weegt zwaarder dan een duel — een duel kozen beiden', () => {
  const duel = randen({ 'A>B': { duel_win: 1 } });
  const roof = randen({ 'A>B': { roof: 1 } });
  assert.ok(wrijving(roof, 'A', 'B') > wrijving(duel, 'A', 'B'));
});

test('een vloek weegt NIET mee — die is anoniem en zou via het paar uitlekken', () => {
  // Zie de waarschuwing bij SOORTEN: dit is een privacygrens, geen vergeten soort.
  const r = randen({ 'A>B': { vloek: 5 } });
  assert.equal(wrijving(r, 'A', 'B'), 0);
  assert.equal(grootsteVete(r, LEDEN), null);
});

// ── Graad per lid ──────────────────────────────────────────────────────────────

test('graadPerLid splitst geven en krijgen', () => {
  const r = randen({ 'A>B': { eer: 3 }, 'B>A': { eer: 1 }, 'C>A': { roof: 1 } });
  const g = graadPerLid(r, LEDEN);
  assert.equal(g.A.warmGegeven, 3);
  assert.equal(g.A.warmOntvangen, 1);
  assert.equal(g.A.wrijvingOntvangen, 1.5);
  assert.equal(g.B.warmGegeven, 1);
  assert.equal(g.B.warmOntvangen, 3);
});

test('stilte telt de medeleden die je nooit hebt geëerd', () => {
  const r = randen({ 'A>B': { eer: 1 } });
  const g = graadPerLid(r, LEDEN);
  assert.equal(g.A.stilte, 2); // A eerde B wel, C en D nooit
  assert.equal(g.D.stilte, 3); // D eerde niemand
});

test('graadPerLid negeert een lid dat zichzelf zou eren', () => {
  const g = graadPerLid(randen({ 'A>A': { eer: 9 } }), LEDEN);
  assert.equal(g.A.warmGegeven, 0);
  assert.equal(g.A.warmOntvangen, 0);
});

// ── Paren ──────────────────────────────────────────────────────────────────────

test('paren levert één regel per paar, niet per richting', () => {
  const p = paren({}, LEDEN);
  assert.equal(p.length, 6); // 4 leden → 6 paren
});

test('een band vraagt wederkerigheid: eenzijdige bewondering telt niet', () => {
  const eenzijdig = randen({ 'A>B': { eer: 10 } });
  assert.equal(sterksteBand(eenzijdig, LEDEN), null);
  const wederkerig = randen({ 'A>B': { eer: 2 }, 'B>A': { eer: 2 } });
  const band = sterksteBand(wederkerig, LEDEN);
  assert.equal(band.band, 2);
});

test('de sterkste band is die met de hoogste wederkerige ondergrens', () => {
  const r = randen({
    'A>B': { eer: 9 }, 'B>A': { eer: 1 },  // scheef: band = 1
    'C>D': { eer: 3 }, 'D>C': { eer: 4 },  // wederkerig: band = 3
  });
  const band = sterksteBand(r, LEDEN);
  assert.deepEqual([band.a, band.b].sort(), ['C', 'D']);
  assert.equal(band.band, 3);
});

test('de grootste vete telt wrijving in beide richtingen', () => {
  const r = randen({ 'A>B': { roof: 1 }, 'B>A': { roof: 1 }, 'C>D': { duel_win: 2 } });
  const vete = grootsteVete(r, LEDEN);
  assert.deepEqual([vete.a, vete.b].sort(), ['A', 'B']);
  assert.equal(vete.vete, 3); // roof 1,5 + roof 1,5, meer dan 2 duels (1)
});

test('geen wrijving of geen band levert null, geen fout', () => {
  assert.equal(grootsteVete({}, LEDEN), null);
  assert.equal(sterksteBand({}, LEDEN), null);
  assert.equal(spil({}, LEDEN), null);
  assert.equal(meestScheef({}, LEDEN), null);
});

test('meestScheef zet de gever vooraan, ongeacht de paarvolgorde', () => {
  // B geeft veel aan A; het paar wordt intern als (A,B) opgeslagen.
  const r = randen({ 'B>A': { eer: 7 }, 'A>B': { eer: 1 } });
  const s = meestScheef(r, LEDEN);
  assert.equal(s.a, 'B', 'wie het meest geeft hoort vooraan te staan');
  assert.equal(s.b, 'A');
  assert.equal(s.warmAB, 7);
  assert.equal(s.warmBA, 1);
});

test('meestScheef negeert kleine verschillen', () => {
  const r = randen({ 'A>B': { eer: 2 }, 'B>A': { eer: 1 } });
  assert.equal(meestScheef(r, LEDEN, 2), null); // verschil 1 < drempel 2
  assert.ok(meestScheef(r, LEDEN, 1));
});

// ── Spil en eenlingen ──────────────────────────────────────────────────────────

test('de spil is het lid met het meeste contact in beide richtingen', () => {
  const r = randen({
    'A>B': { eer: 2 }, 'B>A': { eer: 2 },
    'A>C': { eer: 2 }, 'C>A': { eer: 1 },
    'A>D': { eer: 1 },
  });
  assert.equal(spil(r, LEDEN).id, 'A');
});

test('eenlingen zijn leden die door niemand geëerd zijn', () => {
  const r = randen({ 'A>B': { eer: 1 }, 'B>A': { eer: 1 }, 'A>C': { eer: 1 } });
  assert.deepEqual(eenlingen(r, LEDEN), ['D']);
});

test('wrijving maakt je geen eenling — alleen het ontbreken van eer', () => {
  const r = randen({ 'A>D': { roof: 3 } });
  assert.ok(eenlingen(r, LEDEN).includes('D'), 'beroofd worden is geen eer');
});

test('in een volledig stille groep is iedereen een eenling', () => {
  assert.deepEqual(eenlingen({}, LEDEN), LEDEN);
});

// ── Relaties van één lid ───────────────────────────────────────────────────────

test('relatiesVan geeft alleen leden met daadwerkelijk contact, drukste eerst', () => {
  const r = randen({
    'A>B': { eer: 1 }, 'B>A': { eer: 1 },   // contact 2
    'A>C': { eer: 3 }, 'C>A': { eer: 2 },   // contact 5
  });
  const rel = relatiesVan(r, LEDEN, 'A');
  assert.deepEqual(rel.map(x => x.id), ['C', 'B']);
  assert.equal(rel[0].gegeven, 3);
  assert.equal(rel[0].ontvangen, 2);
});

test('relatiesVan bevat zichzelf nooit', () => {
  const r = randen({ 'A>A': { eer: 5 }, 'A>B': { eer: 1 } });
  assert.deepEqual(relatiesVan(r, LEDEN, 'A').map(x => x.id), ['B']);
});

test('relatiesVan is leeg voor een lid zonder enig contact', () => {
  assert.deepEqual(relatiesVan(randen({ 'A>B': { eer: 1 } }), LEDEN, 'D'), []);
});

test('alle metingen zijn bestendig tegen rommelige tellers', () => {
  const r = randen({ 'A>B': { eer: 'twee', duel_win: null, roof: undefined } });  // rommel
  assert.equal(warmte(r, 'A', 'B'), 0);
  assert.equal(wrijving(r, 'A', 'B'), 0);
  assert.equal(spil(r, LEDEN), null);
});
