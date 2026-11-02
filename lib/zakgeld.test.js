// Tests voor het zakgeld: één keer per lid per week, nooit vóór maandag 08:00 en nooit vóór de
// reset van die week, en geen verdienste (relikwieën en de kroning kijken erlangs). Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ZAKGELD, ZAKGELD_UUR, BESCHERMD_TOT_WEEKDAG, uitdeelMomentGeweest, nogTeOntvangen, naUitkering,
  verdiendeStand, kampioenWaardig, beschermdTegenRoof, roofbaar,
} = require('./zakgeld.js');

const WEEK = '2026-10-19';   // een maandag
const VORIGE = '2026-10-12';
const LEDEN = ['U_A', 'U_B', 'U_C'];
const KLAAR = { resetWeek: WEEK, momentGeweest: true };

test('het zakgeld is vijf, maandag om acht uur', () => {
  assert.equal(ZAKGELD, 5);
  assert.equal(ZAKGELD_UUR, 8);
});

// ── Het uitdeelmoment ─────────────────────────────────────────────────────────

test('maandag vóór 08:00 nog niet, vanaf 08:00 wel', () => {
  assert.equal(uitdeelMomentGeweest(WEEK, WEEK, 3 * 60), false);      // nachtelijke herstart 03:00
  assert.equal(uitdeelMomentGeweest(WEEK, WEEK, 7 * 60 + 59), false);
  assert.equal(uitdeelMomentGeweest(WEEK, WEEK, 8 * 60), true);
  assert.equal(uitdeelMomentGeweest(WEEK, WEEK, 9 * 60), true);       // inhaalslag 09:00
});

test('later in de week is het moment altijd geweest', () => {
  assert.equal(uitdeelMomentGeweest(WEEK, '2026-10-20', 0), true);
  assert.equal(uitdeelMomentGeweest(WEEK, '2026-10-25', 23 * 60), true);
});

test('op zondagavond is het moment van de komende week nog niet geweest', () => {
  // De zondagse reset schrijft de marker al voor de kómende maandag; een nieuw lid op zondagavond
  // mag niet al het zakgeld krijgen van een week die nog moet beginnen.
  assert.equal(uitdeelMomentGeweest('2026-10-26', '2026-10-25', 23 * 60 + 59), false);
});

test('zonder week of datum: niets', () => {
  assert.equal(uitdeelMomentGeweest(null, WEEK, 600), false);
  assert.equal(uitdeelMomentGeweest(WEEK, null, 600), false);
});

// ── Wie krijgt het ────────────────────────────────────────────────────────────

test('na de reset en na 08:00 krijgt iedereen het', () => {
  assert.deepEqual(nogTeOntvangen(null, WEEK, LEDEN, KLAAR), LEDEN);
});

test('vóór 08:00 krijgt niemand het, ook niet na de reset', () => {
  assert.deepEqual(nogTeOntvangen(null, WEEK, LEDEN, { resetWeek: WEEK, momentGeweest: false }), []);
});

test('zolang de reset van deze week niet geweest is, deelt het niets uit', () => {
  // De zondagse reset is gemist en de inhaalslag komt pas om 09:00. Delen we om 08:00 al uit,
  // dan veegt die reset het weer weg.
  assert.deepEqual(nogTeOntvangen(null, WEEK, LEDEN, { resetWeek: VORIGE, momentGeweest: true }), []);
  assert.deepEqual(nogTeOntvangen(null, WEEK, LEDEN, { resetWeek: null, momentGeweest: true }), []);
  assert.deepEqual(nogTeOntvangen(null, null, LEDEN, { resetWeek: null, momentGeweest: true }), []);
});

test('wie het deze week al kreeg, krijgt het niet nog eens', () => {
  const state = { week: WEEK, ontvangen: ['U_A', 'U_B'] };
  assert.deepEqual(nogTeOntvangen(state, WEEK, LEDEN, KLAAR), ['U_C']);
});

test('een lijst van vorige week telt als leeg', () => {
  assert.deepEqual(nogTeOntvangen({ week: VORIGE, ontvangen: LEDEN }, WEEK, LEDEN, KLAAR), LEDEN);
});

test('een door de reset geleegde lijst geeft iedereen opnieuw', () => {
  assert.deepEqual(nogTeOntvangen({ week: WEEK, ontvangen: [] }, WEEK, LEDEN, KLAAR), LEDEN);
});

test('dubbele ids in de ledenlijst geven geen dubbele uitkering', () => {
  assert.deepEqual(nogTeOntvangen(null, WEEK, ['U_A', 'U_A'], KLAAR), ['U_A']);
});

// ── De lijst bijhouden ────────────────────────────────────────────────────────

