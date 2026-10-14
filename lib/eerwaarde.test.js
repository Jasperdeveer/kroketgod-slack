// Tests voor de eerwaarde: klassen, kansverdelingen, redenvalidatie en herhaal-detectie.
// Pure functies met injecteerbare rng en klok, dus geen state of tijdelijke mappen. Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EER_KLASSEN, EER_HERHAALD, EER_LADDER, EER_VERDELING, EER_KLASSE_LABEL,
  EER_REDEN_MIN, ALLIANTIE_TERUGSLAG, REDEN_HERHAAL_DAGEN,
  redenProbleem, normaliseerReden, isGeldigeKlasse, parseerKlasse,
  huisonderwerpenUit, raaktHuisonderwerp, onderwerpProbleem, schoonOnderwerp, ONDERWERP_UITLEG,
  worpVoorKlasse, promoveerKlasse, verwachtingVoorKlasse,
  isHerhaaldeReden, onthoudReden,
} = require('./eerwaarde.js');

// Een rng die exact één vaste waarde teruggeeft — zo is elke worp afdwingbaar.
const vast = (v) => () => v;

// ── Verdelingen ───────────────────────────────────────────────────────────────

test('elke klasse heeft een verdeling en elk label', () => {
  for (const k of EER_KLASSEN) {
    assert.ok(EER_VERDELING[k], `verdeling ontbreekt voor ${k}`);
    assert.ok(EER_KLASSE_LABEL[k], `label ontbreekt voor ${k}`);
  }
});

test('de kansen per klasse tellen op tot exact 100', () => {
  for (const k of EER_KLASSEN) {
    const som = EER_VERDELING[k].reduce((s, [, kans]) => s + kans, 0);
    // Hele procenten, dus dit mag bit-voor-bit exact zijn — geen tolerantie nodig.
    assert.equal(som, 100, `${k} telt op tot ${som}`);
  }
});

test('elke kans is een heel getal, zodat de bandgrenzen exact blijven', () => {
  for (const k of EER_KLASSEN) {
    for (const [, kans] of EER_VERDELING[k]) {
      assert.ok(Number.isInteger(kans), `${k} heeft een gebroken kans ${kans}`);
    }
  }
});

test('geen enkele klasse kan buiten 0-5 uitkomen', () => {
  for (const k of EER_KLASSEN) {
    for (const [punten] of EER_VERDELING[k]) {
      assert.ok(punten >= 0 && punten <= 5, `${k} kan ${punten} punten geven`);
    }
  }
});

test('geen enkele jury-klasse kan nul opleveren', () => {
  // De kernregel sinds oktober 2026: een nul moet UITLEGBAAR zijn. De jury kan hem niet meer
  // geven, want een gever hoort het oordeel niet aankomen en leert dus niets van die nul.
  for (const k of EER_KLASSEN) {
    const kanNul = EER_VERDELING[k].some(([punten]) => punten === 0);
    assert.equal(kanNul, false, `${k} kan nog nul geven`);
  }
});

test('alleen een herhaalde reden kan nul opleveren', () => {
  // Dit is de énige weg naar nul, en hij ligt volledig in de hand van de gever: hij hergebruikte
  // zijn eigen motivatie, en dat wordt hem in het kanaal ook verteld.
  const kanNul = EER_VERDELING[EER_HERHAALD].some(([punten]) => punten === 0);
  assert.ok(kanNul, 'een herhaalde reden moet nog op nul kunnen uitkomen');
});

test('een betere klasse is altijd een betere gok', () => {
  for (let i = 1; i < EER_KLASSEN.length; i++) {
    const vorige = verwachtingVoorKlasse(EER_KLASSEN[i - 1]);
    const deze = verwachtingVoorKlasse(EER_KLASSEN[i]);
    assert.ok(deze > vorige, `${EER_KLASSEN[i]} (${deze}) moet boven ${EER_KLASSEN[i - 1]} (${vorige}) liggen`);
  }
});

