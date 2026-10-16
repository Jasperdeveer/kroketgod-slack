// Tests voor de Vetwissel: renteloos op tijd, een stevige boete te laat, en een schuld die
// niet verdampt als de kluis leeg is. Pure functies met injecteerbare klok. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WEEK_MS, WISSEL_MAX, WISSEL_MAX_OPEN, BOETE_MIN, BOETE_MAX, VOORSTEL_GELDIG_MS,
  OVERVAL_GREEP, OVERVAL_PAUZE_MS, OVERVAL_MIN, OVERVAL_MAX, OVERVAL_GOEDE_WIL,
  gemisteVervaldagen, boeteVan, teBetalen, isVervallen, naInning,
  overvalKans, magOvervallen, overval,
  magVoorstellen, ruimVoorstellen, voorstelVan,
} = require('./vetwissel.js');

const { paarSleutel } = require('./paar.js');

const A = 'U_A', B = 'U_B', C = 'U_C', D = 'U_D';
const VERVAL = 1_700_000_000_000;
const VOOR = VERVAL - 3_600_000;        // een uur vóór de vervaldag
const NET_NA = VERVAL + 1;              // één milliseconde te laat

const wissel = (bedrag, extra = {}) => ({ vanId: A, naarId: B, bedrag, vervalTs: VERVAL, afbetaald: 0, ...extra });

// ── Op tijd is renteloos ──────────────────────────────────────────────────────

test('op tijd betaal je precies terug wat je kreeg', () => {
  // Dit is de kern van de klacht: er was altijd één punt rente, ook voor wie netjes was.
  for (const n of [1, 2, 3]) {
    assert.equal(teBetalen(wissel(n), VOOR), n, `${n} geleend hoort ${n} terug te kosten`);
    assert.equal(boeteVan(wissel(n), VOOR), 0);
    assert.equal(isVervallen(wissel(n), VOOR), false);
  }
});

test('de vervaldag zelf is al te laat', () => {
  // Om 11:00 is de wissel vervallen, niet pas een week later.
  assert.equal(gemisteVervaldagen(wissel(3), VERVAL - 1), 0);
  assert.equal(gemisteVervaldagen(wissel(3), VERVAL), 1);
  assert.equal(gemisteVervaldagen(wissel(3), NET_NA), 1);
});

// ── Te laat kost écht iets ────────────────────────────────────────────────────

test('te laat betalen is duurder dan op tijd, bij elk bedrag', () => {
  // De oude regeling rekende na de vervaldag precies evenveel als ervoor; niet aflossen was
  // daardoor de verstandigste zet in het spel.
  for (const n of [1, 2, 3]) {
    assert.ok(teBetalen(wissel(n), NET_NA) > teBetalen(wissel(n), VOOR), `${n} geleend`);
  }
});

test('de boete is minstens twee punten, ook bij een lening van één', () => {
  // "Het bedrag er nog eens bij" is bij één punt geen straf maar een schouderklopje.
  assert.equal(boeteVan(wissel(1), NET_NA), BOETE_MIN);
  assert.equal(teBetalen(wissel(1), NET_NA), 1 + BOETE_MIN);
});

test('de boete schaalt met het geleende bedrag', () => {
  assert.equal(boeteVan(wissel(3), NET_NA), 3);
  assert.equal(teBetalen(wissel(3), NET_NA), 6, 'drie geleend, zes terug — de schuld verdubbelt');
});

test('elke gemiste week legt er een boete bij', () => {
  const w = wissel(3);
  assert.equal(teBetalen(w, NET_NA), 6);
  assert.equal(teBetalen(w, VERVAL + WEEK_MS), 9);
});

test('de schuld groeit niet oneindig door', () => {
  // Een schuld die blijft doorgroeien is geen straf meer maar een uitsluiting, en bij vier
  // spelers wil je niemand permanent op nul houden.
  const w = wissel(3);
  assert.equal(boeteVan(w, VERVAL + 50 * WEEK_MS), BOETE_MAX);
  assert.equal(teBetalen(w, VERVAL + 50 * WEEK_MS), 3 + BOETE_MAX);
  // En ook voor het kleinste bedrag geldt hetzelfde plafond.
  assert.equal(boeteVan(wissel(1), VERVAL + 50 * WEEK_MS), BOETE_MAX);
});

// ── De schuld verdampt niet ───────────────────────────────────────────────────

test('volledig aflossen laat niets achter', () => {
  assert.equal(naInning(wissel(3), 3, VOOR), null);
});

test('een lege kluis wist de schuld niet meer', () => {
  // Dit was het grootste gat: wie zijn beurs leegkocht vóór vrijdag betaalde helemaal niets,
  // want de inning pakte min(schuld, saldo) en gooide de wissel daarna weg.
  const w = wissel(3);
  const rest = naInning(w, 0, NET_NA);
  assert.ok(rest, 'de wissel blijft staan');
  assert.equal(teBetalen(rest, NET_NA), 6);
  // En de week daarop is hij duurder geworden.
  assert.equal(teBetalen(rest, VERVAL + WEEK_MS), 9);
});

