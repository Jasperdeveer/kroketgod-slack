// Tests voor het ontleden van "wanneer" in De Tijdcapsule. Pure functies, geen state.
// Run: `npm test` of `node --test`.
//
// Alle tests werken met een VAST referentiemoment (`NU`), zodat ze niet omvallen zodra de dag
// rolt — de les uit de eerdere missietests: test op invarianten, niet op de kalender van vandaag.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_HORIZON_DAGEN,
  amsDelen,
  eindeVanDag,
  dagenErbij,
  maandenErbij,
  volgendeWeekdag,
  parseerWanneer,
} = require('./tijdcapsule');

// Woensdag 12 augustus 2026, 10:00 Amsterdamse tijd (zomertijd, UTC+2).
const NU = Date.UTC(2026, 7, 12, 8, 0);

const DAG = 86_400_000;

// ── Tijdrekenen ────────────────────────────────────────────────────────────────

test('amsDelen leest de Amsterdamse wandklok, niet UTC', () => {
  const d = amsDelen(NU);
  assert.equal(d.jaar, 2026);
  assert.equal(d.maand, 8);
  assert.equal(d.dag, 12);
  assert.equal(d.uur, 10);        // 08:00 UTC = 10:00 in zomertijd
  assert.equal(d.weekdag, 3);     // woensdag
});

test('eindeVanDag valt op 23:59 Amsterdamse tijd', () => {
  const d = amsDelen(eindeVanDag(2026, 8, 12));
  assert.equal(d.dag, 12);
  assert.equal(d.uur, 23);
  assert.equal(d.minuut, 59);
});

test('dagenErbij loopt netjes over een maandgrens', () => {
  const d = amsDelen(dagenErbij(Date.UTC(2026, 7, 30, 8, 0), 3)); // 30 aug + 3
  assert.equal(d.maand, 9);
  assert.equal(d.dag, 2);
});

test('dagenErbij loopt netjes over een jaargrens', () => {
  const d = amsDelen(dagenErbij(Date.UTC(2026, 11, 30, 8, 0), 3)); // 30 dec + 3
  assert.equal(d.jaar, 2027);
  assert.equal(d.dag, 2);
});

test('dagenErbij klopt over de zomertijdwissel heen', () => {
  // Zomertijd eindigt op zondag 25 oktober 2026. Een dag erbij hoort een dag te zijn, ook al
  // duurt die nacht 25 uur — en het resultaat blijft 23:59 lokale tijd.
  const d = amsDelen(dagenErbij(Date.UTC(2026, 9, 24, 10, 0), 1));
  assert.equal(d.dag, 25);
  assert.equal(d.uur, 23);
  assert.equal(d.minuut, 59);
});

test('maandenErbij levert altijd een bestaande datum op', () => {
  // 31 januari + 1 maand bestaat niet; het resultaat mag doorklappen maar nooit ongeldig zijn.
  const d = amsDelen(maandenErbij(Date.UTC(2026, 0, 31, 8, 0), 1));
  assert.ok(d.dag >= 1 && d.dag <= 31);
  assert.ok(d.maand === 2 || d.maand === 3);
});

test('volgendeWeekdag slaat vandaag over', () => {
  // NU is woensdag. "woensdag" hoort een week verder te liggen, niet vandaag.
  const d = amsDelen(volgendeWeekdag(NU, 3));
  assert.equal(d.dag, 19);
  // Vrijdag hoort deze week te zijn.
  assert.equal(amsDelen(volgendeWeekdag(NU, 5)).dag, 14);
});

// ── "over N ..." ───────────────────────────────────────────────────────────────

test('over N dagen/weken/maanden', () => {
  const dagen = parseerWanneer('over 3 dagen de kroket wordt heilig', NU);
  assert.equal(amsDelen(dagen.deadline).dag, 15);
  assert.equal(dagen.rest, 'de kroket wordt heilig');

  const weken = parseerWanneer('over 2 weken iets gebeurt', NU);
  assert.equal(amsDelen(weken.deadline).dag, 26);

  const maand = parseerWanneer('over 1 maand iets gebeurt', NU);
  assert.equal(amsDelen(maand.deadline).maand, 9);
});

