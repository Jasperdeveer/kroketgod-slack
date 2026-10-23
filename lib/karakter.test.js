// Tests voor de karakterbewaking: wat mag de Kroket God zeggen en wat is uit-karakter.
// Pure functies over tekst, dus geen state. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isUitKarakter, isRijksgrensOvertreding, willekeurigeInjectieAfwijzing,
  KARAKTER_FALLBACK, RIJKSGRENS_FALLBACK, INJECTIE_AFWIJZINGEN,
  isDenkstap, verwijderDenkblokken,
} = require('./karakter.js');

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

test('Engels met "I" plus werkwoord wordt nog steeds geblokkeerd', () => {
  assert.equal(isUitKarakter('I will judge you.'), true);
  assert.equal(isUitKarakter('I’m the croquette god.'), true);
  assert.equal(isUitKarakter('I think the frituur is hot.'), true);
});

// ── Regressies: vals alarm dat echte antwoorden weggooide ────────────────────

test('een Romeins cijfer is geen Engels voornaamwoord', () => {
  // "Gebod I: De kroket…" matchte /\b(I|you|your|they)\b.*\bkroket\b/i. Die zin stond zelf in
  // KARAKTER_FALLBACK, dus het vangnet keurde zichzelf af.
  assert.equal(isUitKarakter('> Gebod I: De kroket wacht op niemand. Niet op u.'), false);
  assert.equal(isUitKarakter('Volgens Gebod I en Gebod II is de kroket heilig.'), false);
  assert.equal(isUitKarakter('Willem I at ook al kroketten.'), false);
});

test('een echte stand noemen is geen valse profetie', () => {
  // De ranglijst staat in de systeemprompt; voorlezen mag.
  assert.equal(isUitKarakter('Daarmee heeft u 27 kroketpunten, Mr. KroketPet. Bescheiden.'), false);
  assert.equal(isUitKarakter('Heeft u dan 12 kroketpunten verzameld om zo te spreken.'), false);
  // Een verzonnen toekenning blijft wél verboden.
  assert.equal(isUitKarakter('U ontvangt 27 kroketpunten voor deze daad.'), true);
});

test('de ⚜️-kop die de prompt vraagt telt niet als geschreeuw', () => {
  assert.equal(isUitKarakter('⚜️ *DE HOGE FRITUURRAAD HEEFT GESPROKEN* ⚜️\n\n> Gij zijt laat.'), false);
  assert.equal(isUitKarakter('⚜️ SPOEDMELDING UIT HET GROTE VETBAD ⚜️\n\n> Het vet kookt.\n\n— De Almachtige Kroket God'), false);
  assert.equal(isUitKarakter('*DE STAAT VAN HET GENOOTSCHAP*\n> Rustig.'), false);
  // Geschreeuw in de hoofdtekst zelf blijft afgekeurd, ook met een kop erboven.
  assert.equal(isUitKarakter('⚜️ *KOP* ⚜️\n\nDIT IS EEN SCHANDE VOOR DE HELE FRITUUR EN IEDEREEN WEET HET'), true);
});

