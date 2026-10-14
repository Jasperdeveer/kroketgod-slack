// Tests voor het Paarboek: de bladzijde tussen twee leden en de claim-ladder.
// Pure functies met injecteerbare dag-/weeksleutel en klok. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BLADZIJDE_MIN, BLADZIJDE_MAX, DAAD_GEWICHT, TOESTANDEN,
  toestandVan, bladzijdeVan, boekDaad, strijkGlad, schuifNaarNul, bladzijdenVan,
  daderVan,
  CLAIM_GELDIG_MS, CLAIM_KEUZES,
  maakClaim, openClaimsVan, sluitClaim, ruimOudeClaims,
} = require('./paarboek.js');
const { KERF_GEWICHT } = require('./paar.js');

const A = 'U_A', B = 'U_B', C = 'U_C';
const DAG = '2026-10-14', MORGEN = '2026-10-15';
const WEEK = '2026-10-12', VOLGENDE = '2026-10-19';

// ── De schaal ─────────────────────────────────────────────────────────────────

test('de vijandige gewichten zijn ongewijzigd overgenomen uit de kerfstok', () => {
  // De overgang mag geen enkele daad zwaarder of lichter maken dan hij was. Verandert
  // KERF_GEWICHT ooit, dan hoort deze test te breken zodat iemand er bewust naar kijkt.
  for (const [soort, gewicht] of Object.entries(KERF_GEWICHT)) {
    assert.equal(DAAD_GEWICHT[soort], -gewicht, `${soort} weegt anders dan in de kerfstok`);
  }
});

test('de warme kant bestaat, en elke sleutel wordt ook werkelijk geboekt', () => {
  const warm = Object.entries(DAAD_GEWICHT).filter(([, g]) => g > 0);
  assert.ok(warm.length >= 1, 'de warme kant mag niet leeg zijn — dat was juist het gat');
  // De tabel droeg ooit vier sleutels die geen enkele aanroeper meegaf. Deze test houdt hem
  // eerlijk: wat hier staat hoort ergens geboekt te worden. Komt er een sleutel bij, dan moet
  // de bedrading in dezelfde wijziging mee — en breekt deze lijst zodat iemand ernaar kijkt.
  assert.deepEqual(Object.keys(DAAD_GEWICHT).sort(),
    ['duel_verloren', 'eerbewijs', 'premie_geind', 'roof_gelukt']);
});

test('de vijf toestanden dekken de hele schaal zonder gat', () => {
  const gezien = new Set();
  for (let w = BLADZIJDE_MIN; w <= BLADZIJDE_MAX; w++) {
    const t = toestandVan(w);
    assert.ok(t && t.naam, `geen toestand voor ${w}`);
    gezien.add(t.naam);
  }
  assert.equal(gezien.size, TOESTANDEN.length, 'niet elke toestand is bereikbaar');
});

test('nul is quitte, en dat is het vertrekpunt', () => {
  assert.equal(toestandVan(0).naam, 'quitte');
  assert.equal(bladzijdeVan({}, A, B), 0);
});

test('buiten de schaal wordt geklemd in plaats van door te lopen', () => {
  assert.equal(toestandVan(-99).naam, 'in de clinch');
  assert.equal(toestandVan(99).naam, 'dik');
});

// ── Boeken ────────────────────────────────────────────────────────────────────

test('een vijandige daad duwt de bladzijde omlaag, een warme omhoog', () => {
  let { boek } = boekDaad({}, A, B, 'roof_gelukt', DAG);
  assert.equal(bladzijdeVan(boek, A, B), -2);
  ({ boek } = boekDaad(boek, A, B, 'eerbewijs', MORGEN));
  assert.equal(bladzijdeVan(boek, A, B), -1);
});

test('de bladzijde is symmetrisch — richting maakt niet uit', () => {
  const { boek } = boekDaad({}, A, B, 'roof_gelukt', DAG);
  assert.equal(bladzijdeVan(boek, A, B), bladzijdeVan(boek, B, A));
});

test('hoogstens één boeking per paar per dag in dezelfde richting', () => {
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);
  assert.equal(r.gewijzigd, true);
  r = boekDaad(r.boek, A, B, 'duel_verloren', DAG);
  assert.equal(r.gewijzigd, false, 'een tweede vijandige daad op dezelfde dag mag niet tellen');
  assert.equal(bladzijdeVan(r.boek, A, B), -2);
});

