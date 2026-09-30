// Tests voor De Dubbele Korst. Pure functies. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inStilVenster, KORST_VENSTER_MS, SOLO_DADEN,
  weegDaad, KORST_MAX_PER_WEEK, korstenDezeWeek,
} = require('./dubbelekorst.js');

const A = 'U_A', B = 'U_B', C = 'U_C';
const T = 1_800_000_000_000;

// ── Het stille venster ────────────────────────────────────────────────────────

test('inStilVenster: het weekend is altijd stil', () => {
  for (const uur of [0, 9, 12, 15, 23]) {
    assert.equal(inStilVenster({ uur, weekend: true }), true, `uur ${uur}`);
  }
});

test('inStilVenster: op een werkdag pas vanaf 16:00, en tot 09:00', () => {
  assert.equal(inStilVenster({ uur: 15, weekend: false }), false);
  assert.equal(inStilVenster({ uur: 16, weekend: false }), true);
  assert.equal(inStilVenster({ uur: 23, weekend: false }), true);
  assert.equal(inStilVenster({ uur: 0, weekend: false }), true);
  assert.equal(inStilVenster({ uur: 8, weekend: false }), true);
  assert.equal(inStilVenster({ uur: 9, weekend: false }), false);
});

// ── De korstvorming ───────────────────────────────────────────────────────────

test('weegDaad: twee verschillende leden, dezelfde daad, binnen het venster = één korst', () => {
  const eerste = weegDaad([], { userId: A, actie: 'offer', ts: T });
  assert.equal(eerste.korst, null);
  assert.equal(eerste.open.length, 1);
  const tweede = weegDaad(eerste.open, { userId: B, actie: 'offer', ts: T + 60_000 });
  assert.ok(tweede.korst);
  assert.deepEqual([...tweede.korst.leden].sort(), [A, B].sort());
  assert.equal(tweede.open.length, 0, 'beide daden zijn verbruikt');
});

test('weegDaad: dezelfde persoon matcht nooit met zichzelf', () => {
  const eerste = weegDaad([], { userId: A, actie: 'offer', ts: T });
  const tweede = weegDaad(eerste.open, { userId: A, actie: 'offer', ts: T + 60_000 });
  assert.equal(tweede.korst, null);
  assert.equal(tweede.open.length, 1, 'één openstaande daad per lid per actie');
});

test('weegDaad: verschillende daden vormen geen korst', () => {
  const eerste = weegDaad([], { userId: A, actie: 'offer', ts: T });
  const tweede = weegDaad(eerste.open, { userId: B, actie: 'eer_gegeven', ts: T + 60_000 });
  assert.equal(tweede.korst, null);
  assert.equal(tweede.open.length, 2);
});

test('weegDaad: buiten het venster van negentig minuten valt er niets', () => {
  const eerste = weegDaad([], { userId: A, actie: 'offer', ts: T });
  const laat = weegDaad(eerste.open, { userId: B, actie: 'offer', ts: T + KORST_VENSTER_MS + 1 });
  assert.equal(laat.korst, null);
  assert.equal(laat.open.length, 1, 'de verlopen daad is opgeruimd');
});

test('weegDaad: precies op de grens telt nog wél', () => {
  const eerste = weegDaad([], { userId: A, actie: 'offer', ts: T });
  const grens = weegDaad(eerste.open, { userId: B, actie: 'offer', ts: T + KORST_VENSTER_MS });
  assert.ok(grens.korst);
});

test('weegDaad: een derde stapelt geen tweede korst op hetzelfde paar', () => {
  let st = weegDaad([], { userId: A, actie: 'offer', ts: T });
  st = weegDaad(st.open, { userId: B, actie: 'offer', ts: T + 1000 });
  assert.ok(st.korst, 'A en B sluiten de korst');
  const derde = weegDaad(st.open, { userId: C, actie: 'offer', ts: T + 2000 });
  assert.equal(derde.korst, null, 'C vindt niets meer om mee te matchen');
});

// Dit is de reparatie van het fatale bezwaar van de rechters.
test('weegDaad: dubbelzijdig geboekte daden zijn uitgesloten', () => {
  for (const actie of ['duel', 'duel_gewonnen', 'raid_overwonnen', 'ambtsdaad', 'opdracht_klaar']) {
    assert.equal(SOLO_DADEN.has(actie), false, `${actie} mag niet meedoen`);
    const eerste = weegDaad([], { userId: A, actie, ts: T });
    assert.equal(eerste.open.length, 0, `${actie} hoort niet eens open te staan`);
    const tweede = weegDaad(eerste.open, { userId: B, actie, ts: T + 1000 });
    assert.equal(tweede.korst, null, `${actie} mag geen korst vormen`);
  }
});

test('weegDaad: de toegestane daden zijn allemaal enkelzijdig geboekte daden', () => {
  for (const actie of ['offer', 'eer_gegeven', 'kroketje_gegeven', 'raid_aanval', 'winkel_koop']) {
    assert.equal(SOLO_DADEN.has(actie), true, `${actie} hoort wél mee te doen`);
  }
});

test('weegDaad: een lege of ontbrekende lijst is veilig', () => {
  assert.equal(weegDaad(null, { userId: A, actie: 'offer', ts: T }).open.length, 1);
  assert.equal(weegDaad(undefined, { userId: A, actie: 'duel', ts: T }).korst, null);
});

// ── Het weekplafond ───────────────────────────────────────────────────────────

test('korstenDezeWeek: telt alleen deze week en alleen de eigen korsten', () => {
  const g = [
    { weekStart: '2026-09-14', leden: [A, B] },
    { weekStart: '2026-09-14', leden: [A, C] },
    { weekStart: '2026-09-07', leden: [A, B] },
    { weekStart: '2026-09-14', leden: [B, C] },
  ];
  assert.equal(korstenDezeWeek(g, A, '2026-09-14'), 2);
  assert.equal(korstenDezeWeek(g, B, '2026-09-14'), 2);
  assert.equal(korstenDezeWeek(g, C, '2026-09-14'), 2);
  assert.equal(korstenDezeWeek(g, A, '2026-09-07'), 1);
  assert.equal(korstenDezeWeek([], A, '2026-09-14'), 0);
  assert.equal(korstenDezeWeek(null, A, '2026-09-14'), 0);
});

test('KORST_MAX_PER_WEEK is een echt plafond, niet nul', () => {
  assert.ok(KORST_MAX_PER_WEEK >= 1 && KORST_MAX_PER_WEEK <= 10);
});
