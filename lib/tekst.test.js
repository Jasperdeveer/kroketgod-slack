// Tests voor de tekstbewerking op LLM-uitvoer. Pure functies, dus geen state of tijdelijke
// mappen nodig. Run: `npm test` of `node --test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isHoofdletterSpam,
  ontschreeuw,
  isSchreeuwer,
  zonderToegestaanGeschreeuw,
  roepUit,
  zinnenMetHoofdletter,
  kapAfOpZinsgrens,
  normaliseerOndertekening,
  splitsVoorBlokken,
  BLOK_MAX, kiesKlasse } = require('./tekst.js');

// ── splitsVoorBlokken ─────────────────────────────────────────────────────────
// Aanleiding: postToChannel kapte hard af op 2999 tekens, waardoor de staart van een lang
// bericht — inclusief de ondertekening — middenin een woord verdween.

test('splitsVoorBlokken: korte tekst blijft één blok', () => {
  assert.deepEqual(splitsVoorBlokken('Zoals het hoort.'), ['Zoals het hoort.']);
});

test('splitsVoorBlokken: leegte en niet-tekst leveren geen blokken', () => {
  for (const invoer of ['', '   ', null, undefined, 42, {}]) {
    assert.deepEqual(splitsVoorBlokken(invoer), []);
  }
});

test('splitsVoorBlokken: elk blok blijft binnen het maximum', () => {
  const alinea = 'De frituur heeft gehoord en de frituur is tevreden. '.repeat(12).trim();
  const tekst = Array.from({ length: 20 }, () => alinea).join('\n\n');
  const blokken = splitsVoorBlokken(tekst);
  assert.ok(blokken.length > 1, 'moet gesplitst zijn');
  for (const b of blokken) assert.ok(b.length <= BLOK_MAX, `blok van ${b.length} tekens`);
});

test('splitsVoorBlokken: geen enkel teken gaat verloren', () => {
  const tekst = Array.from({ length: 30 },
    (_, i) => `Alinea ${i}: ${'paneerlaag '.repeat(30).trim()}`).join('\n\n');
  const samen = splitsVoorBlokken(tekst).join(' ').replace(/\s+/g, ' ');
  const bron = tekst.replace(/\s+/g, ' ').trim();
  assert.equal(samen, bron);
});

test('splitsVoorBlokken: de ondertekening blijft behouden', () => {
  const tekst = `${'De korst is heilig. '.repeat(400)}\n\n— De Almachtige Kroket God`;
  const blokken = splitsVoorBlokken(tekst);
  assert.ok(blokken.at(-1).includes('— De Almachtige Kroket God'),
    'de laatste regel mag niet wegvallen');
});

test('splitsVoorBlokken: splitst op zinsgrens binnen één lange alinea', () => {
  const zin = 'Gij zult de korst respecteren. ';
  const blokken = splitsVoorBlokken(zin.repeat(200).trim());
  assert.ok(blokken.length > 1);
  // Elk blok op één na eindigt op een compleet zinseinde.
  for (const b of blokken.slice(0, -1)) assert.match(b, /[.!?…]$/);
});

test('splitsVoorBlokken: een afkorting is geen zinsgrens', () => {
  const tekst = `Bijv. de mosterd, bijv. de ragout, ${'en zo verder, '.repeat(300)}punt.`;
  for (const b of splitsVoorBlokken(tekst)) {
    assert.ok(!/\bBijv\.$/.test(b), 'mag niet direct na "Bijv." knippen');
  }
});

test('splitsVoorBlokken: één woord langer dan het maximum wordt hard geknipt', () => {
  const monster = 'k'.repeat(BLOK_MAX * 2 + 50);
  const blokken = splitsVoorBlokken(monster);
  assert.equal(blokken.join('').length, monster.length);
  for (const b of blokken) assert.ok(b.length <= BLOK_MAX);
});

test('splitsVoorBlokken: respecteert een meegegeven maximum', () => {
  const blokken = splitsVoorBlokken('een. twee. drie. vier. vijf. zes.', 12);
  for (const b of blokken) assert.ok(b.length <= 12, `blok "${b}"`);
});

// ── kapAfOpZinsgrens ──────────────────────────────────────────────────────────

test('kapAfOpZinsgrens: complete tekst blijft ongemoeid', () => {
  const t = 'De frituur heeft gehoord. De frituur is tevreden.';
  assert.equal(kapAfOpZinsgrens(t), t);
});

test('kapAfOpZinsgrens: knipt een halve zin weg', () => {
  assert.equal(
    kapAfOpZinsgrens('De frituur heeft gehoord. En toen brak de korst midden'),
    'De frituur heeft gehoord.');
});