test('een deelbetaling telt mee maar sluit de schuld niet', () => {
  const rest = naInning(wissel(3), 2, NET_NA);
  assert.equal(teBetalen(rest, NET_NA), 4, 'zes schuld min twee betaald');
  assert.equal(rest.bedrag, 3, 'het geleende bedrag verandert nooit');
  assert.equal(rest.afbetaald, 2);
});

test('deelbetalingen stapelen op', () => {
  let w = naInning(wissel(3), 2, NET_NA);
  w = naInning(w, 3, NET_NA);
  assert.equal(w.afbetaald, 5);
  assert.equal(teBetalen(w, NET_NA), 1);
  assert.equal(naInning(w, 1, NET_NA), null);
});

test('de boete rekent nooit over een bedrag waar al boete in zit', () => {
  // Zou de restschuld het nieuwe bedrag worden, dan groeit een lening van drie punten binnen
  // een maand naar iets wat niemand in deze economie kan ophoesten.
  const w = naInning(wissel(3), 0, NET_NA);
  assert.equal(boeteVan(w, NET_NA), 3, 'nog steeds de boete over het geleende, niet over de schuld');
});

test('meer betalen dan de schuld levert geen negatieve schuld op', () => {
  assert.equal(naInning(wissel(3), 99, VOOR), null);
  assert.equal(teBetalen({ ...wissel(3), afbetaald: 99 }, VOOR), 0);
});

// ── De grenzen van het voorstel ───────────────────────────────────────────────

const basis = { vanId: A, naarId: B, bedrag: 2, standVan: 10, sleutelVan: paarSleutel };

test('een gewoon voorstel mag', () => {
  assert.deepEqual(magVoorstellen(basis), { ok: true, bedrag: 2 });
});

test('het bedrag wordt begrensd op het maximum', () => {
  assert.equal(magVoorstellen({ ...basis, bedrag: 99, standVan: 99 }).bedrag, WISSEL_MAX);
  assert.equal(magVoorstellen({ ...basis, bedrag: 0 }).bedrag, 1, 'nul wordt één, niet niets');
});

test('uitlenen wat je niet hebt mag niet', () => {
  const r = magVoorstellen({ ...basis, bedrag: 3, standVan: 2 });
  assert.equal(r.ok, false);
  assert.match(r.reden, /niet heeft/i);
});

test('uzelf lenen mag niet', () => {
  assert.equal(magVoorstellen({ ...basis, naarId: A }).ok, false);
});

test('één wissel per paar, in welke richting ook', () => {
  const open = [{ vanId: B, naarId: A, bedrag: 1 }];
  const r = magVoorstellen({ ...basis, open });
  assert.equal(r.ok, false);
  assert.match(r.reden, /al een wissel/i);
});

test('een openstaand VOORSTEL bezet de plek ook', () => {
  // Anders stelt iemand vier wissels tegelijk voor en kiest hij achteraf welke hij laat tekenen.
  const voorstellen = [{ vanId: A, naarId: B, bedrag: 1 }];
  assert.equal(magVoorstellen({ ...basis, voorstellen }).ok, false);
});

test('niemand draagt meer dan twee schulden tegelijk', () => {
  const open = [{ vanId: C, naarId: B, bedrag: 1 }, { vanId: D, naarId: B, bedrag: 1 }];
  const r = magVoorstellen({ ...basis, open });
  assert.equal(r.ok, false);
  assert.match(r.reden, new RegExp(`${WISSEL_MAX_OPEN} schulden`));
});

// ── Voorstellen verlopen ──────────────────────────────────────────────────────

test('een voorstel verloopt en is daarna weg', () => {
  const nu = VERVAL;
  const lijst = [{ id: 'x', ts: nu - VOORSTEL_GELDIG_MS - 1 }, { id: 'y', ts: nu - 1000 }];
  const r = ruimVoorstellen(lijst, nu);
  assert.equal(r.gewijzigd, true);
  assert.deepEqual(r.voorstellen.map(v => v.id), ['y']);
});

test('opruimen doet niets als alles nog geldig is', () => {
  const nu = VERVAL;
  assert.equal(ruimVoorstellen([{ id: 'y', ts: nu - 1000 }], nu).gewijzigd, false);
  assert.equal(ruimVoorstellen([], nu).gewijzigd, false);
  assert.equal(ruimVoorstellen(null, nu).gewijzigd, false);
});