test('na de uitkering staat iedereen op de lijst, en een tweede ronde vindt niemand', () => {
  const na = naUitkering(null, WEEK, LEDEN);
  assert.deepEqual(na, { week: WEEK, ontvangen: LEDEN });
  assert.deepEqual(nogTeOntvangen(na, WEEK, LEDEN, KLAAR), []);
});

test('een nieuw lid midden in de week wordt aan de lijst toegevoegd, niet eroverheen geschreven', () => {
  const na = naUitkering({ week: WEEK, ontvangen: LEDEN }, WEEK, ['U_D']);
  assert.deepEqual(na.ontvangen, [...LEDEN, 'U_D']);
});

test('een uitkering voor een nieuwe week begint een nieuwe lijst', () => {
  assert.deepEqual(naUitkering({ week: VORIGE, ontvangen: LEDEN }, WEEK, ['U_A']), { week: WEEK, ontvangen: ['U_A'] });
});

test('wie vertrekt en in dezelfde week terugkomt, krijgt het niet opnieuw', () => {
  const state = naUitkering(null, WEEK, LEDEN);
  assert.deepEqual(nogTeOntvangen(state, WEEK, ['U_A', 'U_B'], KLAAR), []); // U_C gearchiveerd
  assert.deepEqual(nogTeOntvangen(state, WEEK, LEDEN, KLAAR), []);          // en hersteld
});

// ── Geen verdienste ───────────────────────────────────────────────────────────

test('de verdiende stand trekt het zakgeld af', () => {
  assert.equal(verdiendeStand(ZAKGELD), 0);
  assert.equal(verdiendeStand(ZAKGELD + 3), 3);
  assert.equal(verdiendeStand(2), -3);        // meer uitgegeven dan verdiend
  assert.equal(verdiendeStand(undefined), -ZAKGELD);
});

test('relikwie-drempels gaan pas over bij echt verdiende punten', () => {
  // De eerste twee relikwieën liggen op 1 en 5. Op de kale stand stond je daar na het zakgeld al.
  for (const drempel of [1, 5]) {
    assert.ok(verdiendeStand(ZAKGELD) < drempel, `drempel ${drempel} lag gratis klaar`);
    assert.ok(verdiendeStand(ZAKGELD + drempel) >= drempel);
  }
});

test('niemand boven het zakgeld → geen kampioen', () => {
  assert.equal(kampioenWaardig(0), false);
  assert.equal(kampioenWaardig(ZAKGELD), false);    // de hele week niets gedaan
  assert.equal(kampioenWaardig(ZAKGELD + 1), true);
});

// ── Beschermd tegen roof, tot en met woensdag ─────────────────────────────────

const MA = 1, WO = 3, DO = 4, ZO = 7;
const gekregen = (weekdag) => ({ ontvangen: true, weekdag });

test('tot en met woensdag rooft een dief alleen wat boven het zakgeld ligt', () => {
  assert.equal(BESCHERMD_TOT_WEEKDAG, 3);
  for (const dag of [MA, 2, WO]) {
    assert.equal(roofbaar(ZAKGELD, gekregen(dag)), 0, `dag ${dag}: alleen zakgeld`);
    assert.equal(roofbaar(ZAKGELD + 4, gekregen(dag)), 4, `dag ${dag}: vier verdiend`);
    assert.equal(beschermdTegenRoof(ZAKGELD + 4, gekregen(dag)), ZAKGELD);
  }
});

test('vanaf donderdag is alles weer te roven', () => {
  for (const dag of [DO, 5, 6, ZO]) {
    assert.equal(roofbaar(ZAKGELD + 4, gekregen(dag)), ZAKGELD + 4, `dag ${dag}`);
    assert.equal(beschermdTegenRoof(ZAKGELD + 4, gekregen(dag)), 0);
  }
});

test('een bodem, geen geoormerkt bedrag: onder het zakgeld valt niets te halen', () => {
  // Drie van het zakgeld uitgegeven, daarna twee verdiend: stand 4, en die is helemaal beschermd.
  assert.equal(roofbaar(4, gekregen(2)), 0);
  assert.equal(beschermdTegenRoof(4, gekregen(2)), 4);
  assert.equal(roofbaar(0, gekregen(2)), 0);
});

test('wie het zakgeld van deze week niet kreeg, is niet beschermd', () => {
  // Maandag vóór 08:00, of een lid dat er (nog) niet bij hoort: zijn punten zijn verdiend.
  assert.equal(roofbaar(4, { ontvangen: false, weekdag: MA }), 4);
  assert.equal(beschermdTegenRoof(4, { ontvangen: false, weekdag: MA }), 0);
});

test('onzin in de weekdag beschermt niets', () => {
  for (const weekdag of [0, -1, 8, undefined, NaN]) {
    assert.equal(roofbaar(9, { ontvangen: true, weekdag }), 9, String(weekdag));
  }
});
