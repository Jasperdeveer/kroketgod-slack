// Tests voor Het Grote Archief (append-only opslag + BM25-ranker). Draaien zonder externe
// afhankelijkheden via het ingebouwde node:test. Run: `npm test` of `node --test`.
//
// Het archiefpad wordt via KROKET_ARCHIEF_PAD naar een tijdelijke map gewezen VOORDAT de module
// geladen wordt — anders zou de test het echte grootarchief.ndjson volschrijven.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kroket-archief-'));
process.env.KROKET_ARCHIEF_PAD = path.join(TMP, 'grootarchief.ndjson');

const {
  tokeniseer,
  laadArchief,
  voegToeAanArchief,
  zoekArchief,
  entriesTussen,
  willekeurigCitaat,
  archiefOmvang,
  STOPWOORDEN,
} = require('./archief');

// Elke test begint met een leeg archief; laadArchief() gooit de in-memory index ook weg.
function leegArchief() {
  try { fs.rmSync(process.env.KROKET_ARCHIEF_PAD); } catch (_) {}
  laadArchief({ stil: true });
}

// ── Tokeniseren ────────────────────────────────────────────────────────────────

test('tokeniseer haalt stopwoorden en korte woorden eruit', () => {
  assert.deepEqual(tokeniseer('De kroket is in het vetbad'), ['kroket', 'vetbad']);
});

test('tokeniseer houdt accenten binnen één woord', () => {
  // Zou een naïeve \W+-split kapotmaken ("souffl", "smeu", "g") en daarmee onvindbaar maken.
  assert.deepEqual(tokeniseer('Kaassoufflé is smeuïg'), ['kaassoufflé', 'smeuïg']);
});

test('tokeniseer is bestendig tegen niets', () => {
  assert.deepEqual(tokeniseer(''), []);
  assert.deepEqual(tokeniseer(null), []);
  assert.deepEqual(tokeniseer(undefined), []);
  assert.deepEqual(tokeniseer(42), []);
});

test('stopwoordenlijst bevat de gangbare Nederlandse ruis', () => {
  for (const w of ['de', 'het', 'een', 'niet', 'zijn', 'wordt']) {
    assert.ok(STOPWOORDEN.has(w), `"${w}" hoort een stopwoord te zijn`);
  }
});

// ── Opslag ─────────────────────────────────────────────────────────────────────

test('toevoegen schrijft één regel per entry en is direct doorzoekbaar', () => {
  leegArchief();
  assert.equal(voegToeAanArchief({ spreker: 'Jasper', tekst: 'de bamischijf is verslagen' }), true);
  assert.equal(voegToeAanArchief({ spreker: 'Rick', tekst: 'de kaassoufflé smelt' }), true);
  const regels = fs.readFileSync(process.env.KROKET_ARCHIEF_PAD, 'utf8').trim().split('\n');
  assert.equal(regels.length, 2);
  assert.equal(JSON.parse(regels[0]).spreker, 'Jasper');
  assert.equal(zoekArchief('bamischijf').length, 1);
});

test('lege tekst wordt niet gearchiveerd', () => {
  leegArchief();
  assert.equal(voegToeAanArchief({ spreker: 'Jasper', tekst: '' }), false);
  assert.equal(voegToeAanArchief({ spreker: 'Jasper', tekst: '   ' }), false);
  assert.equal(archiefOmvang().doorzoekbaar, 0);
});

test('een onleesbare regel kost dat ene bericht, niet het archief', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'Jasper', tekst: 'de bamischijf is verslagen' });
  // Simuleer een half weggeschreven regel bij stroomuitval, met daarna weer een goede regel.
  fs.appendFileSync(process.env.KROKET_ARCHIEF_PAD, '{"ts":1,"tekst":"afgeka\n');
  voegToeAanArchief({ spreker: 'Rick', tekst: 'de kaassoufflé smelt' });
  const res = laadArchief({ stil: true });
  assert.equal(res.regels, 2);
  assert.equal(res.overgeslagen, 1);
  assert.equal(zoekArchief('kaassoufflé').length, 1);
});

test('een ontbrekend archief is geen fout', () => {
  leegArchief();
  assert.deepEqual(zoekArchief('kroket'), []);
  assert.equal(archiefOmvang().doorzoekbaar, 0);
});

// ── BM25-rangschikking ─────────────────────────────────────────────────────────