test('een verlopen voorstel is niet meer op te halen', () => {
  const nu = VERVAL;
  const lijst = [{ id: 'x', ts: nu - VOORSTEL_GELDIG_MS - 1 }];
  assert.equal(voorstelVan(lijst, 'x', nu), null, 'verlopen');
  assert.ok(voorstelVan(lijst, 'x'), 'zonder klok geen oordeel over de tijd');
  assert.equal(voorstelVan(lijst, 'bestaatniet', nu), null);
});

// ── Bestand tegen rommel ──────────────────────────────────────────────────────

test('de rekensom valt niet om over een kapotte wissel', () => {
  assert.equal(teBetalen(null, VERVAL), 0);
  assert.equal(teBetalen({}, VERVAL), 0);
  assert.equal(boeteVan({ bedrag: 3 }, VERVAL), 0, 'geen vervaldag, dus geen boete');
  assert.equal(gemisteVervaldagen(wissel(3), NaN), 0);
  assert.equal(isVervallen(null, VERVAL), false);
});

// ── De Overval ────────────────────────────────────────────────────────────────

test('vóór de vervaldag valt er niets te overvallen', () => {
  assert.equal(overvalKans(wissel(3), VOOR), 0);
  const r = magOvervallen(wissel(3), VOOR);
  assert.equal(r.ok, false);
  assert.match(r.reden, /vervaldag is nog niet/i);
});

test('hoe langer iemand wegduikt, hoe makkelijker hij te pakken is', () => {
  const w = wissel(3);
  const een = overvalKans(w, NET_NA);
  const twee = overvalKans(w, VERVAL + WEEK_MS);
  const drie = overvalKans(w, VERVAL + 2 * WEEK_MS);
  assert.ok(twee > een && drie > twee, `${een} < ${twee} < ${drie}`);
});

test('wie iets afbetaalde is veel moeilijker te overvallen', () => {
  const kaal = overvalKans(wissel(3), NET_NA);
  const metGoedeWil = overvalKans(wissel(3, { afbetaald: 1 }), NET_NA);
  assert.equal(Math.round((kaal - metGoedeWil) * 100) / 100, OVERVAL_GOEDE_WIL);
});

test('de kans blijft binnen zijn grenzen', () => {
  assert.ok(overvalKans(wissel(3), VERVAL + 99 * WEEK_MS) <= OVERVAL_MAX);
  assert.ok(overvalKans(wissel(1, { afbetaald: 1 }), NET_NA) >= OVERVAL_MIN);
});

test('een geslaagde overval haalt de schuld plus een greep', () => {
  const w = wissel(3);
  const r = overval(w, NET_NA, 50, 0);           // worp 0 = altijd raak
  assert.equal(r.gelukt, true);
  assert.equal(r.schuld, 6);
  assert.equal(r.geind, 6, 'eerst de schuld');
  assert.equal(r.buit, OVERVAL_GREEP, 'en daarna pas de greep');
  assert.equal(r.wissel, null, 'de schuld is voldaan');
});

test('een overval pakt nooit meer dan er in de kluis ligt', () => {
  const r = overval(wissel(3), NET_NA, 4, 0);    // schuld 6, maar er ligt maar 4
  assert.equal(r.geind, 4);
  assert.equal(r.buit, 0, 'geen greep zolang de schuld niet rond is');
  assert.ok(r.wissel, 'en de restschuld blijft gewoon staan');
  assert.equal(teBetalen(r.wissel, NET_NA), 2);
});

test('een lege kluis levert een geslaagde overval niets op', () => {
  const r = overval(wissel(3), NET_NA, 0, 0);
  assert.equal(r.gelukt, true);
  assert.equal(r.geind, 0);
  assert.ok(r.wissel, 'de schuld blijft volledig staan');
});

test('een mislukte overval kost de schuldeiser zijn beurt', () => {
  const w = wissel(3);
  const r = overval(w, NET_NA, 50, 0.99);        // worp 0.99 = vrijwel zeker mis
  assert.equal(r.gelukt, false);
  assert.equal(r.geind, 0);
  assert.equal(r.wissel.overvalGefaaldTs, NET_NA);
  // En daarna mag hij een dag lang niet opnieuw.
  const direct = magOvervallen(r.wissel, NET_NA + 1000);
  assert.equal(direct.ok, false);
  assert.match(direct.reden, /mislukte/i);
  assert.equal(magOvervallen(r.wissel, NET_NA + OVERVAL_PAUZE_MS).ok, true);
});

test('de worp bepaalt de uitkomst, niet het toeval in de module', () => {
  // De kans bij één gemiste week is 0.50; de grens hoort daar precies te liggen.
  const w = wissel(3);
  assert.equal(overvalKans(w, NET_NA), 0.5);
  assert.equal(overval(w, NET_NA, 50, 0.49).gelukt, true);
  assert.equal(overval(w, NET_NA, 50, 0.50).gelukt, false, 'de worp moet onder de kans liggen');
});

test('overvallen kan niet zonder wissel', () => {
  assert.equal(magOvervallen(null, NET_NA).ok, false);
});