test('alleen legendarisch kan de maximale 5 halen', () => {
  for (const k of EER_KLASSEN) {
    const kanVijf = EER_VERDELING[k].some(([punten]) => punten === 5);
    assert.equal(kanVijf, k === 'legendarisch', `${k} en de vijf-uitkomst`);
  }
});

// ── De worp ───────────────────────────────────────────────────────────────────

test('worp op de onderrand van de eerste band geeft de laagste uitkomst', () => {
  assert.equal(worpVoorKlasse(EER_HERHAALD, vast(0)), 0);
  assert.equal(worpVoorKlasse('zwak', vast(0)), 1);
  assert.equal(worpVoorKlasse('degelijk', vast(0)), 1);
  assert.equal(worpVoorKlasse('sterk', vast(0)), 2);
  assert.equal(worpVoorKlasse('legendarisch', vast(0)), 3);
});

test('worp net onder 1 geeft de hoogste uitkomst van de klasse', () => {
  assert.equal(worpVoorKlasse('zwak', vast(0.999)), 2);
  assert.equal(worpVoorKlasse('degelijk', vast(0.999)), 3);
  assert.equal(worpVoorKlasse('sterk', vast(0.999)), 4);
  assert.equal(worpVoorKlasse('legendarisch', vast(0.999)), 5);
});

test('elke bandgrens ligt precies waar de verdeling hem legt', () => {
  // Berekent de grenzen UIT de verdeling in plaats van ze te herhalen. Een test die de getallen
  // overschrijft moet bij elke herbalancering worden bijgewerkt, en dan bewaakt hij niets meer —
  // deze bewaakt het mechanisme: precies op de grens wint de HOGERE band, en één tiendmiljoenste
  // eronder de lagere. Dat was ooit stuk door afrondingsruis op gebroken kansen.
  for (const k of EER_KLASSEN) {
    let cum = 0;
    for (const [punten, kans] of EER_VERDELING[k]) {
      const onder = (cum + kans - 1) / 100;   // laatste worp die nog in deze band valt
      assert.equal(worpVoorKlasse(k, vast(onder)), punten, `${k}: worp ${onder} hoort ${punten} te geven`);
      cum += kans;
      if (cum < 100) {
        const grens = cum / 100;              // eerste worp van de volgende band
        assert.notEqual(worpVoorKlasse(k, vast(grens)), punten, `${k}: worp ${grens} hoort de volgende band te zijn`);
      }
    }
  }
});

test('de ladder loopt op en herhaald staat onderaan', () => {
  // Vastgelegd als ontwerpeis: een herhaalde reden moet minder opleveren dan de schraalste
  // verse reden, anders loont hergebruik. En promotie (huisonderwerp, Dubbele Eer-zegen) tilt
  // een herhaalde reden naar zwak — de straf blijft voelbaar, maar nul raakt buiten bereik.
  for (let i = 1; i < EER_LADDER.length; i++) {
    const vorige = verwachtingVoorKlasse(EER_LADDER[i - 1]);
    const deze = verwachtingVoorKlasse(EER_LADDER[i]);
    assert.ok(deze > vorige, `${EER_LADDER[i]} (${deze}) moet boven ${EER_LADDER[i - 1]} (${vorige}) liggen`);
  }
  assert.equal(promoveerKlasse(EER_HERHAALD), 'zwak');
  for (const worp of [0, 0.3, 0.6, 0.99]) {
    assert.ok(worpVoorKlasse(promoveerKlasse(EER_HERHAALD), vast(worp)) >= 1);
  }
});

