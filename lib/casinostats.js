// ── Het Casino: de cijfers ───────────────────────────────────────────────────
//
// Per dag, per lid, per spel: hoeveel spellen, hoeveel ingezet en hoeveel uitbetaald (bruto, zie
// lib/casino.js). Daaruit volgen het huisresultaat in het dashboard en het eigen netto in de App
// Home. Plus per dag de grootste winst. Alleen de laatste BEWAAR_DAGEN dagen blijven staan.
//
// casinostats.json = { 'JJJJ-MM-DD': { leden: { userId: { spel: { spellen, ingezet, uitbetaald } } },
//                                     grootste: { netto, userId, spel } | null,
//                                     uitslagen: { userId: 'WVG…' },      // per spel: Winst, Verlies, Gelijk
//                                     bijzonder: { soort: [userId, …] },  // jackpot, blackjack, getal, plafond
//                                     hlReeks: { n, userId } | null } }   // meeste goede gokken in één hoger/lager
//
// Daaruit maakt `feiten` de roddels voor het kanaal (dinsdag, index.js) en het dashboard: elke regel
// alleen als hij er die week echt is, met vaste cijfers en zonder taalmodel.
//
// Puur: geen I/O en geen klok, de aanroeper geeft de dag mee. Zie casinostats.test.js.

'use strict';

const { schuif } = require('./gokpauze.js');

const BEWAAR_DAGEN = 60;
const leeg = () => ({ spellen: 0, ingezet: 0, uitbetaald: 0 });

