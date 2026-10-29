// ── Het Casino: de cijfers ───────────────────────────────────────────────────
//
// Per dag, per lid, per spel: hoeveel spellen, hoeveel ingezet en hoeveel uitbetaald (bruto, zie
// lib/casino.js). Daaruit volgen het huisresultaat in het dashboard en het eigen netto in de App
// Home. Plus per dag de grootste winst. Alleen de laatste BEWAAR_DAGEN dagen blijven staan.
//
// casinostats.json = { 'JJJJ-MM-DD': { leden: { userId: { spel: { spellen, ingezet, uitbetaald } } },
//                                     grootste: { netto, userId, spel } | null } }
//
// Puur: geen I/O en geen klok, de aanroeper geeft de dag mee. Zie casinostats.test.js.

'use strict';

const { schuif } = require('./gokpauze.js');

const BEWAAR_DAGEN = 60;
const leeg = () => ({ spellen: 0, ingezet: 0, uitbetaald: 0 });

// Een afgerekend spel erbij. Geeft nieuwe stats terug, zonder dagen ouder dan BEWAAR_DAGEN.
function boekSpel(stats, dag, userId, spel, inzet, uitbetaling) {
  const d = stats?.[dag] || { leden: {}, grootste: null };
  const lid = d.leden[userId] || {};
  const s = lid[spel] || leeg();
  const netto = uitbetaling - inzet;
  const uit = {
    ...stats,
    [dag]: {
      leden: { ...d.leden, [userId]: { ...lid, [spel]: { spellen: s.spellen + 1, ingezet: s.ingezet + inzet, uitbetaald: s.uitbetaald + uitbetaling } } },
      grootste: netto > (d.grootste?.netto || 0) ? { netto, userId, spel } : d.grootste,
    },
  };
  const grens = schuif(dag, -BEWAAR_DAGEN);
  for (const k of Object.keys(uit)) if (k < grens) delete uit[k];
  return uit;
}

// Alles van vanDag tot en met totDag, optioneel voor één lid. `netto` is vanuit de spelers gezien:
// negatief betekent dat het huis wint.
function vatSamen(stats, vanDag, totDag, userId = null) {
  const tel = (a, s) => { a.spellen += s.spellen; a.ingezet += s.ingezet; a.uitbetaald += s.uitbetaald; return a; };
  const totaal = leeg(), perSpel = {}, perLid = {};
  let grootste = null;
  for (const [dag, d] of Object.entries(stats || {})) {
    if (dag < vanDag || dag > totDag) continue;
    const g = d.grootste;
    if (g && (!userId || g.userId === userId) && g.netto > (grootste?.netto || 0)) grootste = { ...g, dag };
    for (const [id, spellen] of Object.entries(d.leden || {})) {
      if (userId && id !== userId) continue;
      for (const [spel, s] of Object.entries(spellen)) {
        tel(totaal, s);
        tel(perSpel[spel] ||= leeg(), s);
        tel(perLid[id] ||= leeg(), s);
      }
    }
  }
  return { ...totaal, netto: totaal.uitbetaald - totaal.ingezet, perSpel, perLid, grootste };
}

module.exports = { BEWAAR_DAGEN, boekSpel, vatSamen };