test('over "twee" weken werkt net als over 2 weken', () => {
  const a = parseerWanneer('over twee weken zoiets', NU);
  const b = parseerWanneer('over 2 weken zoiets', NU);
  assert.equal(a.deadline, b.deadline);
});

test('enkelvoud en meervoud worden beide begrepen', () => {
  assert.ok(parseerWanneer('over 1 dag zoiets', NU).deadline);
  assert.ok(parseerWanneer('over 1 week zoiets', NU).deadline);
  assert.ok(parseerWanneer('over 2 maanden zoiets', NU).deadline);
});

test('"week" en "weken" leveren dezelfde termijn per eenheid', () => {
  // De val die dit ving: het meervoud van "week" is "weken" — de e verhuist, dus een
  // prefix-check op "week" faalt op het meervoud en gaf stilzwijgend een maand-termijn.
  assert.equal(
    parseerWanneer('over 1 week zoiets', NU).deadline,
    parseerWanneer('over 1 weken zoiets', NU).deadline);
  assert.equal(amsDelen(parseerWanneer('over 1 weken zoiets', NU).deadline).dag, 19);
});

test('elke tijdseenheid geeft een andere, oplopende termijn', () => {
  const dag = parseerWanneer('over 2 dagen x', NU).deadline;
  const week = parseerWanneer('over 2 weken x', NU).deadline;
  const maand = parseerWanneer('over 2 maanden x', NU).deadline;
  assert.ok(dag < week && week < maand, 'dagen < weken < maanden');
});

// ── Losse aanduidingen ─────────────────────────────────────────────────────────

test('morgen en overmorgen', () => {
  assert.equal(amsDelen(parseerWanneer('morgen regent het ragout', NU).deadline).dag, 13);
  assert.equal(amsDelen(parseerWanneer('overmorgen regent het ragout', NU).deadline).dag, 14);
});

test('overmorgen wordt niet als "morgen" gelezen', () => {
  // Zou fout gaan als de morgen-check vóór overmorgen staat.
  const r = parseerWanneer('overmorgen iets', NU);
  assert.equal(r.rest, 'iets');
  assert.equal(amsDelen(r.deadline).dag, 14);
});

test('volgende week en volgende maand', () => {
  assert.equal(amsDelen(parseerWanneer('volgende week iets', NU).deadline).dag, 19);
  assert.equal(amsDelen(parseerWanneer('volgende maand iets', NU).deadline).maand, 9);
});

test('een weekdagnaam', () => {
  const r = parseerWanneer('vrijdag valt de frituur stil', NU);
  assert.equal(amsDelen(r.deadline).dag, 14);
  assert.equal(r.rest, 'valt de frituur stil');
});

// ── Datums ─────────────────────────────────────────────────────────────────────

test('dag + maandnaam', () => {
  const r = parseerWanneer('31 december alles is anders', NU);
  const d = amsDelen(r.deadline);
  assert.equal(d.dag, 31);
  assert.equal(d.maand, 12);
  assert.equal(d.jaar, 2026);
  assert.equal(r.rest, 'alles is anders');
});

test('een al verstreken datum zonder jaartal schuift naar volgend jaar', () => {
  const r = parseerWanneer('3 maart iets', NU); // 3 maart 2026 is al voorbij
  assert.equal(amsDelen(r.deadline).jaar, 2027);
});

test('een expliciet jaartal wordt gerespecteerd', () => {
  const r = parseerWanneer('31 december 2026 iets', NU);
  assert.equal(amsDelen(r.deadline).jaar, 2026);
  assert.equal(r.rest, 'iets');
});