test('een warme daad mag een vijandige van dezelfde dag wél tegenspreken', () => {
  // Anders blokkeert één roof 's ochtends een hele dag aan verzoening, en dat is precies de
  // verkeerde kant om te blokkeren.
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);   // -2
  r = boekDaad(r.boek, A, B, 'eerbewijs', DAG);    // +1, andere richting dus toegestaan
  assert.equal(r.gewijzigd, true);
  assert.equal(bladzijdeVan(r.boek, A, B), -1);
});

test('de schaal loopt niet door voorbij de grenzen', () => {
  let boek = {};
  for (let i = 0; i < 10; i++) ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', `dag-${i}`));
  assert.equal(bladzijdeVan(boek, A, B), BLADZIJDE_MIN);
  for (let i = 0; i < 20; i++) ({ boek } = boekDaad(boek, A, B, 'eerbewijs', `later-${i}`));
  assert.equal(bladzijdeVan(boek, A, B), BLADZIJDE_MAX);
});

test('aan het plafond verandert er niets meer', () => {
  let boek = {};
  for (let i = 0; i < 10; i++) ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', `d${i}`));
  const r = boekDaad(boek, A, B, 'roof_gelukt', 'nog-een-dag');
  assert.equal(r.gewijzigd, false);
});

test('onbekende daden en zelf-paren doen niets', () => {
  assert.equal(boekDaad({}, A, B, 'bestaat-niet', DAG).gewijzigd, false);
  assert.equal(boekDaad({}, A, A, 'roof_gelukt', DAG).gewijzigd, false);
  assert.equal(boekDaad({}, A, null, 'roof_gelukt', DAG).gewijzigd, false);
});

test('boekDaad muteert het bestaande boek niet', () => {
  const boek = {};
  boekDaad(boek, A, B, 'roof_gelukt', DAG);
  assert.deepEqual(boek, {});
});

// ── Gladstrijken ──────────────────────────────────────────────────────────────

test('gladstrijken zet ineens op nul, niet in termijnen', () => {
  let boek = {};
  for (let i = 0; i < 3; i++) ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', `d${i}`));
  assert.equal(bladzijdeVan(boek, A, B), -4);
  const r = strijkGlad(boek, A, B);
  assert.equal(r.gewijzigd, true);
  assert.equal(r.was, -4);
  assert.equal(bladzijdeVan(r.boek, A, B), 0);
});

test('gladstrijken van een schone bladzijde doet niets', () => {
  assert.equal(strijkGlad({}, A, B).gewijzigd, false);
});

// ── De wekelijkse slijtage ────────────────────────────────────────────────────

test('elke week schuift elk paar één stap richting nul, van beide kanten', () => {
  let boek = {};
  ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', 'd1'));   // -2
  ({ boek } = boekDaad(boek, A, C, 'eerbewijs', 'd1'));    // +1
  ({ boek } = schuifNaarNul(boek, WEEK));
  assert.equal(bladzijdeVan(boek, A, B), -1);
  assert.equal(bladzijdeVan(boek, A, C), 0);
});

test('een wrok die niemand voedt is binnen vier weken weg', () => {
  let boek = {};
  for (let i = 0; i < 3; i++) ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', `d${i}`));
  assert.equal(bladzijdeVan(boek, A, B), -4);
  for (let w = 0; w < 4; w++) ({ boek } = schuifNaarNul(boek, `week-${w}`));
  assert.equal(bladzijdeVan(boek, A, B), 0);
});

test('tweemaal schuiven in dezelfde week doet maar één stap', () => {
  // Idempotent, want de maandag-cron en een inhaalslag bij het opstarten kunnen samenvallen.
  let boek = boekDaad({}, A, B, 'roof_gelukt', 'd1').boek;
  ({ boek } = schuifNaarNul(boek, WEEK));
  ({ boek } = schuifNaarNul(boek, WEEK));
  assert.equal(bladzijdeVan(boek, A, B), -1);
  ({ boek } = schuifNaarNul(boek, VOLGENDE));
  assert.equal(bladzijdeVan(boek, A, B), 0);
});