test('elke band is werkelijk bereikbaar over het hele rng-bereik', () => {
  // Doorloopt alle 100 mogelijke worpen en controleert dat elke uitkomst uit de verdeling
  // daadwerkelijk voorkomt — een verschoven grens zou een band onbereikbaar maken.
  for (const k of EER_KLASSEN) {
    const gezien = new Set();
    for (let i = 0; i < 100; i++) gezien.add(worpVoorKlasse(k, vast(i / 100)));
    for (const [punten] of EER_VERDELING[k]) {
      assert.ok(gezien.has(punten), `${k}: ${punten} punten is onbereikbaar`);
    }
    assert.equal(gezien.size, EER_VERDELING[k].length, `${k} levert onverwachte uitkomsten`);
  }
});

test('een rng die exact 1 teruggeeft levert geen undefined op', () => {
  for (const k of EER_KLASSEN) {
    const punten = worpVoorKlasse(k, vast(1));
    assert.equal(typeof punten, 'number');
    assert.ok(Number.isFinite(punten));
  }
});

test('een onbekende klasse valt terug op degelijk in plaats van te knappen', () => {
  assert.equal(worpVoorKlasse('onzin', vast(0)), 1);
  assert.equal(worpVoorKlasse(null, vast(0.999)), 3);
  assert.equal(worpVoorKlasse(undefined, vast(0)), 1);
});

// ── Promotie (de Dubbele Eer-zegen) ───────────────────────────────────────────

test('promotie stapt precies één klasse op', () => {
  assert.equal(promoveerKlasse('zwak'), 'degelijk');
  assert.equal(promoveerKlasse('degelijk'), 'sterk');
  assert.equal(promoveerKlasse('sterk'), 'legendarisch');
});

test('promotie boven legendarisch blijft legendarisch', () => {
  assert.equal(promoveerKlasse('legendarisch'), 'legendarisch');
});

test('promotie van een onbekende klasse geeft degelijk', () => {
  assert.equal(promoveerKlasse('onzin'), 'degelijk');
  assert.equal(promoveerKlasse(null), 'degelijk');
});

test('een gepromoveerde zwakke reden kan geen 0 meer opleveren', () => {
  // Dit is de hele belofte van de zegen: 0 punten raakt buiten bereik.
  const klasse = promoveerKlasse('zwak');
  for (const worp of [0, 0.25, 0.5, 0.75, 0.999]) {
    assert.ok(worpVoorKlasse(klasse, vast(worp)) >= 1);
  }
});

// ── Redenvalidatie ────────────────────────────────────────────────────────────

test('een lege of ontbrekende reden is "leeg"', () => {
  assert.equal(redenProbleem(''), 'leeg');
  assert.equal(redenProbleem('   '), 'leeg');
  assert.equal(redenProbleem(null), 'leeg');
  assert.equal(redenProbleem(undefined), 'leeg');
});

test('leestekens of cijfers alleen zijn geen reden, ook niet lang genoeg', () => {
  assert.equal(redenProbleem('..............'), 'leeg');
  assert.equal(redenProbleem('1234567890123'), 'leeg');
  assert.equal(redenProbleem('!!!! ???? !!!!'), 'leeg');
});

test('een te korte reden is "kort"', () => {
  assert.equal(redenProbleem('top'), 'kort');
  assert.equal(redenProbleem('goed bezig'.slice(0, EER_REDEN_MIN - 1)), 'kort');
});

test('een echte reden wordt goedgekeurd', () => {
  assert.equal(redenProbleem('bracht kroketten mee naar de vrijdagborrel'), null);
  assert.equal(redenProbleem('hielp mij'.padEnd(EER_REDEN_MIN, 'x')), null);
});

test('accenten tellen mee als letters', () => {
  assert.equal(redenProbleem('sublieme paneerlaag'), null);
  assert.equal(redenProbleem('café-praatje gehouden'), null);
});

// ── Normalisatie ──────────────────────────────────────────────────────────────

test('normalisatie maakt leestekens en dubbele spaties onzichtbaar', () => {
  assert.equal(
    normaliseerReden('Bracht  kroketten mee!!'),
    normaliseerReden('bracht kroketten mee'),
  );
});

