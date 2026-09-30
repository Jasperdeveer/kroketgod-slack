// Tests voor De Voorraadkelder (vooruit gegenereerde kanaalinhoud). Draaien via het ingebouwde
// node:test, zonder externe afhankelijkheden. Run: `npm test` of `node --test`.
//
// KROKET_STATE_DIR wijst de state-laag naar een tijdelijke map VOORDAT de modules geladen worden,
// zodat deze test niet over de echte voorraad.json heen schrijft.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-voorraad-'));
process.env.KROKET_STATE_DIR = TMP;

const {
  VOORRAAD_BESTAND,
  MAX_CARRY_DAGEN,
  MAX_PER_SOORT,
  dagKeyAms,
  vingerafdruk,
  ruimVoorraadOp,
  haalUitVoorraad,
  legInVoorraad,
  vulVoorraad,
  voorraadStand,
} = require('./voorraad');

const PAD = path.join(TMP, VOORRAAD_BESTAND);

function leegVoorraad() {
  try { fs.rmSync(PAD); } catch (_) {}
}

// Schrijft rechtstreeks een kelder met gekozen tijdstempels — nodig om veroudering te testen
// zonder de klok te verzetten.
function zetVoorraad(data) {
  fs.writeFileSync(PAD, JSON.stringify(data, null, 2));
}

const DAG_MS = 86_400_000;

// ── Hulpfuncties ───────────────────────────────────────────────────────────────

test('dagKeyAms levert een YYYY-MM-DD-sleutel', () => {
  assert.match(dagKeyAms(), /^\d{4}-\d{2}-\d{2}$/);
});

test('vingerafdruk negeert opmaak en interpunctie', () => {
  assert.equal(vingerafdruk('De *kroket* is heilig!'), vingerafdruk('de kroket, is heilig'));
  assert.notEqual(vingerafdruk('de kroket is heilig'), vingerafdruk('de bitterbal is heilig'));
});

// ── Inleggen ───────────────────────────────────────────────────────────────────

test('inleggen en uitnemen levert dezelfde tekst', () => {
  leegVoorraad();
  assert.equal(legInVoorraad('feitje', 'De kroket werd in 1902 heilig verklaard.'), true);
  const uit = haalUitVoorraad('feitje');
  assert.equal(uit.tekst, 'De kroket werd in 1902 heilig verklaard.');
  assert.equal(uit.vanVandaag, true);
});

test('uitnemen verwijdert het item uit de kelder', () => {
  leegVoorraad();
  legInVoorraad('feitje', 'eenmalige wijsheid');
  assert.ok(haalUitVoorraad('feitje'));
  assert.equal(haalUitVoorraad('feitje'), null);
});

test('lege tekst wordt geweigerd', () => {
  leegVoorraad();
  assert.equal(legInVoorraad('feitje', ''), false);
  assert.equal(legInVoorraad('feitje', '   '), false);
  assert.equal(legInVoorraad('feitje', null), false);
});

test('duplicaten worden geweigerd, ook bij andere opmaak', () => {
  leegVoorraad();
  assert.equal(legInVoorraad('feitje', 'De kroket is heilig'), true);
  assert.equal(legInVoorraad('feitje', 'de *kroket* is heilig!'), false);
  assert.equal(voorraadStand().feitje.totaal, 1);
});

test('een soort loopt niet voller dan MAX_PER_SOORT', () => {
  leegVoorraad();
  for (let i = 0; i < MAX_PER_SOORT + 5; i++) legInVoorraad('feitje', `wijsheid nummer ${i}`);
  assert.equal(voorraadStand().feitje.totaal, MAX_PER_SOORT);
});

test('een lege kelder geeft null, geen fout', () => {
  leegVoorraad();
  assert.equal(haalUitVoorraad('bestaatniet'), null);
});

// ── Voorrang en veroudering ────────────────────────────────────────────────────

test('inhoud van vandaag krijgt voorrang op oudere noodvoorraad', () => {
  leegVoorraad();
  const nu = Date.now();
  zetVoorraad({ feitje: [
    { tekst: 'van gisteren', gemaakt: nu - DAG_MS, dagKey: dagKeyAms(new Date(nu - DAG_MS)) },
    { tekst: 'van vandaag', gemaakt: nu, dagKey: dagKeyAms() },
  ] });
  const uit = haalUitVoorraad('feitje');
  assert.equal(uit.tekst, 'van vandaag');
  assert.equal(uit.vanVandaag, true);
});

