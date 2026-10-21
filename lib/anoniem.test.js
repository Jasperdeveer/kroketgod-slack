// Tests voor de vloek-anonimiteit: de neutrale tekst, de herschrijving van oude archiefregels en
// de best-effort-schoonmaak van de Kroketkroniek. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { vloekGelegdTekst, anonimiseerVloekRegel, anonimiseerKroniek } = require('./anoniem.js');

test('de tekst voor een nieuwe vloek noemt geen koper en geen prijs', () => {
  const t = vloekGelegdTekst('De Groene Kroket');
  assert.equal(t, 'Een anonieme volgeling legde een Vloek der Slappe Korst op De Groene Kroket');
  assert.doesNotMatch(t, /\d/);
});

test('een oude archiefregel wordt herschreven en de koper komt eruit', () => {
  const r = anonimiseerVloekRegel('Mr. KroketPet kocht een Vloek der Slappe Korst en legde die op De Groene Kroket (−4)');
  assert.deepEqual(r, {
    tekst: 'Een anonieme volgeling legde een Vloek der Slappe Korst op De Groene Kroket',
    koper: 'Mr. KroketPet',
  });
  assert.doesNotMatch(r.tekst, /KroketPet/);
});

test('ook met een gewoon minteken of zonder prijs', () => {
  assert.equal(anonimiseerVloekRegel('Piet kocht een Vloek der Slappe Korst en legde die op Jan (-3)').koper, 'Piet');
  assert.equal(anonimiseerVloekRegel('Piet kocht een Vloek der Slappe Korst en legde die op Jan').tekst,
    'Een anonieme volgeling legde een Vloek der Slappe Korst op Jan');
});

test('de herschrijving is idempotent: een nieuwe regel blijft staan', () => {
  assert.equal(anonimiseerVloekRegel(vloekGelegdTekst('Jan')), null);
  assert.equal(anonimiseerVloekRegel('Vloek der Slappe Korst op Jan: verbrand'), null);
  assert.equal(anonimiseerVloekRegel('Piet kocht Zegen van de Paneerlaag in de Aflatenhandel (−3)'), null);
  assert.equal(anonimiseerVloekRegel(undefined), null);
});

test('kroniek: de koper verdwijnt uit een zin over de vloek', () => {
  const tekst = 'Op dinsdag sloop Piet naar de Aflatenhandel en kocht een vloek voor Jan. Jan merkte niets.';
  const r = anonimiseerKroniek(tekst, ['Piet']);
  assert.equal(r.gewijzigd, true);
  assert.equal(r.tekst, 'Op dinsdag sloop een anonieme volgeling naar de Aflatenhandel en kocht een vloek voor Jan. Jan merkte niets.');
});

test('kroniek: dezelfde naam in een zin zonder vloek blijft staan', () => {
  const tekst = 'Piet won het duel van de week. Later vervloekte Piet zijn rivaal.';
  const r = anonimiseerKroniek(tekst, ['Piet']);
  assert.equal(r.tekst, 'Piet won het duel van de week. Later vervloekte een anonieme volgeling zijn rivaal.');
});

test('kroniek: aan het begin van de zin met een hoofdletter, ook na opmaak', () => {
  const r = anonimiseerKroniek('*Piet* legde de vloek in het donker.', ['Piet']);
  assert.equal(r.tekst, '*Een anonieme volgeling* legde de vloek in het donker.');
});

test('kroniek: een bijnaam met een punt breekt de zin niet', () => {
  const tekst = 'Mr. KroketPet vervloekte De Groene Kroket. De frituur zweeg.';
  const r = anonimiseerKroniek(tekst, ['Mr. KroketPet']);
  assert.equal(r.tekst, 'Een anonieme volgeling vervloekte De Groene Kroket. De frituur zweeg.');
});

test('kroniek: zonder bekende kopers of zonder treffer verandert er niets', () => {
  const tekst = 'Een rustige week. Niemand vervloekte iemand.';
  assert.deepEqual(anonimiseerKroniek(tekst, []), { tekst, gewijzigd: false });
  assert.deepEqual(anonimiseerKroniek(tekst, ['Piet']), { tekst, gewijzigd: false });
  // En een tweede ronde over een al geschoonde tekst doet niets meer.
  const eens = anonimiseerKroniek('Piet legde een vloek op Jan.', ['Piet']).tekst;
  assert.deepEqual(anonimiseerKroniek(eens, ['Piet']), { tekst: eens, gewijzigd: false });
});