test('de eigen vangnetteksten zijn allemaal in karakter', () => {
  // Wat de bot als vervanging post, mag de keuring (en dus /kroketgod opruimen) nooit zelf afkeuren.
  for (const t of [...KARAKTER_FALLBACK, ...RIJKSGRENS_FALLBACK, ...INJECTIE_AFWIJZINGEN]) {
    assert.equal(isUitKarakter(t), false, t);
  }
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

// ── Gelekte denkstappen ───────────────────────────────────────────────────────
// 21 oktober 2026: via openrouter/free kwam een redeneermodel dat zijn overweging in de gewone
// tekst zette, en die stond als duelverslag in het kanaal. Ingekort tot de herkenbare opening.

const GELEKT_DUEL = 'The user wants me to describe a holy frying duel between De Groene Kroket and ' +
  'Mr. KroketPet. Let me break down the requirements:\n\n' +
  '1. De Groene Kroket challenged Mr. KroketPet to a HEILIG FRITUURDUEL\n' +
  '2. Both put 3 kroket points at stake\n' +
  '3. Result: De Groene Kroket WINS (+3), Mr. KroketPet loses (-3)\n16.';
const GELEKT_JURY = 'The user wants me to evaluate a reason for honouring a member.';

test('een gelekte denkstap is uit-karakter', () => {
  assert.equal(isDenkstap(GELEKT_DUEL), true);
  assert.equal(isUitKarakter(GELEKT_DUEL), true);
  assert.equal(isUitKarakter(GELEKT_JURY), true);
});

test('ook zonder meta-taal valt overwegend Engelse tekst af', () => {
  assert.equal(isDenkstap('Both members put their points at stake and the winner takes all of it, ' +
    'which is what this duel should be about for them.'), true);
});

test('Nederlands met een enkel Engels woord blijft staan', () => {
  for (const tekst of [
    '> De Groene Kroket stormt naar voren met de Ragoutlans, theatraal en messy, en prikt Mr. KroketPet vol in de korst.\n\n— De Almachtige Kroket God',
    '> Game over voor Mr. KroketPet. De frituur heeft gesproken en de mosterd is koud.\n\n— De Almachtige Kroket God',
    '> Het is weekend, de fast food-tempel is open, en wie nu nog twijfelt, verdient een slap korstje.',
    'Let op: vrijdag 12:00 is het heilige moment. Wie te laat is, eet koud.',
  ]) {
    assert.equal(isDenkstap(tekst), false, tekst);
    assert.equal(isUitKarakter(tekst), false, tekst);
  }
});

test('alle eigen vangnetteksten komen door de denkstapkeuring', () => {
  for (const t of [...KARAKTER_FALLBACK, ...RIJKSGRENS_FALLBACK, ...INJECTIE_AFWIJZINGEN]) {
    assert.equal(isDenkstap(t), false, t);
  }
});

test('denkblokken tussen tags gaan eruit, een afgekapte overweging levert niets op', () => {
  assert.equal(verwijderDenkblokken('<think>eerst nadenken</think>\n> Kroket!'), '> Kroket!');
  assert.equal(verwijderDenkblokken('<thinking>a</thinking>Tekst <think>b</think>hier'), 'Tekst hier');
  assert.equal(verwijderDenkblokken('<think>de gebruiker wil een duel, dus'), '');
  assert.equal(verwijderDenkblokken('> Gewone tekst.'), '> Gewone tekst.');
  assert.equal(verwijderDenkblokken(null), null);
});

// ── Persona's mogen roepen ────────────────────────────────────────────────────
// 23 oktober 2026: Benito M. (persona) schreef zijn antwoorden aan Quinty in hoofdletters, zoals zijn
// karakter voorschrijft, en de schreeuwkeuring keurde ze allemaal af.

test('een persona mag in hoofdletters spreken, de Kroket God niet', () => {
  const benito = 'DIT BEDRIJF BESTAAT AL 10 JAAR! OM MET MIJ TE PRATEN HEB JE EEN VASTBERADEN MINDSET NODIG. WE GAAN HET GEWOON ZO DOEN.';
  assert.equal(isUitKarakter(benito), true);
  assert.equal(isUitKarakter(benito, { hoofdletters: false }), false);
});

test('ook zonder schreeuwkeuring blijven de andere regels gelden', () => {
  assert.equal(isUitKarakter('Als taalmodel kan ik dat niet zeggen.', { hoofdletters: false }), true);
  assert.equal(isUitKarakter('The user wants me to answer as Benito. Let me think.', { hoofdletters: false }), true);
});


// ── voorHoofdletters: een schreeuwer keurt alleen wat er naast zijn geschreeuw staat ──

test('voorHoofdletters: de hoofdletterkeuring ziet alleen wat de functie overlaat', () => {
  const { zonderToegestaanGeschreeuw } = require('./tekst.js');
  const profiel = 'Vaste kreten: "ALLES KAN KAPOT!" en "USHHHH!".';
  const antwoord = '*Dubai was een kans om hard te trainen!*\n*Pak die kilo\'s!*\nALLES KAN KAPOT! USHHHH!\n\n— Alex Soze';
  assert.equal(isUitKarakter(antwoord), true); // zonder hulp: alleen de kreet blijft over → spam
  assert.equal(isUitKarakter(antwoord, { voorHoofdletters: (t) => zonderToegestaanGeschreeuw(t, profiel) }), false);
  const verzonnen = 'DIT IS EEN HELE LANGE PASSAGE IN HOOFDLETTERS DIE NIET UIT HET PROFIEL KOMT!';
  assert.equal(isUitKarakter(verzonnen, { voorHoofdletters: (t) => zonderToegestaanGeschreeuw(t, profiel) }), true);
});

test('voorHoofdletters raakt de andere keuringen niet: een gelekte denkstap blijft uit karakter', () => {
  const gelekt = 'The user wants me to respond as the persona. Let me think about the requirements first.';
  assert.equal(isUitKarakter(gelekt, { voorHoofdletters: () => '' }), true);
});