test('een zeldzame term weegt zwaarder dan een veelvoorkomende', () => {
  leegArchief();
  // "kroket" staat in alles; "goulash" in precies één. Een zoekopdracht op beide hoort het
  // document met de zeldzame term bovenaan te zetten.
  for (let i = 0; i < 20; i++) voegToeAanArchief({ spreker: 'Jasper', tekst: `de kroket is heilig nummer ${i}` });
  voegToeAanArchief({ spreker: 'Rick', tekst: 'de goulash kroket werd verorberd' });
  const top = zoekArchief('kroket goulash', { n: 3 });
  assert.match(top[0].tekst, /goulash/);
});

test('kortere documenten winnen bij gelijke termfrequentie', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'Kort', tekst: 'bitterbal' });
  voegToeAanArchief({ spreker: 'Lang', tekst: 'bitterbal tussen zeer veel andere woorden die samen een lange lap tekst vormen zonder enige inhoud verder' });
  const top = zoekArchief('bitterbal', { n: 2 });
  assert.equal(top[0].spreker, 'Kort');
});

test('geen enkele match geeft een lege lijst, geen fout', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'Jasper', tekst: 'de kroket is heilig' });
  assert.deepEqual(zoekArchief('nasischijf'), []);
  // Een vraag die volledig uit stopwoorden bestaat levert geen termen op.
  assert.deepEqual(zoekArchief('de het een'), []);
});

test('n begrenst het aantal resultaten', () => {
  leegArchief();
  for (let i = 0; i < 10; i++) voegToeAanArchief({ spreker: 'Jasper', tekst: `de kroket nummer ${i} is heilig` });
  assert.equal(zoekArchief('kroket', { n: 3 }).length, 3);
});

// ── Filters ────────────────────────────────────────────────────────────────────

test('ouderDan sluit het recente venster uit', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ spreker: 'Oud', tekst: 'de bamischijf werd geveld', ts: nu - 90 * 86_400_000 });
  voegToeAanArchief({ spreker: 'Nieuw', tekst: 'de bamischijf werd geveld', ts: nu });
  const res = zoekArchief('bamischijf', { ouderDan: nu - 3_600_000 });
  assert.equal(res.length, 1);
  assert.equal(res[0].spreker, 'Oud');
});

test('nieuwerDan sluit de oude staart uit', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ spreker: 'Oud', tekst: 'de bamischijf werd geveld', ts: nu - 90 * 86_400_000 });
  voegToeAanArchief({ spreker: 'Nieuw', tekst: 'de bamischijf werd geveld', ts: nu });
  const res = zoekArchief('bamischijf', { nieuwerDan: nu - 3_600_000 });
  assert.equal(res.length, 1);
  assert.equal(res[0].spreker, 'Nieuw');
});

test('soort filtert op herkomst', () => {
  leegArchief();
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', tekst: 'de kroket is heilig' });
  voegToeAanArchief({ soort: 'kroketgod', spreker: 'Kroket God', tekst: 'de kroket is heilig' });
  const res = zoekArchief('kroket', { soort: 'lid' });
  assert.equal(res.length, 1);
  assert.equal(res[0].spreker, 'Jasper');
});

test('minLengte weert eenwoordskreten', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'Jasper', tekst: 'kroket' });
  voegToeAanArchief({ spreker: 'Rick', tekst: 'de kroket verdient een plechtige beschouwing over haar korst' });
  const res = zoekArchief('kroket', { minLengte: 20 });
  assert.equal(res.length, 1);
  assert.equal(res[0].spreker, 'Rick');
});

// ── Tijdvenster (voedt De Kroketkroniek) ───────────────────────────────────────

test('entriesTussen geeft alleen het gevraagde venster, chronologisch', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ spreker: 'A', tekst: 'te oud', ts: nu - 20 * 86_400_000 });
  voegToeAanArchief({ spreker: 'B', tekst: 'binnen het venster, ouder', ts: nu - 5 * 86_400_000 });
  voegToeAanArchief({ spreker: 'C', tekst: 'binnen het venster, nieuwer', ts: nu - 1 * 86_400_000 });
  const res = entriesTussen({ van: nu - 7 * 86_400_000, tot: nu });
  assert.deepEqual(res.map(r => r.spreker), ['B', 'C']);
});

test('entriesTussen kan op soort filteren', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ soort: 'lid', spreker: 'A', tekst: 'een uitspraak', ts: nu });
  voegToeAanArchief({ soort: 'gebeurtenis', spreker: 'De Kronieken', tekst: 'iets gebeurde', ts: nu });
  const res = entriesTussen({ van: nu - 1000, tot: nu + 1000, soort: 'gebeurtenis' });
  assert.equal(res.length, 1);
  assert.equal(res[0].tekst, 'iets gebeurde');
});

