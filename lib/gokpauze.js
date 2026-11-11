// ── De Gokpauze: een onzichtbare reeks en een casinoverbod van twee werkdagen ──
//
// Alleen werkdagen (ma-vr) tellen: spelen in het weekend telt niet mee en breekt de reeks ook niet.
// Wie op GOKPAUZE_DAGEN opeenvolgende werkdagen in het casino speelt, komt na het eerste spel op die
// vijfde werkdag op de zwarte lijst: een waarschuwing (privé) plus een openbare melding in het
// kanaal (wens van de eigenaar, nov 2026). Die dag mag hij nog verder spelen. Daarna volgt een
// verbod op de volgende GOKPAUZE_VERBOD werkdagen, met wat ertussen valt (vrijdag + maandag = ook
// het weekend): geen casino, Vetbad, gok krokant/slap, duel, roof, troon uitdagen of aandelen.
// Elke poging levert een privé-toespraak op, steeds dringender. Daarna begint de reeks opnieuw.
// Feestdagen tellen gewoon als werkdag (net als werkdagenTussen in index.js).
//
// Per lid in gokpauze.json: { laatste, reeks, rustdag, rustTot, gemeld, pogingen }, met dagen als
// Amsterdamse sleutel 'JJJJ-MM-DD' (zie dagSleutel in index.js). `rustdag` is de eerste verboden
// dag, `rustTot` de laatste (ontbreekt bij oude records: dan alleen `rustdag`).
//
// Puur: geen I/O en geen klok, de aanroeper geeft de dag mee. Zie gokpauze.test.js.

'use strict';

const GOKPAUZE_DAGEN = 5;
const GOKPAUZE_VERBOD = 2;

// Een dagsleutel n dagen verschoven. Rekent vanaf het middaguur, dus zomertijd verschuift niets.
const schuif = (dag, n) => new Date(Date.parse(`${dag}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const isWerkdag = (dag) => ![0, 6].includes(new Date(`${dag}T12:00:00Z`).getUTCDay());
// De eerste werkdag vóór (stap -1) of na (stap 1) `dag`.
function werkdagNaast(dag, stap) {
  let d = schuif(dag, stap);
  while (!isWerkdag(d)) d = schuif(d, stap);
  return d;
}

// Na een gespeeld casinospel. Een tweede spel op dezelfde dag, of een spel in het weekend, verandert niets.
function naCasinoSpel(rec, dag) {
  if (rec?.laatste === dag || !isWerkdag(dag)) return rec;
  const reeks = rec?.laatste === werkdagNaast(dag, -1) ? (rec.reeks || 0) + 1 : 1;
  if (reeks >= GOKPAUZE_DAGEN) {
    let rustTot = werkdagNaast(dag, 1);
    const rustdag = rustTot;
    for (let i = 1; i < GOKPAUZE_VERBOD; i++) rustTot = werkdagNaast(rustTot, 1);
    return { laatste: dag, reeks: 0, rustdag, rustTot, gemeld: false, pogingen: 0 };
  }
  return { ...rec, laatste: dag, reeks };
}

const rustEinde = (rec) => rec?.rustTot || rec?.rustdag;
const opRustdag = (rec, dag) => !!dag && !!rec?.rustdag && rec.rustdag <= dag && dag <= rustEinde(rec);
const moetWaarschuwen = (rec) => !!rec?.rustdag && !rec.gemeld;
const naWaarschuwing = (rec) => ({ ...rec, gemeld: true });
const naPoging = (rec) => ({ ...rec, pogingen: (rec?.pogingen || 0) + 1 });
// De beheerder heft een rustdag op (dashboard). De reeks begint daarna gewoon opnieuw.
const zonderRustdag = (rec) => ({ ...rec, rustdag: null, rustTot: null });

// Hoe het er vandaag voor staat, voor het dashboard: de lopende reeks (een reeks die op de vorige
// werkdag of eerder stopte, telt niet meer) en een verbod dat nu loopt of nog moet komen.
function standVan(rec, dag) {
  const loopt = rec?.laatste === dag || rec?.laatste === werkdagNaast(dag, -1);
  const actief = rec?.rustdag && rustEinde(rec) >= dag;
  const rustdag = actief ? rec.rustdag : null;
  return { reeks: loopt ? rec.reeks || 0 : 0, rustdag, rustTot: actief ? rustEinde(rec) : null, gewaarschuwd: !!(rustdag && rec.gemeld), pogingen: opRustdag(rec, dag) ? rec.pogingen || 0 : 0 };
}

module.exports = { GOKPAUZE_DAGEN, GOKPAUZE_VERBOD, schuif, isWerkdag, rustEinde, naCasinoSpel, opRustdag, moetWaarschuwen, naWaarschuwing, naPoging, zonderRustdag, standVan };