test('kapAfOpZinsgrens: markdown-einde geldt als compleet', () => {
  const t = '_De Kroket God heeft gesproken._';
  assert.equal(kapAfOpZinsgrens(t), t);
});

test('kapAfOpZinsgrens: zonder bruikbare grens blijft de tekst staan', () => {
  const t = 'een lange regel zonder enig leesteken erin verwerkt';
  assert.equal(kapAfOpZinsgrens(t), t);
});

// ── isHoofdletterSpam ─────────────────────────────────────────────────────────

test('isHoofdletterSpam: herkent schreeuwen', () => {
  assert.equal(isHoofdletterSpam('DE KROKET SPREEKT NIET, DE KROKET IS HET WOORD ZELF'), true);
});

test('isHoofdletterSpam: normale tekst en korte headers niet', () => {
  assert.equal(isHoofdletterSpam('De frituur heeft gehoord en is tevreden met het resultaat.'), false);
  assert.equal(isHoofdletterSpam('SPOEDMELDING'), false); // te kort om te beoordelen
});

// ── normaliseerOndertekening ──────────────────────────────────────────────────

test('normaliseerOndertekening: varianten worden één handtekening', () => {
  // Het gebruikte streepje blijft staan (de vervanging houdt $1 vast); alleen de naam erachter
  // wordt genormaliseerd.
  for (const variant of ['— Kroket God', '— De Kroket God', '- de almachtige kroket god']) {
    assert.match(normaliseerOndertekening(`> Zoals het hoort.\n${variant}`),
      /[—–-] De Almachtige Kroket God$/);
  }
});

test('normaliseerOndertekening: laat lopende tekst intact', () => {
  const t = 'De tempel van de Kroket God staat centraal in het Rijk.';
  assert.equal(normaliseerOndertekening(t), t);
});


// ── kiesKlasse: modeluitvoer als keuze lezen ─────────────────────────────────

test('een kaal antwoord wordt gelezen', () => {
  assert.equal(kiesKlasse('JA', ['ja', 'nee']), 'ja');
  assert.equal(kiesKlasse('nee', ['ja', 'nee']), 'nee');
  assert.equal(kiesKlasse('STERK', ['zwak', 'degelijk', 'sterk', 'legendarisch']), 'sterk');
});

test('een omlijst antwoord wordt ook gelezen', () => {
  assert.equal(kiesKlasse('Klasse: STERK.', ['zwak', 'sterk']), 'sterk');
  assert.equal(kiesKlasse('**degelijk**', ['degelijk', 'sterk']), 'degelijk');
  assert.equal(kiesKlasse('  Ja.\n', ['ja', 'nee']), 'ja');
});

test('hele woorden gaan vóór deelwoorden — anders leest "jammer" als "ja"', () => {
  // Dit is het hele bestaansrecht van de twee passes. Zonder de eerste pass zou een ja/nee-
  // classifier bij "jammer genoeg nee" precies het omgekeerde antwoord teruggeven.
  assert.equal(kiesKlasse('jammer genoeg nee', ['ja', 'nee']), 'nee');
  assert.equal(kiesKlasse('helaas nee', ['ja', 'nee']), 'nee');
  assert.equal(kiesKlasse('ja', ['ja', 'nee']), 'ja');
});

test('de deelwoord-terugval staat standaard UIT', () => {
  // Met de terugval aan leest "Jammer genoeg niet" als "ja" — ja zit in jammer. Bij de
  // banwaardig-toets betekende dat iemand verbannen terwijl het model nee zei. Standaard uit,
  // dus zo'n antwoord geeft null en de aanroeper valt op zijn vangnet terug.
  assert.equal(kiesKlasse('Jammer genoeg niet', ['ja', 'nee']), null);
  assert.equal(kiesKlasse('januari', ['ja', 'nee']), null);
  assert.equal(kiesKlasse('dit is een zwakke reden', ['zwak', 'sterk']), null);
});

test('met deelwoorden aan telt een verbogen vorm wel mee', () => {
  // Alleen de eer-jury zet dit aan: daar moet "een zwakke reden" als zwak gelden.
  const o = { deelwoorden: true };
  assert.equal(kiesKlasse('dit is een zwakke reden', ['zwak', 'sterk'], o), 'zwak');
  assert.equal(kiesKlasse('nogal sterkjes', ['zwak', 'sterk'], o), 'sterk');
});

test('bij meerdere klassen wint die het eerst staat', () => {
  assert.equal(kiesKlasse('sterk, niet legendarisch', ['sterk', 'legendarisch']), 'sterk');
  assert.equal(kiesKlasse('niet zwak maar degelijk', ['zwak', 'degelijk']), 'zwak');
});