// ── Weergave ──────────────────────────────────────────────────────────────────

test('bladzijdenVan toont alleen paren waar iets staat, zwaarste eerst', () => {
  let boek = {};
  ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', 'd1'));   // -2
  ({ boek } = boekDaad(boek, A, C, 'eerbewijs', 'd1'));     // +1
  const rijen = bladzijdenVan(boek, A, [A, B, C, 'U_D']);
  assert.equal(rijen.length, 2, 'een paar op nul hoort niet in de lijst');
  assert.equal(rijen[0].id, B, 'de zwaarste bladzijde staat vooraan');
  assert.ok(rijen[0].toestand.naam);
});

test('het getal lekt niet naar buiten als getal, alleen als toestand', () => {
  // Het is een ontwerpeis dat spelers geen score zien: een relatie in "−3" uitdrukken maakt er
  // boekhouding van. De waarde blijft wel in de rij staan voor de code die sorteert.
  const rijen = bladzijdenVan(boekDaad({}, A, B, 'roof_gelukt', 'd1').boek, A, [A, B]);
  assert.ok(rijen[0].toestand.naam && rijen[0].toestand.icoon);
});

// ── De Claim ──────────────────────────────────────────────────────────────────

const NU = new Date('2026-10-14T12:00:00Z').getTime();
const UUR = 3600_000;

test('een claim opent op naam van wie iets is aangedaan', () => {
  const r = maakClaim({}, A, B, 'roof_gelukt', NU);
  assert.equal(r.gewijzigd, true);
  const open = openClaimsVan(r.claims, A, NU);
  assert.equal(open.length, 1);
  assert.equal(open[0].dader, B);
  assert.equal(openClaimsVan(r.claims, B, NU).length, 0, 'de dader heeft zelf geen claim');
});