test('zonder inhoud van vandaag gaat de oudste verse tekst alsnog uit', () => {
  leegVoorraad();
  const nu = Date.now();
  zetVoorraad({ feitje: [
    { tekst: 'van twee dagen terug', gemaakt: nu - 2 * DAG_MS, dagKey: dagKeyAms(new Date(nu - 2 * DAG_MS)) },
    { tekst: 'van gisteren', gemaakt: nu - DAG_MS, dagKey: dagKeyAms(new Date(nu - DAG_MS)) },
  ] });
  const uit = haalUitVoorraad('feitje');
  // Stilte is erger dan een iets verouderde stemming, dus er komt wél iets uit.
  assert.equal(uit.tekst, 'van twee dagen terug');
  assert.equal(uit.vanVandaag, false);
});

test('te oude inhoud wordt niet meer geserveerd', () => {
  leegVoorraad();
  const teOud = Date.now() - (MAX_CARRY_DAGEN + 1) * DAG_MS;
  zetVoorraad({ feitje: [{ tekst: 'muf', gemaakt: teOud, dagKey: '2020-01-01' }] });
  assert.equal(haalUitVoorraad('feitje'), null);
});

test('opruimen gooit verlopen inhoud weg en laat verse staan', () => {
  leegVoorraad();
  const nu = Date.now();
  zetVoorraad({ feitje: [
    { tekst: 'muf', gemaakt: nu - (MAX_CARRY_DAGEN + 1) * DAG_MS, dagKey: '2020-01-01' },
    { tekst: 'vers', gemaakt: nu, dagKey: dagKeyAms() },
  ], leeg: [{ tekst: 'muf', gemaakt: nu - (MAX_CARRY_DAGEN + 1) * DAG_MS, dagKey: '2020-01-01' }] });
  assert.equal(ruimVoorraadOp(), 2);
  const stand = voorraadStand();
  assert.equal(stand.feitje.totaal, 1);
  assert.equal(stand.leeg, undefined); // helemaal leeggelopen soorten verdwijnen
});

// ── Vullen ─────────────────────────────────────────────────────────────────────

test('vullen maakt precies het tekort aan', async () => {
  leegVoorraad();
  legInVoorraad('feitje', 'al aanwezig');
  let n = 0;
  const uit = await vulVoorraad('feitje', 3, async () => `verse wijsheid ${++n}`);
  assert.equal(uit.gemaakt, 2);
  assert.equal(voorraadStand().feitje.totaal, 3);
});

test('vullen doet niets als de kelder al op peil is', async () => {
  leegVoorraad();
  legInVoorraad('feitje', 'een');
  legInVoorraad('feitje', 'twee');
  let aangeroepen = 0;
  const uit = await vulVoorraad('feitje', 2, async () => { aangeroepen++; return 'drie'; });
  assert.equal(aangeroepen, 0);
  assert.equal(uit.gemaakt, 0);
});

test('een generator die blijft falen loopt niet eindeloos door', async () => {
  leegVoorraad();
  let aangeroepen = 0;
  const uit = await vulVoorraad('feitje', 2, async () => { aangeroepen++; return null; });
  assert.equal(uit.gemaakt, 0);
  assert.equal(uit.mislukt, 6); // tekort (2) × 3 pogingen, dan stoppen
  assert.equal(aangeroepen, 6);
});

test('een generator die gooit breekt het vullen niet af', async () => {
  leegVoorraad();
  let n = 0;
  const uit = await vulVoorraad('feitje', 2, async () => {
    n++;
    if (n === 1) throw new Error('provider onbereikbaar');
    return `wijsheid ${n}`;
  });
  assert.equal(uit.gemaakt, 2);
  assert.equal(uit.mislukt, 1);
});

test('een generator die steeds hetzelfde teruggeeft stopt op duplicaten', async () => {
  leegVoorraad();
  const uit = await vulVoorraad('feitje', 3, async () => 'altijd dezelfde zin');
  assert.equal(uit.gemaakt, 1);
  assert.ok(uit.dubbel >= 1);
  assert.equal(voorraadStand().feitje.totaal, 1);
});

test('voorraadStand splitst vandaag van de noodvoorraad', () => {
  leegVoorraad();
  const nu = Date.now();
  zetVoorraad({ feitje: [
    { tekst: 'gisteren', gemaakt: nu - DAG_MS, dagKey: dagKeyAms(new Date(nu - DAG_MS)) },
    { tekst: 'vandaag', gemaakt: nu, dagKey: dagKeyAms() },
  ] });
  assert.deepEqual(voorraadStand().feitje, { totaal: 2, vanVandaag: 1 });
});