test('onleesbaar geeft null, zodat de aanroeper zijn vangnet pakt', () => {
  assert.equal(kiesKlasse('vier punten', ['zwak', 'sterk']), null);
  assert.equal(kiesKlasse('ik weet het niet', ['ja', 'nee']), null);
  assert.equal(kiesKlasse('', ['ja', 'nee']), null);
  assert.equal(kiesKlasse(null, ['ja', 'nee']), null);
  assert.equal(kiesKlasse('ja', []), null);
});

test('hoofdletters en accenten maken niet uit', () => {
  assert.equal(kiesKlasse('BELEDIGING', ['BELEDIGING', 'NEUTRAAL']), 'BELEDIGING');
  assert.equal(kiesKlasse('belediging', ['BELEDIGING', 'NEUTRAAL']), 'BELEDIGING');
  assert.equal(kiesKlasse('Cadeautjé', ['cadeautje']), 'cadeautje');
});

test('de teruggegeven waarde is de klasse ZOALS meegegeven, niet de genormaliseerde vorm', () => {
  // De aanroepers vergelijken met hoofdletterconstanten ("BELEDIGING"), dus de schrijfwijze
  // van de meegegeven klasse moet behouden blijven.
  assert.equal(kiesKlasse('sarcasme', ['BELEDIGING', 'SARCASME', 'NEUTRAAL']), 'SARCASME');
});

// ── Ontschreeuwen van persona-voorbeelden ─────────────────────────────────────
// 23 oktober 2026: Benito M. schreef zijn voorbeeldzinnen na in hoofdletters, en daarin maakte het
// model gekke fouten ("HET LACKT EEN HETZOE VAAN ECHTE OWNERSHIP").

test('ontschreeuw: zinnen in hoofdletters worden gewone zinnen', () => {
  assert.equal(ontschreeuw('- "IK HOOR WAT JE ZEGT, MAAR IK HERKEN ME DAAR TOTAAL NIET IN!"'),
    '- "Ik hoor wat je zegt, maar ik herken me daar totaal niet in!"');
  assert.equal(ontschreeuw('Zijn favoriete argument is: "DIT BEDRIJF BESTAAT AL 10 JAAR!"'),
    'Zijn favoriete argument is: "Dit bedrijf bestaat al 10 jaar!"');
});

test('ontschreeuw: gewone tekst, afkortingen en één nadrukkelijk woord blijven staan', () => {
  const gewoon = 'Benito is een autoritaire CEO. Hij zegt NOOIT sorry, en zijn bedrijf bestaat al 10 jaar.';
  assert.equal(ontschreeuw(gewoon), gewoon);
  assert.equal(ontschreeuw('OK!'), 'OK!');
  assert.equal(ontschreeuw(''), '');
  assert.equal(ontschreeuw(null), '');
});

test('ontschreeuw: een karakterbeschrijving met voorbeelden houdt zijn opbouw', () => {
  const tekst = '**Spreekstijl**\nHij roept:\n- "WE GAAN HET WEL GEWOON ZO DOEN!"\n- "DAN LEG IK DE BAL TOCH EVEN BIJ JOU NEER!"\nDat is alles.';
  const uit = ontschreeuw(tekst);
  assert.equal(uit.split('\n').length, tekst.split('\n').length);
  assert.ok(!isHoofdletterSpam(uit));
  assert.match(uit, /- "We gaan het wel gewoon zo doen!"/);
  assert.match(uit, /\*\*Spreekstijl\*\*/);
});

// ── Uitroepen pas bij het plaatsen in hoofdletters ────────────────────────────

test('roepUit: wat tussen sterretjes staat, wordt geschreeuwd', () => {
  assert.equal(roepUit('*Dit bedrijf bestaat al 10 jaar!* Jij mist ownership.'),
    'DIT BEDRIJF BESTAAT AL 10 JAAR! Jij mist ownership.');
  assert.equal(roepUit('Kijk. **we gaan het wel gewoon zo doen.**'), 'Kijk. WE GAAN HET WEL GEWOON ZO DOEN.');
  assert.equal(roepUit('Geen uitroep hier.'), 'Geen uitroep hier.');
  assert.equal(roepUit('*ijzersterk*'), 'IJZERSTERK');
});

test('roepUit: zinnen die het model klein doorschreef, krijgen weer een hoofdletter', () => {
  assert.equal(roepUit('*dit bedrijf bestaat al 10 jaar!* jullie missen ownership. focus op strategie.'),
    'DIT BEDRIJF BESTAAT AL 10 JAAR! Jullie missen ownership. Focus op strategie.');
});