test('normalisatie strijkt accenten weg', () => {
  assert.equal(normaliseerReden('sublíeme kròket'), 'sublieme kroket');
});

test('normalisatie van niets geeft een lege string, niet "null"', () => {
  assert.equal(normaliseerReden(null), '');
  assert.equal(normaliseerReden(undefined), '');
});

// ── Jury-antwoord parsen ──────────────────────────────────────────────────────

test('een keurig één-woord-antwoord wordt gelezen', () => {
  assert.equal(parseerKlasse('sterk'), 'sterk');
  assert.equal(parseerKlasse('LEGENDARISCH'), 'legendarisch');
});

test('een omlijst of verbogen antwoord wordt ook gelezen', () => {
  assert.equal(parseerKlasse('Klasse: STERK.'), 'sterk');
  assert.equal(parseerKlasse('**degelijk**'), 'degelijk');
  assert.equal(parseerKlasse('dit is een zwakke reden'), 'zwak');
  assert.equal(parseerKlasse('  sterk\n'), 'sterk');
});

test('bij meerdere klassen in het antwoord wint de eerste', () => {
  assert.equal(parseerKlasse('sterk, niet legendarisch'), 'sterk');
  assert.equal(parseerKlasse('zwak of degelijk'), 'zwak');
});

test('onherkenbaar antwoord geeft null, zodat de aanroeper zijn vangnet kan pakken', () => {
  assert.equal(parseerKlasse('vier punten'), null);
  assert.equal(parseerKlasse(''), null);
  assert.equal(parseerKlasse(null), null);
  assert.equal(parseerKlasse('ik weet het niet'), null);
});

test('isGeldigeKlasse kent precies de vier klassen', () => {
  for (const k of EER_KLASSEN) assert.ok(isGeldigeKlasse(k));
  assert.ok(!isGeldigeKlasse('matig'));
  assert.ok(!isGeldigeKlasse(''));
  assert.ok(!isGeldigeKlasse(null));
});

// ── Herhaalde redenen ─────────────────────────────────────────────────────────

const NU = new Date('2026-09-14T12:00:00Z').getTime();
const DAG = 86_400_000;

test('een verse reden is geen herhaling', () => {
  assert.equal(isHerhaaldeReden('bracht kroketten mee', [], NU), false);
});

test('dezelfde reden binnen het venster is een herhaling', () => {
  const eerder = onthoudReden('bracht kroketten mee', [], NU - 3 * DAG);
  assert.equal(isHerhaaldeReden('bracht kroketten mee', eerder, NU), true);
});

test('herhaling kijkt door leestekens en hoofdletters heen', () => {
  const eerder = onthoudReden('Bracht kroketten mee!', [], NU - DAG);
  assert.equal(isHerhaaldeReden('bracht  kroketten  mee', eerder, NU), true);
});

test('een reden van buiten het venster is weer bruikbaar', () => {
  const eerder = onthoudReden('bracht kroketten mee', [], NU - (REDEN_HERHAAL_DAGEN + 1) * DAG);
  assert.equal(isHerhaaldeReden('bracht kroketten mee', eerder, NU), false);
});

test('een andere reden raakt niet aan de herhaal-detectie', () => {
  const eerder = onthoudReden('bracht kroketten mee', [], NU - DAG);
  assert.equal(isHerhaaldeReden('hield de frituur schoon', eerder, NU), false);
});

test('onthoudReden muteert de bestaande lijst niet', () => {
  const eerder = [{ h: 'oude reden', ts: NU - DAG }];
  const nieuw = onthoudReden('nieuwe reden', eerder, NU);
  assert.equal(eerder.length, 1);
  assert.equal(nieuw.length, 2);
});

test('onthoudReden ruimt verlopen vingerafdrukken op', () => {
  const eerder = [
    { h: 'oud', ts: NU - (REDEN_HERHAAL_DAGEN + 2) * DAG },
    { h: 'recent', ts: NU - DAG },
  ];
  const nieuw = onthoudReden('vers', eerder, NU);
  assert.deepEqual(nieuw.map(e => e.h), ['recent', 'vers']);
});