test('claims stapelen niet tegen dezelfde dader', () => {
  let { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  const tweede = maakClaim(claims, A, B, 'duel_verloren', NU + UUR);
  assert.equal(tweede.gewijzigd, false);
  assert.equal(openClaimsVan(tweede.claims, A, NU + UUR).length, 1);
});

test('tegen een ándere dader mag er wel een tweede claim open staan', () => {
  let { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  ({ claims } = maakClaim(claims, A, C, 'duel_verloren', NU));
  assert.equal(openClaimsVan(claims, A, NU).length, 2);
});

test('een claim verloopt na 72 uur', () => {
  const { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  assert.equal(openClaimsVan(claims, A, NU + CLAIM_GELDIG_MS - 1).length, 1);
  assert.equal(openClaimsVan(claims, A, NU + CLAIM_GELDIG_MS).length, 0);
});

test('na een verlopen claim mag er een nieuwe open', () => {
  let { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  const later = NU + CLAIM_GELDIG_MS + UUR;
  const r = maakClaim(claims, A, B, 'roof_gelukt', later);
  assert.equal(r.gewijzigd, true);
  assert.equal(openClaimsVan(r.claims, A, later).length, 1);
});

test('elke keuze sluit de claim, en een tweede klik doet niets meer', () => {
  for (const keuze of CLAIM_KEUZES) {
    const { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
    const r = sluitClaim(claims, A, B, keuze, NU + UUR);
    assert.equal(r.gewijzigd, true, keuze);
    assert.equal(openClaimsVan(r.claims, A, NU + UUR).length, 0);
    // Dubbelklik of een tweede tabblad mag niet nóg een keer uitbetalen.
    assert.equal(sluitClaim(r.claims, A, B, keuze, NU + UUR).gewijzigd, false);
  }
});

test('een onbekende keuze of een verlopen claim verandert niets', () => {
  const { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  assert.equal(sluitClaim(claims, A, B, 'onzin', NU).gewijzigd, false);
  assert.equal(sluitClaim(claims, A, B, 'vergeven', NU + CLAIM_GELDIG_MS).gewijzigd, false);
  assert.equal(sluitClaim(claims, A, C, 'vergeven', NU).gewijzigd, false);
});

test('opruimen gooit gesloten en verlopen claims weg, open claims niet', () => {
  let { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  ({ claims } = maakClaim(claims, A, C, 'duel_verloren', NU));
  ({ claims } = sluitClaim(claims, A, B, 'vergeven', NU));
  const r = ruimOudeClaims(claims, NU + UUR);
  assert.equal(Object.keys(r.claims).length, 1);
  assert.equal(openClaimsVan(r.claims, A, NU + UUR)[0].dader, C);
});

test('lezen schrijft nooit — openClaimsVan ruimt niets op', () => {
  const { claims } = maakClaim({}, A, B, 'roof_gelukt', NU);
  const kopie = JSON.parse(JSON.stringify(claims));
  openClaimsVan(claims, A, NU + CLAIM_GELDIG_MS + UUR);
  assert.deepEqual(claims, kopie);
});

// ── Wie het deed ──────────────────────────────────────────────────────────────

test('een vijandige daad stempelt een dader, een warme niet', () => {
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);
  assert.equal(daderVan(r.boek, A, B), B, 'standaard is de dader de tweede partij');
  // De warme daad verwarmt wel, maar wist niet wie het koud maakte.
  r = boekDaad(r.boek, A, B, 'eerbewijs', 'dag-2');
  assert.equal(daderVan(r.boek, A, B), B);
});

test('de dader is expliciet mee te geven, los van de volgorde', () => {
  // boekVerlies doet dit, zodat de positionele afspraak nergens stil kan omslaan.
  const r = boekDaad({}, A, B, 'roof_gelukt', DAG, A);
  assert.equal(daderVan(r.boek, A, B), A);
});

test('een dader die geen van beide partijen is wordt genegeerd', () => {
  const r = boekDaad({}, A, B, 'roof_gelukt', DAG, C);
  assert.equal(daderVan(r.boek, A, B), B, 'valt terug op de standaard');
});

test('op nul of warmer staat er geen dader meer', () => {
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);          // -2, dader B
  r = boekDaad(r.boek, A, B, 'eerbewijs', 'd2');           // -1
  r = boekDaad(r.boek, A, B, 'eerbewijs', 'd3');           //  0
  assert.equal(bladzijdeVan(r.boek, A, B), 0);
  assert.equal(daderVan(r.boek, A, B), null, 'niets te verrekenen, dus geen naam');
});

test('aan het plafond kan de temperatuur niet zakken maar de dader wél wisselen', () => {
  // Dit is het randgeval waar het om gaat: op -4 houdt het slachtoffer anders zijn wrokbonus
  // terwijl hij intussen zelf de laatste klap uitdeelde.
  let boek = {};
  for (let i = 0; i < 10; i++) ({ boek } = boekDaad(boek, A, B, 'roof_gelukt', `d${i}`));
  assert.equal(bladzijdeVan(boek, A, B), -4);
  assert.equal(daderVan(boek, A, B), B);
  const r = boekDaad(boek, A, B, 'roof_gelukt', 'nog-een-dag', A);
  assert.equal(r.gewijzigd, true, 'de naam wisselt, dus er IS iets veranderd');
  assert.equal(bladzijdeVan(r.boek, A, B), -4);
  assert.equal(daderVan(r.boek, A, B), A);
  // Verandert ook de naam niet, dan is er echt niets gebeurd.
  assert.equal(boekDaad(r.boek, A, B, 'roof_gelukt', 'weer-een-dag', A).gewijzigd, false);
});

test('vergeven wist de dader, niet alleen de temperatuur', () => {
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);
  const glad = strijkGlad(r.boek, A, B);
  assert.equal(glad.gewijzigd, true);
  assert.equal(daderVan(glad.boek, A, B), null);
});

test('slijt de bladzijde naar nul, dan slijt de dader mee', () => {
  let r = boekDaad({}, A, B, 'roof_gelukt', DAG);          // -2
  let { boek } = schuifNaarNul(r.boek, 'week-1');          // -1, naam blijft
  assert.equal(daderVan(boek, A, B), B);
  ({ boek } = schuifNaarNul(boek, 'week-2'));              //  0, naam weg
  assert.equal(bladzijdeVan(boek, A, B), 0);
  assert.equal(daderVan(boek, A, B), null);
});

test('daderVan is bestand tegen een leeg of raar boek', () => {
  assert.equal(daderVan({}, A, B), null);
  assert.equal(daderVan(null, A, B), null);
  assert.equal(daderVan({}, A, A), null);
  assert.equal(daderVan({}, null, B), null);
});
