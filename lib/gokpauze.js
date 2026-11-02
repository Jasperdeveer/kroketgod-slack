// ── De Gokpauze: een onzichtbare reeks en een verplichte rustdag ─────────────
//
// Wie op GOKPAUZE_DAGEN opeenvolgende dagen in het casino speelt, krijgt na het eerste spel op de
// vijfde dag een officiële waarschuwing (privé) en mag die dag nog verder spelen. De hele volgende
// kalenderdag is een rustdag: geen casino, Vetbad, gok krokant/slap, duel, roof, troon uitdagen of
// aandelen kopen of verkopen. Elke poging levert een privé-toespraak op, steeds dringender. Daarna begint de
// reeks opnieuw. Niemand ziet de reeks; alleen de waarschuwing verraadt hem (wens van de eigenaar).
//
// Per lid in gokpauze.json: { laatste, reeks, rustdag, gemeld, pogingen }, met dagen als
// Amsterdamse sleutel 'JJJJ-MM-DD' (zie dagSleutel in index.js).
//
// Puur: geen I/O en geen klok, de aanroeper geeft de dag mee. Zie gokpauze.test.js.

'use strict';

const GOKPAUZE_DAGEN = 5;

// Een dagsleutel n dagen verschoven. Rekent vanaf het middaguur, dus zomertijd verschuift niets.
const schuif = (dag, n) => new Date(Date.parse(`${dag}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Na een gespeeld casinospel. Een tweede spel op dezelfde dag verandert niets.
function naCasinoSpel(rec, dag) {
  if (rec?.laatste === dag) return rec;
  const reeks = rec?.laatste === schuif(dag, -1) ? (rec.reeks || 0) + 1 : 1;
  if (reeks >= GOKPAUZE_DAGEN) return { laatste: dag, reeks: 0, rustdag: schuif(dag, 1), gemeld: false, pogingen: 0 };
  return { ...rec, laatste: dag, reeks };
}

const opRustdag = (rec, dag) => !!dag && rec?.rustdag === dag;
const moetWaarschuwen = (rec) => !!rec?.rustdag && !rec.gemeld;
const naWaarschuwing = (rec) => ({ ...rec, gemeld: true });
const naPoging = (rec) => ({ ...rec, pogingen: (rec?.pogingen || 0) + 1 });
// De beheerder heft een rustdag op (dashboard). De reeks begint daarna gewoon opnieuw.
const zonderRustdag = (rec) => ({ ...rec, rustdag: null });

// Hoe het er vandaag voor staat, voor het dashboard: de lopende reeks (een reeks die gisteren of
// eerder stopte, telt niet meer) en een rustdag die vandaag of nog moet komen.
function standVan(rec, dag) {
  const loopt = rec?.laatste === dag || rec?.laatste === schuif(dag, -1);
  const rustdag = rec?.rustdag && rec.rustdag >= dag ? rec.rustdag : null;
  return { reeks: loopt ? rec.reeks || 0 : 0, rustdag, gewaarschuwd: !!(rustdag && rec.gemeld), pogingen: rustdag === dag ? rec.pogingen || 0 : 0 };
}

module.exports = { GOKPAUZE_DAGEN, schuif, naCasinoSpel, opRustdag, moetWaarschuwen, naWaarschuwing, naPoging, zonderRustdag, standVan };