test('entriesTussen kapt van de oudste kant af, zodat het nieuwste altijd meegaat', () => {
  leegArchief();
  const nu = Date.now();
  for (let i = 0; i < 10; i++) voegToeAanArchief({ spreker: 'A', tekst: `regel ${i}`, ts: nu - (10 - i) * 1000 });
  const res = entriesTussen({ van: 0, tot: nu, max: 3 });
  assert.deepEqual(res.map(r => r.tekst), ['regel 7', 'regel 8', 'regel 9']);
});

test('entriesTussen geeft een lege lijst bij een leeg venster', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'A', tekst: 'iets', ts: Date.now() });
  assert.deepEqual(entriesTussen({ van: 0, tot: 1000 }), []);
});

// ── Willekeurig citaat (voedt Het Verhoor) ─────────────────────────────────────

const LANG = 'de kroket verdient een plechtige beschouwing over haar korst en haar ragout';

test('willekeurigCitaat levert alleen citaten van de gevraagde sprekers', () => {
  leegArchief();
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: LANG });
  voegToeAanArchief({ soort: 'lid', spreker: 'OudLid', sprekerId: 'U9', tekst: LANG });
  for (let i = 0; i < 12; i++) {
    const c = willekeurigCitaat({ sprekerIds: ['U1'] });
    assert.equal(c.sprekerId, 'U1', 'nooit een citaat van een niet-gevraagde spreker');
  }
});

test('willekeurigCitaat slaat te korte en te lange citaten over', () => {
  leegArchief();
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: 'kort' });
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: 'x'.repeat(400) });
  assert.equal(willekeurigCitaat({ minLengte: 40, maxLengte: 300 }), null);
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: LANG });
  assert.equal(willekeurigCitaat({ minLengte: 40, maxLengte: 300 }).tekst, LANG);
});

test('willekeurigCitaat neemt alleen ledenuitspraken, niet die van de bot', () => {
  leegArchief();
  voegToeAanArchief({ soort: 'kroketgod', spreker: 'Kroket God', tekst: LANG });
  assert.equal(willekeurigCitaat({ soort: 'lid' }), null);
});

test('willekeurigCitaat respecteert uitgesloten tijdstempels', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: LANG, ts: nu });
  assert.equal(willekeurigCitaat({ uitgesloten: new Set([nu]) }), null);
  assert.equal(willekeurigCitaat({ uitgesloten: new Set([nu - 1]) }).ts, nu);
});

test('willekeurigCitaat kan om oudere uitspraken vragen', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ soort: 'lid', spreker: 'Jasper', sprekerId: 'U1', tekst: LANG, ts: nu });
  assert.equal(willekeurigCitaat({ ouderDan: nu - 86_400_000 }), null);
  voegToeAanArchief({ soort: 'lid', spreker: 'Rick', sprekerId: 'U2', tekst: LANG, ts: nu - 10 * 86_400_000 });
  assert.equal(willekeurigCitaat({ ouderDan: nu - 86_400_000 }).sprekerId, 'U2');
});

test('willekeurigCitaat geeft null bij een leeg archief', () => {
  leegArchief();
  assert.equal(willekeurigCitaat(), null);
});

// ── Omvang ─────────────────────────────────────────────────────────────────────

test('archiefOmvang rapporteert wat er in het venster zit', () => {
  leegArchief();
  const nu = Date.now();
  voegToeAanArchief({ spreker: 'Jasper', tekst: 'de eerste kroket', ts: nu - 1000 });
  voegToeAanArchief({ spreker: 'Rick', tekst: 'de tweede bitterbal', ts: nu });
  const o = archiefOmvang();
  assert.equal(o.doorzoekbaar, 2);
  assert.equal(o.sprekers, 2);
  assert.equal(o.oudste, nu - 1000);
  assert.equal(o.nieuwste, nu);
  assert.ok(o.bytes > 0);
  assert.ok(o.termen > 0);
});

test('de tekst wordt afgekapt zodat één bericht het archief niet kan opblazen', () => {
  leegArchief();
  voegToeAanArchief({ spreker: 'Jasper', tekst: 'kroket '.repeat(500) });
  assert.equal(zoekArchief('kroket')[0].tekst.length, 500);
});
