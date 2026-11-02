// Tests voor de gastenkring: wie een gast in zijn prompt te zien krijgt, en wanneer een andere gast
// op hem reageert. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ONDERLING_KANS, ONDERLING_COOLDOWN_MS, INVAL_PAUZE_MS, DAGGASTEN, schetsVan, andereGasten, kandidatenVoorOnderling, kiesAntwoorder, kiesInvaller, kiesDaggasten,
  GROET_POGINGEN, planOchtendgroet, teGroeten, WENS_GEWICHT, telWensen,
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

test('daggasten: drie afwezige gasten per dag, niet die van gisteren, nooit een gerichte', () => {
  const p = (actief, extra = {}) => ({ naam: 'x', actief, ...extra });
  const personas = {
    benito: p(true), a: p(false), b: p(false), c: p(false), d: p(false), e: p(false), f: p(false),
    gericht: p(false, { alleenVoorLid: 'U1' }),
  };
  assert.equal(DAGGASTEN, 3);
  const vandaag = kiesDaggasten(personas, { rng: () => 0 });
  assert.deepEqual(vandaag, ['a', 'b', 'c']);
  // Morgen drie anderen, zolang dat kan.
  assert.deepEqual(kiesDaggasten(personas, { vorige: vandaag, rng: () => 0 }), ['d', 'e', 'f']);
  // Nooit een aanwezige of gerichte gast, nooit dubbel.
  for (let i = 0; i < 50; i++) {
    const keus = kiesDaggasten(personas, { vorige: ['d'] });
    assert.equal(new Set(keus).size, 3);
    assert.ok(keus.every(id => /^[a-f]$/.test(id)), keus.join());
  }
  // Te weinig verse gasten: dan mogen die van gisteren toch weer; te weinig afwezigen: wie er is.
  assert.equal(kiesDaggasten(personas, { vorige: ['a', 'b', 'c', 'd'] }).length, 3);
  assert.deepEqual(kiesDaggasten({ benito: p(true), a: p(false) }), ['a']);
  assert.deepEqual(kiesDaggasten({}), []);
});

test('de ochtendgroet verdeelt de gasten over het uur, één per vak', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (const rng of [() => 0, () => 0.999999, Math.random]) {
    const plan = planOchtendgroet(ids, { rng });
    assert.deepEqual(Object.keys(plan).sort(), ids);
    const minuten = Object.values(plan).sort((a, b) => a - b);
    assert.ok(minuten[0] >= 0 && minuten.at(-1) <= 59);
    assert.equal(new Set(minuten).size, ids.length); // elk een eigen minuut
    minuten.forEach((m, i) => assert.ok(m >= Math.floor(i * 60 / 7) && m < (i + 1) * 60 / 7, `${m} in vak ${i}`));
  }
  assert.deepEqual(planOchtendgroet([]), {});
  assert.deepEqual(planOchtendgroet(['a'], { rng: () => 0 }), { a: 0 });
});

test('wie pas om half negen opstart, verdeelt alleen het restant', () => {
  const plan = planOchtendgroet(['a', 'b', 'c'], { van: 30, rng: () => 0.999999 });
  assert.deepEqual(Object.values(plan).sort((a, b) => a - b), [39, 49, 59]);
});

test('aan de beurt: minuut geweest, nog niet gegroet, niet te vaak gefaald', () => {
  const staat = { plan: { a: 5, b: 20, c: 3, d: 40 }, gegroet: ['c'], pogingen: { b: GROET_POGINGEN } };
  assert.deepEqual(teGroeten(staat, 2), []);
  assert.deepEqual(teGroeten(staat, 30), ['a']);
  assert.deepEqual(teGroeten({ ...staat, pogingen: { b: 1 } }, 59), ['a', 'b', 'd']);
  assert.deepEqual(teGroeten(undefined, 59), []);
});

test('wens voor het lot: gewenste gasten wegen zwaarder, ook als ze gisteren kwamen', () => {
  const p = (actief) => ({ naam: 'x', actief });
  const personas = { a: p(false), b: p(false), c: p(false), d: p(false), e: p(false), f: p(false), g: p(false), h: p(false), i: p(false), j: p(false) };
  assert.deepEqual(telWensen({ U1: 'c', U2: 'c', U3: 'f' }), { c: 2, f: 1 });
  assert.deepEqual(telWensen(undefined), {});
  // Met rng 0 valt de eerste worp op de eerste in de pot; met wensen weegt 'j' (tien keer gewenst) zo
  // zwaar dat een worp halverwege hem treft.
  assert.equal(kiesDaggasten(personas, { rng: () => 0.5, aantal: 1, wensen: { j: 10 } })[0], 'j');
  // Gisteren gekomen, maar gewenst: mag terug.
  assert.ok(kiesDaggasten(personas, { vorige: ['j'], rng: () => 0.5, aantal: 1, wensen: { j: 10 } }).includes('j'));
  // Statistisch: één wens geeft ruwweg (1 + WENS_GEWICHT) keer zoveel kans op de eerste plek.
  let raak = 0;
  const n = 4000;
  for (let k = 0; k < n; k++) if (kiesDaggasten(personas, { aantal: 1, wensen: { c: 1 } })[0] === 'c') raak++;
  const verwacht = (1 + WENS_GEWICHT) / (9 + 1 + WENS_GEWICHT);
  assert.ok(Math.abs(raak / n - verwacht) < 0.04, `${raak / n} vs ${verwacht}`);
  // Een wens voor een aanwezige of onbekende gast doet niets.
  assert.equal(kiesDaggasten({ a: p(true), b: p(false) }, { wensen: { a: 5, zz: 5 } }).join(), 'b');
});