test('cijferdatums met streep en slash', () => {
  for (const invoer of ['31-12 iets', '31/12 iets']) {
    const d = amsDelen(parseerWanneer(invoer, NU).deadline);
    assert.equal(d.dag, 31);
    assert.equal(d.maand, 12);
  }
});

test('een cijferdatum met jaartal', () => {
  const d = amsDelen(parseerWanneer('01-02-2027 iets', NU).deadline);
  assert.equal(d.jaar, 2027);
  assert.equal(d.maand, 2);
  assert.equal(d.dag, 1);
});

// ── Weigeringen ────────────────────────────────────────────────────────────────

test('een moment zonder voorspelling wordt geweigerd', () => {
  assert.match(parseerWanneer('over 2 weken', NU).fout, /geen voorspelling/i);
  assert.match(parseerWanneer('vrijdag', NU).fout, /geen voorspelling/i);
});

test('onleesbare invoer krijgt een uitleg met voorbeelden', () => {
  const r = parseerWanneer('binnenkort gebeurt er iets', NU);
  assert.ok(r.fout);
  assert.match(r.fout, /over 2 weken/);
});

test('lege invoer wordt geweigerd', () => {
  assert.ok(parseerWanneer('', NU).fout);
  assert.ok(parseerWanneer(null, NU).fout);
  assert.ok(parseerWanneer('   ', NU).fout);
});

test('te ver vooruit wordt geweigerd', () => {
  const r = parseerWanneer('over 500 dagen iets', NU);
  assert.match(r.fout, new RegExp(String(MAX_HORIZON_DAGEN)));
});

test('een datum in het verleden mét jaartal wordt geweigerd', () => {
  const r = parseerWanneer('01-01-2020 iets', NU);
  assert.match(r.fout, /voorbij/i);
});

test('nul als termijn wordt geweigerd', () => {
  assert.ok(parseerWanneer('over 0 dagen iets', NU).fout);
});

test('een onmogelijke datum wordt geweigerd', () => {
  assert.match(parseerWanneer('45-13 iets', NU).fout, /bestaande datum/i);
  assert.match(parseerWanneer('45 december iets', NU).fout, /dag van de maand/i);
});

// ── Vorm van de rest ───────────────────────────────────────────────────────────

test('scheidingstekens tussen moment en voorspelling verdwijnen', () => {
  for (const invoer of ['vrijdag: de kroket valt', 'vrijdag - de kroket valt', 'vrijdag, de kroket valt']) {
    assert.equal(parseerWanneer(invoer, NU).rest, 'de kroket valt');
  }
});

test('de voorspelling houdt zijn oorspronkelijke hoofdletters', () => {
  const r = parseerWanneer('vrijdag De Bamischijf Valt', NU);
  assert.equal(r.rest, 'De Bamischijf Valt');
});

test('dubbele spaties in de invoer breken het ontleden niet', () => {
  const r = parseerWanneer('over   2   weken    iets   gebeurt', NU);
  assert.equal(r.rest, 'iets gebeurt');
  assert.equal(amsDelen(r.deadline).dag, 26);
});

test('elke geslaagde ontleding levert een label voor het bericht', () => {
  for (const invoer of ['morgen iets', 'vrijdag iets', 'over 2 weken iets', '31 december iets', '31-12 iets']) {
    const r = parseerWanneer(invoer, NU);
    assert.ok(r.label && r.label.length > 0, `label ontbreekt voor "${invoer}"`);
  }
});

test('een deadline ligt altijd in de toekomst en binnen de horizon', () => {
  for (const invoer of ['morgen iets', 'zondag iets', 'over 6 maanden iets', '31-12 iets']) {
    const r = parseerWanneer(invoer, NU);
    assert.ok(r.deadline > NU, `${invoer} moet in de toekomst liggen`);
    assert.ok(r.deadline - NU <= MAX_HORIZON_DAGEN * DAG, `${invoer} moet binnen de horizon liggen`);
  }
});