test('dezelfde reden tweemaal onthouden geeft geen dubbele regel', () => {
  let lijst = onthoudReden('bracht kroketten mee', [], NU - DAG);
  lijst = onthoudReden('bracht kroketten mee', lijst, NU);
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].ts, NU); // de verste datum wint, dus het venster schuift mee
});

test('de lijst groeit niet ongelimiteerd', () => {
  let lijst = [];
  for (let i = 0; i < 200; i++) lijst = onthoudReden(`reden nummer ${i}`, lijst, NU);
  assert.ok(lijst.length <= 60, `lijst is ${lijst.length} lang`);
});

test('rommel in de opgeslagen lijst laat de detectie niet knappen', () => {
  const rommel = [null, undefined, {}, { h: null, ts: NU }, { h: 'bracht kroketten mee', ts: NU }];
  assert.equal(isHerhaaldeReden('bracht kroketten mee', rommel, NU), true);
  assert.equal(isHerhaaldeReden('iets anders', rommel, NU), false);
  assert.doesNotThrow(() => onthoudReden('vers', rommel, NU));
});

// ── Alliantie-terugslag ───────────────────────────────────────────────────────

test('de alliantie-terugslag is en blijft precies één punt', () => {
  // Vastgelegd in een test omdat het een expliciete ontwerpeis is: wie zijn bondgenoot eert
  // krijgt maximaal één punt terug, nooit meer.
  assert.equal(ALLIANTIE_TERUGSLAG, 1);
});


// ── Huisonderwerpen ───────────────────────────────────────────────────────────

test('huisonderwerpen worden genormaliseerd en ontdaan van ruis', () => {
  assert.deepEqual(huisonderwerpenUit('tavernehoek, De Kelder'), ['tavernehoek', 'de kelder']);
  assert.deepEqual(huisonderwerpenUit('  Tavernehoek!!  '), ['tavernehoek']);
});

test('lege of te korte onderwerpen vallen af', () => {
  // Een fragment van twee letters zou élke reden raken en de hele weging platslaan.
  assert.deepEqual(huisonderwerpenUit(''), []);
  assert.deepEqual(huisonderwerpenUit('ab, xyz, tavernehoek'), ['xyz', 'tavernehoek']);
  assert.deepEqual(huisonderwerpenUit(null), []);
});

test('een reden die het huisonderwerp raakt wordt herkend, ook verbogen', () => {
  const h = huisonderwerpenUit('tavernehoek');
  assert.equal(raaktHuisonderwerp('een wekenlange oefening op de tavernehoek', h), 'tavernehoek');
  assert.equal(raaktHuisonderwerp('stond weer bij het TAVERNEHOEKJE!', h), 'tavernehoek');
  assert.equal(raaktHuisonderwerp('de Tavernehoek, alweer', h), 'tavernehoek');
});

test('een reden zonder huisonderwerp raakt niets', () => {
  const h = huisonderwerpenUit('tavernehoek');
  assert.equal(raaktHuisonderwerp('bracht kroketten mee naar de borrel', h), null);
  assert.equal(raaktHuisonderwerp('', h), null);
  assert.equal(raaktHuisonderwerp('tavernehoek', []), null);
});

test('een geraakt huisonderwerp tilt het oordeel precies één klasse op', () => {
  // Dit is de hele eis: "een tavernehoek moet sowieso extra beoordeeld worden."
  assert.equal(promoveerKlasse('zwak'), 'degelijk');
  assert.equal(promoveerKlasse('degelijk'), 'sterk');
  // En samen met de Dubbele Eer-zegen stapelt het door tot de top.
  assert.equal(promoveerKlasse(promoveerKlasse('degelijk')), 'legendarisch');
});

// ── Voorgedragen huisonderwerpen ─────────────────────────────────────────────