test('zinnenMetHoofdletter: niet na een afkorting, en de ondertekening blijft staan', () => {
  assert.equal(zinnenMetHoofdletter('Neem bijv. de kroket. dat is beter.'), 'Neem bijv. de kroket. Dat is beter.');
  assert.equal(zinnenMetHoofdletter('Mr. KroketPet weet het.'), 'Mr. KroketPet weet het.');
  assert.equal(zinnenMetHoofdletter('> zo is het.\n\n— Benito M.'), '> Zo is het.\n\n— Benito M.');
  assert.equal(zinnenMetHoofdletter(''), '');
});

test('ontschreeuw: korte nadruk en kopjes blijven staan, lange hoofdletterzinnen niet', () => {
  assert.equal(ontschreeuw('Dit is een TOTAL DISASTER.'), 'Dit is een TOTAL DISASTER.');
  assert.equal(ontschreeuw('Een TOTAL DISASTER!'), 'Een TOTAL DISASTER!');
  assert.equal(ontschreeuw('## KERNREGELS\nTONE OF VOICE'), '## KERNREGELS\nTONE OF VOICE');
  assert.equal(ontschreeuw('"WE GAAN HET WEL GEWOON ZO DOEN!"'), '"We gaan het wel gewoon zo doen!"');
});

test('isSchreeuwer: echte uitroepen tellen, kopjes niet', () => {
  assert.equal(isSchreeuwer('- "DIT BEDRIJF BESTAAT AL 10 JAAR!"\n- "WE GAAN HET WEL GEWOON ZO DOEN."'), true);
  assert.equal(isSchreeuwer('## KERNREGELS\nTONE OF VOICE — DE HEILIGE MR.\nHij is rustig.'), false);
  assert.equal(isSchreeuwer('Hij zegt één keer: "WAT IS HIER GOED AAN?"'), false); // één is geen stijl
  assert.equal(isSchreeuwer('WAT IS HIER GOED AAN? ZEG NIET RUSTIG TEGEN MIJ.'), true);
  assert.equal(isSchreeuwer(''), false);
});


// ── De keuring bij een schreeuwer (Alex Soze, 23 oktober 2026) ────────────────

const ALEX_PROFIEL = 'Jij bent Alex Soze, een sportschoolgoeroe. Vaste kreten: "ALLES KAN KAPOT!" en "USHHHH!". ' +
  'Hij noemt luie mensen een SLAPPE HAP.';

test('schreeuwer: wat tussen sterretjes staat en zijn vaste kreet tellen niet mee', () => {
  const antwoord = '*De kroket van de dag is alleen brandstof als je hem in de sportschool verbrandt!*\n' +
    '*Slappe hap, maat, pak die kilo\'s!*\nALLES KAN KAPOT! USHHHH!\n\n— Alex Soze';
  const rest = zonderToegestaanGeschreeuw(antwoord, ALEX_PROFIEL);
  assert.ok(!/ALLES|USHHHH|brandstof/.test(rest));
  assert.match(rest, /— Alex Soze/);
});

test('schreeuwer: een lange passage in hoofdletters die niet uit zijn profiel komt, blijft staan', () => {
  const antwoord = 'DUBAI WAS EEN KANS OM HARD TE TRAINEN EN HET ZONNEBLIJDE EGO TE VOEDEN, ALLES KAN KAPOT!';
  const rest = zonderToegestaanGeschreeuw(antwoord, ALEX_PROFIEL);
  assert.match(rest, /DUBAI WAS EEN KANS/);
  assert.equal(isHoofdletterSpam(rest), true);
});

test('schreeuwer: een kreet geldt alleen als elk woord ervan in hoofdletters in het profiel staat', () => {
  assert.equal(zonderToegestaanGeschreeuw('SLAPPE HAP!', ALEX_PROFIEL).trim(), '');
  assert.match(zonderToegestaanGeschreeuw('SLAPPE FRIET!', ALEX_PROFIEL), /SLAPPE FRIET/);
  // gewone woorden met een hoofdletter vooraan raakt het niet
  assert.equal(zonderToegestaanGeschreeuw('Dubai was warm.', ALEX_PROFIEL), 'Dubai was warm.');
});

test('schreeuwer: zonder profiel tellen alleen de sterretjes niet mee', () => {
  assert.equal(zonderToegestaanGeschreeuw('*hoi* ALLES KAN KAPOT!', '').trim(), 'ALLES KAN KAPOT!');
  assert.equal(zonderToegestaanGeschreeuw(null), '');
});