// Een afgerekend spel erbij. Geeft nieuwe stats terug, zonder dagen ouder dan BEWAAR_DAGEN.
// `bijzonder`: een moment om te onthouden (BIJZONDER); `reeks`: goede gokken bij hoger/lager.
function boekSpel(stats, dag, userId, spel, inzet, uitbetaling, { bijzonder = null, reeks = 0 } = {}) {
  const d = stats?.[dag] || { leden: {}, grootste: null };
  const lid = d.leden[userId] || {};
  const s = lid[spel] || leeg();
  const netto = uitbetaling - inzet;
  const uit = {
    ...stats,
    [dag]: {
      leden: { ...d.leden, [userId]: { ...lid, [spel]: { spellen: s.spellen + 1, ingezet: s.ingezet + inzet, uitbetaald: s.uitbetaald + uitbetaling } } },
      grootste: netto > (d.grootste?.netto || 0) ? { netto, userId, spel } : d.grootste,
      uitslagen: { ...d.uitslagen, [userId]: (d.uitslagen?.[userId] || '') + (netto > 0 ? 'W' : netto < 0 ? 'V' : 'G') },
      bijzonder: bijzonder ? { ...d.bijzonder, [bijzonder]: [...(d.bijzonder?.[bijzonder] || []), userId] } : d.bijzonder || {},
      hlReeks: reeks > (d.hlReeks?.n || 0) ? { n: reeks, userId } : d.hlReeks || null,
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
  const telt = (id) => !userId || id === userId;
  const totaal = leeg(), perSpel = {}, perLid = {}, uitslagen = {}, bijzonder = {};
  let grootste = null, hlReeks = null, zwarteDag = null;
  const dagen = Object.keys(stats || {}).filter(dag => dag >= vanDag && dag <= totDag).sort();
  for (const dag of dagen) {
    const d = stats[dag];
    const g = d.grootste;
    if (g && telt(g.userId) && g.netto > (grootste?.netto || 0)) grootste = { ...g, dag };
    const h = d.hlReeks;
    if (h && telt(h.userId) && h.n > (hlReeks?.n || 0)) hlReeks = { ...h, dag };
    for (const [id, reeks] of Object.entries(d.uitslagen || {})) if (telt(id)) uitslagen[id] = (uitslagen[id] || '') + reeks;
    for (const [soort, ids] of Object.entries(d.bijzonder || {})) {
      for (const id of ids) if (telt(id)) (bijzonder[soort] ||= {})[id] = (bijzonder[soort][id] || 0) + 1;
    }
    for (const [id, spellen] of Object.entries(d.leden || {})) {
      if (!telt(id)) continue;
      const opDag = leeg();
      for (const [spel, s] of Object.entries(spellen)) {
        tel(totaal, s);
        tel(perSpel[spel] ||= leeg(), s);
        tel(perLid[id] ||= leeg(), s);
        tel(opDag, s);
      }
      const netto = opDag.uitbetaald - opDag.ingezet;
      if (netto < (zwarteDag?.netto || 0)) zwarteDag = { netto, userId: id, dag };
    }
  }
  return { ...totaal, netto: totaal.uitbetaald - totaal.ingezet, perSpel, perLid, grootste, uitslagen, bijzonder, hlReeks, zwarteDag };
}

// ── De roddels ───────────────────────────────────────────────────────────────

// De langste reeks van één letter in de uitslagen, over alle leden: { n, userId } of null.
function langsteReeks(uitslagen, letter) {
  let best = null;
  for (const [userId, reeks] of Object.entries(uitslagen || {})) {
    for (const stuk of reeks.match(new RegExp(`${letter}+`, 'g')) || []) {
      if (stuk.length > (best?.n || 0)) best = { n: stuk.length, userId };
    }
  }
  return best;
}

const netto = (s) => s.uitbetaald - s.ingezet;
const meeste = (obj, maat) => Object.entries(obj || {}).sort((a, b) => maat(b[1]) - maat(a[1]))[0] || null;
const keer = (n) => (n > 1 ? ` (${n}×)` : '');

// Alles wat er over een samenvatting (vatSamen) te vertellen valt, als losse mrkdwn-regels.
// `naam(userId)` en `plek(spel)` komen van de aanroeper ("Sander", "de blackjacktafel").
function feiten(sam, { naam, plek }) {
  const uit = [];
  const lijst = (perLid) => Object.entries(perLid).map(([id, n]) => naam(id) + keer(n)).join(', ');
  const g = sam.grootste;
  if (g) uit.push(`🏆 *Grootste klapper:* ${naam(g.userId)} won *+${g.netto}* aan ${plek(g.spel)}.`);
  const geluk = meeste(sam.perLid, netto);
  if (geluk && netto(geluk[1]) > 0) uit.push(`🍀 *Geluksvogel:* ${naam(geluk[0])} staat netto op *+${netto(geluk[1])}* na ${geluk[1].spellen} spellen. Het huis houdt een oogje in het zeil.`);
  const pech = meeste(sam.perLid, (s) => -netto(s));
  if (pech && netto(pech[1]) < 0) uit.push(`🥀 *Pechvogel:* ${naam(pech[0])} liet *${-netto(pech[1])}* punten achter in ${pech[1].spellen} spellen.`);
  const koe = meeste(sam.perSpel, (s) => -netto(s));
  if (koe && netto(koe[1]) < 0) uit.push(`🏦 *Melkkoe van het huis:* ${plek(koe[0])}. De spelers lieten daar samen *${-netto(koe[1])}* punten liggen.`);
  const lek = meeste(sam.perSpel, netto);
  if (lek && netto(lek[1]) > 0) uit.push(`💸 *Lek in de kas:* aan ${plek(lek[0])} wonnen de spelers samen *+${netto(lek[1])}*. De croupier wordt verhoord.`);
  const winst = langsteReeks(sam.uitslagen, 'W');
  if (winst?.n >= 3) uit.push(`🔥 *Winstreeks:* ${naam(winst.userId)} won ${winst.n} spellen op rij.`);
  const verlies = langsteReeks(sam.uitslagen, 'V');
  if (verlies?.n >= 4) uit.push(`🧊 *Koude reeks:* ${naam(verlies.userId)} verloor ${verlies.n} spellen achter elkaar.`);
  const zwart = sam.zwarteDag;
  if (zwart?.netto <= -8) {
    const dag = new Date(`${zwart.dag}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', timeZone: 'Europe/Amsterdam' });
    uit.push(`🌑 *Zwarte dag:* op ${dag} verloor ${naam(zwart.userId)} in het casino *${-zwart.netto}* punten.`);
  }
  const b = sam.bijzonder || {};
  if (b.jackpot) uit.push(`🎰 *Jackpot:* ${lijst(b.jackpot)} trok drie keer de Kroket God.`);
  if (b.blackjack) uit.push(`🃏 *Blackjack:* ${lijst(b.blackjack)}.`);
  if (b.getal) uit.push(`🎯 *Los getal raak:* ${lijst(b.getal)}. Kans: 1 op 37.`);
  if (b.plafond) uit.push(`🔝 *Hoger/lager tot het plafond:* ${lijst(b.plafond)}.`);
  if (sam.hlReeks?.n >= 4) uit.push(`🔼 *Kaartenlezer:* ${naam(sam.hlReeks.userId)} raadde ${sam.hlReeks.n} keer goed in één spel hoger/lager.`);
  const gast = meeste(sam.perLid, (s) => s.spellen);
  if (gast && gast[1].spellen >= 5 && Object.keys(sam.perLid).length > 1) uit.push(`🪑 *Vaste gast:* ${naam(gast[0])} speelde ${gast[1].spellen} van de ${sam.spellen} spellen.`);
  const populair = meeste(sam.perSpel, (s) => s.spellen);
  if (populair && Object.keys(sam.perSpel).length > 1) uit.push(`📊 *Populairst:* ${plek(populair[0])}, goed voor ${Math.round(100 * populair[1].spellen / sam.spellen)}% van alle spellen.`);
  return uit;
}

// n willekeurige regels, in hun oorspronkelijke volgorde.
function kiesFeiten(regels, n, rnd) {
  const gekozen = new Set();
  while (gekozen.size < Math.min(n, regels.length)) gekozen.add(Math.floor(rnd() * regels.length));
  return regels.filter((_, i) => gekozen.has(i));
}

module.exports = { BEWAAR_DAGEN, boekSpel, vatSamen, langsteReeks, feiten, kiesFeiten };