test('een gewoon eigen woord mag voorgedragen worden', () => {
  assert.equal(onderwerpProbleem('tavernehoek'), null);
  assert.equal(onderwerpProbleem('de zolderkamer'), null);
});

test('te korte voorstellen vallen af', () => {
  assert.equal(onderwerpProbleem(''), 'leeg');
  assert.equal(onderwerpProbleem('bar'), 'kort');
  assert.equal(onderwerpProbleem('!!!'), 'leeg');
});

test('te algemene woorden vallen af — die zouden élke reden promoveren', () => {
  // raaktHuisonderwerp vergelijkt op deelwoord, dus "kroket" raakt alles in dit genootschap.
  // Gestapeld met de Dubbele Eer-zegen zou dat twee klassen promotie zijn op elke reden.
  assert.equal(onderwerpProbleem('kroket'), 'te algemeen');
  assert.equal(onderwerpProbleem('de kroketbak'), 'te algemeen');
  assert.equal(onderwerpProbleem('frituurpan'), 'te algemeen');
  assert.equal(onderwerpProbleem('heel goed'), 'te algemeen');
});

test('een onderwerp dat er al staat kan niet nog eens', () => {
  assert.equal(onderwerpProbleem('tavernehoek', ['tavernehoek']), 'bestaat al');
  assert.equal(onderwerpProbleem('Tavernehoek!', ['tavernehoek']), 'bestaat al');
  assert.equal(onderwerpProbleem('tavernehoek', ['de kelder']), null);
});

test('een goedgekeurd onderwerp werkt daarna als elk ander huisonderwerp', () => {
  const lijst = huisonderwerpenUit('tavernehoek, de zolderkamer');
  assert.equal(raaktHuisonderwerp('weer op de zolderkamer geweest', lijst), 'de zolderkamer');
});

// ── De opslagvorm van een huisonderwerp ───────────────────────────────────────

test('schoonOnderwerp levert precies de vorm waarop vergeleken wordt', () => {
  assert.equal(schoonOnderwerp('Tavernehoekje!'), 'tavernehoekje');
  assert.equal(schoonOnderwerp('  DE  Kélder  '), 'de kelder');
  assert.equal(schoonOnderwerp(null), '');
});

test('een opgeslagen onderwerp raakt een reden ook als er rare tekens in stonden', () => {
  // Dit is de hele reden dat er genormaliseerd wórdt opgeslagen: anders staat er "Tavernehoek!"
  // in het bestand en zoekt raaktHuisonderwerp daar letterlijk naar in een kleingeletterde reden.
  const o = schoonOnderwerp("Tavernehoek!");
  assert.equal(raaktHuisonderwerp('Hield de tavernehoek schoon', [o]), o);
});

test('een komma in een voorstel maakt er geen twee onderwerpen van', () => {
  assert.equal(schoonOnderwerp('tavernehoek, kelder'), 'tavernehoek kelder');
});

test('een variant van een bestaand onderwerp telt als dubbel', () => {
  // "kelderploeg" raakt per deelwoord alles wat "de kelderploeg" raakt en meer, dus het is
  // geen nieuw onderwerp maar een tweede ingang op hetzelfde — en een manier om de limiet
  // van twee voorstellen per lid te ontwijken.
  assert.equal(onderwerpProbleem('kelderploeg', ['de kelderploeg']), 'bestaat al');
  assert.equal(onderwerpProbleem('de kelderploeg', ['kelderploeg']), 'bestaat al');
  assert.equal(onderwerpProbleem('zolderploeg', ['kelderploeg']), null);
});

test('elk probleem heeft een uitleg die een mens kan lezen', () => {
  for (const code of ['leeg', 'kort', 'te algemeen', 'bestaat al']) {
    assert.equal(typeof ONDERWERP_UITLEG[code], 'string', code);
    assert.ok(ONDERWERP_UITLEG[code].length > 10, code);
  }
});
