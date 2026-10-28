// Tests voor de gastenkring: wie een gast in zijn prompt te zien krijgt, en wanneer een andere gast
// op hem reageert. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ONDERLING_KANS, ONDERLING_COOLDOWN_MS, INVAL_PAUZE_MS, schetsVan, andereGasten, kandidatenVoorOnderling, kiesAntwoorder, kiesInvaller,
} = require('./gastenkring.js');

const BENITO = '### Spreekstijl en gedrag van Benito Mussolini – Il Duce del Frituur\n\nBenito is een autoritaire, megalomane frituurdictator met het ego van een CEO en het zelfreflectievermogen van een diepvrieskroket.\n\n**Hij geeft altijd lange antwoorden.**';
const SATEBAL = 'Jij bent De Heilige Mr. Satébal — een zelfingenomen, droog-grappige tegenhanger van de Kroket God. Waar de Kroket God de kroket vereert, gelooft hij in saté.\n\nKERNREGELS:\n1. Spot.';
const BROODJE = '# Persona: Broodje\n\nJij bent **Broodje**, een volledig onverklaarbaar wezen en de onvoorspelbare vriend van de Kroket groep.\n\nNiemand weet waar je vandaan komt.';

test('de schets: de eerste echte zin, zonder kopje, opmaak of "Jij bent"', () => {
  assert.equal(schetsVan(BENITO), 'Benito is een autoritaire, megalomane frituurdictator met het ego van een CEO en het zelfreflectievermogen van een diepvrieskroket.');
  assert.equal(schetsVan(SATEBAL), 'De Heilige Mr. Satébal — een zelfingenomen, droog-grappige tegenhanger van de Kroket God.');
  assert.equal(schetsVan(BROODJE), 'Broodje, een volledig onverklaarbaar wezen en de onvoorspelbare vriend van de Kroket groep.');
});

test('de schets: een initiaal is geen zinseinde', () => {
  assert.equal(schetsVan('Jij bent President Donald J. Trump, de grootste snackdealer ooit. Niemand frituurt beter.'),
    'President Donald J. Trump, de grootste snackdealer ooit.');
});

test('de schets blijft kort en eindigt niet midden in een woord', () => {
  const lang = 'Dit is een gast ' + 'met een heel lange omschrijving '.repeat(12) + 'die maar doorgaat.';
  const s = schetsVan(lang);
  assert.ok(s.length <= 160, s.length);
  assert.match(s, /\w…$/);
  assert.equal(schetsVan(''), '');
  assert.equal(schetsVan(null), '');
});

const KRING = {
  'benito-m': { naam: 'Benito M.', actief: true, ongevraagd: true },
  satebal: { naam: 'De Heilige Mr. Satébal', actief: false, ongevraagd: true },
  'alex-soze': { naam: 'Alex Soze', actief: true, ongevraagd: true },
  stil: { naam: 'De Zwijger', actief: true, ongevraagd: false },
  geheim: { naam: 'De Fluisteraar', actief: true, ongevraagd: true, alleenVoorLid: 'U_X' },
  weekvijand: { naam: 'Het Broodje Gezond', actief: true, ongevraagd: true },
};

test('andere gasten: actief, niet hijzelf, niet gericht', () => {
  assert.deepEqual(andereGasten(KRING, 'Benito M.').map(p => p.naam), ['Alex Soze', 'De Zwijger', 'Het Broodje Gezond']);
  assert.ok(andereGasten({ ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`g${i}`, { naam: `Gast ${i}` }])) }, 'X').length <= 6);
});

test('kandidaten om te reageren: ongevraagd mag, niet de spreker, niet gericht, niet in cooldown', () => {
  const ids = kandidatenVoorOnderling(KRING, 'Benito M.').map(([id]) => id);
  assert.deepEqual(ids, ['alex-soze', 'weekvijand']);
  assert.deepEqual(kandidatenVoorOnderling(KRING, 'Benito M.', id => id === 'alex-soze').map(([id]) => id), ['weekvijand']);
});

test('de worp: een kleine kans, en daarna een kanaalbrede rem van drie uur', () => {
  const k = kandidatenVoorOnderling(KRING, 'Benito M.');
  assert.ok(ONDERLING_KANS > 0 && ONDERLING_KANS <= 0.1);
  assert.equal(ONDERLING_COOLDOWN_MS, 3 * 3_600_000);
  assert.equal(kiesAntwoorder(k, { nu: 1e10, rng: () => 0.5 }), null);                  // worp mis
  assert.deepEqual(kiesAntwoorder(k, { nu: 1e10, rng: () => 0.01 })[0], 'alex-soze');    // worp raak
  assert.equal(kiesAntwoorder(k, { nu: 1e10, laatste: 1e10 - 3_600_000, rng: () => 0 }), null); // rem
  assert.ok(kiesAntwoorder(k, { nu: 1e10, laatste: 1e10 - 3 * 3_600_000, rng: () => 0 }));
  assert.equal(kiesAntwoorder([], { nu: 1e10, rng: () => 0 }), null);
});

// 28 oktober 2026: na een herstart vielen tijdens het Vetbad binnen twee minuten zeven gasten in.
test('ongevraagd invallen: één worp per bericht, hoogstens één gast, daarna een kanaalbrede pauze', () => {
  const zeven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => [id, { naam: id }, 0.08]);
  const nu = 1e10;
  // Eén worp voor allemaal: mis is voor iedereen mis, hoeveel gasten er ook zijn.
  assert.equal(kiesInvaller(zeven, { nu, rng: () => 0.5 }), null);
  // Raak: precies één gast, nooit een rij.
  assert.equal(kiesInvaller(zeven, { nu, rng: () => 0.05 })[0], 'a');
  // De weekvijand (hogere kans) is ook raak waar de anderen mis zijn.
  const metVijand = [...zeven, ['weekvijand', { naam: 'De Frikandel' }, 0.14]];
  assert.equal(kiesInvaller(metVijand, { nu, rng: () => 0.1 })[0], 'weekvijand');
  // Kort na een gastbericht zwijgt iedereen ongevraagd; na de pauze mag het weer.
  assert.equal(kiesInvaller(zeven, { nu, laatste: nu - 5 * 60_000, rng: () => 0 }), null);
  assert.ok(kiesInvaller(zeven, { nu, laatste: nu - INVAL_PAUZE_MS, rng: () => 0 }));
  assert.equal(kiesInvaller([], { nu, rng: () => 0 }), null);
});
