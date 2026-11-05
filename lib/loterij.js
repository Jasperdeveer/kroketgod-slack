// ── De Frituurloterij ────────────────────────────────────────────────────────
//
// Elk lid koopt hoogstens één lot per dag, voor LOT_PRIJS punt, in de casinolobby. Vrijdag om 16:00
// (index.js) trekt de Kroket God één lot, en de eigenaar daarvan krijgt de hele pot: geen
// huisvoordeel (5 november 2026). Elk lot is één kans, dus wie vaker koopt, maakt meer kans.
// Doen er minder dan MIN_DEELNEMERS leden mee, dan schuift de pot door naar de volgende vrijdag:
// alleen tegen jezelf loten is geen loterij.
// Een lot telt niet mee voor de gokpauze-reeks (één punt per dag zou na vijf dagen een rustdag
// geven), maar op een rustdag kan niemand een lot kopen. Het Gefluisterde Voorrecht werkt hier niet:
// de pot is van de andere leden.
//
// loterij.json = { loten: [{ userId, dag }], historie: [{ dag, winnaar, pot, loten, deelnemers, winnendeLoten }] }
//
// Puur: geen I/O, geen klok en geen Math.random; de aanroeper geeft de dag en `rnd` mee. Zie loterij.test.js.

'use strict';

const LOT_PRIJS = 1;
const MIN_DEELNEMERS = 2;
const HISTORIE = 20;

const deelnemersVan = (loten) => new Set(loten.map(l => l.userId)).size;

// Hoe het ervoor staat, voor één lid (userId mag null zijn: het dashboard).
function stand(staat, userId, dag) {
  const loten = staat?.loten || [];
  const mijn = loten.filter(l => l.userId === userId);
  return {
    pot: loten.length * LOT_PRIJS,
    loten: loten.length,
    deelnemers: deelnemersVan(loten),
    mijnLoten: mijn.length,
    vandaagGekocht: mijn.some(l => l.dag === dag),
    laatste: staat?.historie?.at(-1) || null,
  };
}

// Eén lot erbij: { staat } of { fout }.
function koopLot(staat, userId, dag) {
  if (stand(staat, userId, dag).vandaagGekocht) return { fout: 'U kocht vandaag al een lot. Morgen mag er weer een bij.' };
  return { staat: { historie: [], ...staat, loten: [...(staat?.loten || []), { userId, dag }] } };
}

// De trekking: { staat, uitslag }. uitslag is null zonder loten, { doorgeschoven, pot, deelnemers }
// bij te weinig deelnemers (de staat blijft dan zoals hij was), en anders de winnaar. `magWinnen`:
// een balling of vertrokken lid wint niet, maar zijn lot blijft in de pot.
function trek(staat, dag, rnd, magWinnen = () => true) {
  const loten = staat?.loten || [];
  if (!loten.length) return { staat, uitslag: null };
  const pot = loten.length * LOT_PRIJS;
  const kanshebbers = loten.filter(l => magWinnen(l.userId));
  const deelnemers = deelnemersVan(kanshebbers);
  if (deelnemers < MIN_DEELNEMERS) return { staat, uitslag: { doorgeschoven: true, pot, deelnemers } };
  const winnaar = kanshebbers[Math.floor(rnd() * kanshebbers.length)].userId;
  const uitslag = { dag, winnaar, pot, loten: loten.length, deelnemers, winnendeLoten: kanshebbers.filter(l => l.userId === winnaar).length };
  return { staat: { loten: [], historie: [...(staat.historie || []), uitslag].slice(-HISTORIE) }, uitslag };
}

module.exports = { LOT_PRIJS, MIN_DEELNEMERS, stand, koopLot, trek };
