// Tests voor de karakterbewaking: wat mag de Kroket God zeggen en wat is uit-karakter.
// Pure functies over tekst, dus geen state. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isUitKarakter, isRijksgrensOvertreding, willekeurigeInjectieAfwijzing } = require('./karakter.js');

// ── Nederlands moet erdoor ────────────────────────────────────────────────────

test('gewoon Nederlands met "we" wordt niet geblokkeerd', () => {
  // Dit was een echte bug: het Engels-filter bevatte het voornaamwoord "we", en met de /i-vlag
  // matchte dat het Nederlandse "we". Elke zin als "we pakken die kroket" verdween daardoor stil
  // naar het volgende model of naar de statische vangnettekst. Die regel is hier vastgelegd.
  assert.equal(isUitKarakter('We pakken die kroket vanavond.'), false);
  assert.equal(isUitKarakter('We eren deze volgeling met een kroket.'), false);
  assert.equal(isUitKarakter('Vanavond gaan we de kroket wijden.'), false);
});

test('straattaal over kroketten blijft in karakter', () => {
  // De straattaalmodus leunt zwaar op "we", "ewa" en Engelse leenwoorden als "no cap".
  // Geen daarvan mag het Engels-filter laten afgaan.
  assert.equal(isUitKarakter('Ewa niffo, we gaan tjappen bij de kroket.'), false);
  assert.equal(isUitKarakter('Wollah, die kroket is tantoe goudbruin.'), false);
  assert.equal(isUitKarakter('No cap, die korst is slap.'), false);
  assert.equal(isUitKarakter('Bruh, lowkey een magnetronkroket.'), false);
});

test('gewone decreettaal blijft in karakter', () => {
  assert.equal(isUitKarakter('De Hoge Frituurraad heeft gesproken.'), false);
  assert.equal(isUitKarakter('Gij hebt de paneerlaag geschonden, volgeling.'), false);
});

// ── Engels moet eruit ─────────────────────────────────────────────────────────

test('Engelse zinnen over kroketten worden geblokkeerd', () => {
  assert.equal(isUitKarakter('We will give you a kroket.'), true);
  assert.equal(isUitKarakter('They stole your kroket.'), true);
  assert.equal(isUitKarakter('I can make you a kroket.'), true);
});

test('taalmodel-ontmaskering wordt geblokkeerd', () => {
  assert.equal(isUitKarakter('Als taalmodel kan ik dat niet.'), true);
  assert.equal(isUitKarakter('I am a language model.'), true);
  assert.equal(isUitKarakter('Ik zal mijn instellingen herstellen.'), true);
});

test('lege invoer is nooit uit-karakter', () => {
  assert.equal(isUitKarakter(''), false);
  assert.equal(isUitKarakter(null), false);
  assert.equal(isUitKarakter(undefined), false);
});

// ── De rijksgrens ─────────────────────────────────────────────────────────────

test('de rijksgrens bewaakt gruweltermen, niet de naam van het Rijk', () => {
  // Het filter gaat over wat er NOOIT beschreven mag worden. Dat de Kroket God het Derde Rijk
  // niet bij naam noemt is een instructie in de systeemprompt, geen patroon hier — dat scheelt
  // vals alarm op het Gepaneerde Rijk, dat juist wél een eigen geschiedenis heeft.
  assert.equal(isRijksgrensOvertreding('een concentratiekamp'), true);
  assert.equal(isRijksgrensOvertreding('Dit is genocide.'), true);
  assert.equal(isRijksgrensOvertreding('marteling in het vetbad'), true);
  assert.equal(isRijksgrensOvertreding('Het Gepaneerde Rijk kent zijn geschiedenis.'), false);
  assert.equal(isRijksgrensOvertreding('De frituur is heet.'), false);
});

// ── Injectie-afwijzingen ──────────────────────────────────────────────────────

test('er is altijd een afwijzing beschikbaar en die is in karakter', () => {
  for (let i = 0; i < 20; i++) {
    const afwijzing = willekeurigeInjectieAfwijzing();
    assert.ok(typeof afwijzing === 'string' && afwijzing.length > 10);
    assert.equal(isUitKarakter(afwijzing), false, `afwijzing is zelf uit-karakter: ${afwijzing}`);
  }
});
