// ── De Frituurbeurs: de rekenregels ───────────────────────────────────────────
// Leden kopen met kroketpunten aandelen in een medelid. Deze module bevat uitsluitend de
// rekenkunde en de toetsing — geen state, geen Slack, geen ledendata. Dat maakt elke regel
// hieronder te testen zonder een frituur op te starten; het bijhouden van posities, de berichten
// en de App Home staan in index.js.
//
// WAAROM DIT SPEL BESTAAT. Vanaf woensdag weet je meestal al dat je de week niet meer wint, en
// dan is er niets meer te doen. Op de beurs kun je dan nog steeds verdienen aan wie hem wél
// wint — of aan wie nog gaat klimmen.
//
// DE TWEE MANIEREN OM TE WINNEN, en waarom ze niet hetzelfde zijn:
//   1. HET DIVIDEND (lange termijn). Wie op maandag een aandeel koopt in iemand die zondag
//      bovenaan eindigt, krijgt roem per aandeel. Vroeg gokken is goedkoop, want de koers volgt
//      de stand: wie al bovenaan staat is duur. Vroege overtuiging betaalt, laat meelopen niet.
//   2. DE KOERSWINST (korte termijn). Stijgt uw aandeel in waarde, dan kunt u het doordeweeks
//      verkopen. De verkoopprijs is bewust maar VERKOOP_FACTOR van de koers: pas bij een flinke
//      klim maakt u winst, dus dit is een weddenschap en geen geldkraan.
//
// WAAROM HET DIVIDEND IN ROEM UITBETAALT EN NIET IN KROKETPUNTEN. De afrekening valt samen met
// de weekreset, en die zet alle kroketpunten op nul. Punten uitbetalen zou dus letterlijk niets
// waard zijn. Bovendien past het: u zet vergankelijke weekpunten in en koopt er blijvend aanzien
// mee — precies de ruil die de rest van het spel niet biedt.

// Koers = stand gedeeld door KOERS_DELER, naar boven afgerond, met een bodem van MIN_KOERS.
// Zo kost een leider ongeveer vier keer zoveel als een middenmoter, en is niemand ooit gratis.
const MIN_KOERS = 1;
const KOERS_DELER = 4;

// Bij verkoop krijgt u maar een deel van de koers terug. Zonder deze marge zou "maandag alles
// kopen, vrijdag alles verkoopen" gegarandeerd winst zijn, omdat standen over een week vooral
// stijgen. Met 0,7 moet een aandeel ruwweg in waarde verdubbelen voordat verkopen iets oplevert.
const VERKOOP_FACTOR = 0.7;

// Blootstelling per lid per week. Begrenst zowel het risico als de exploitruimte: zes aandelen
// zijn een echte investering (een week winnen levert grofweg veertig punten op), geen gok om
// niks. Hoogstens drie in één persoon, zodat spreiden loont.
const MAX_AANDELEN_TOTAAL = 6;
const MAX_PER_DOELWIT = 3;

// Roem per aandeel, naar eindplek in de week (index 0 = eerste plek). Alles daarbuiten: niets.
const DIVIDEND_PER_PLEK = [3, 2, 1];

function koers(score) {
  return Math.max(MIN_KOERS, Math.ceil(Math.max(0, Number(score) || 0) / KOERS_DELER));
}

function verkoopprijs(score) {
  return Math.max(1, Math.floor(koers(score) * VERKOOP_FACTOR));
}

// Roem per aandeel voor een 1-gebaseerde eindplek.
function dividendVoorPlek(plek) {
  return DIVIDEND_PER_PLEK[plek - 1] || 0;
}

// Aantal aandelen dat `koperId` in totaal bezit, over alle doelwitten.
function totaalAandelen(posities, koperId) {
  return Object.values(posities?.[koperId] || {}).reduce((s, n) => s + (Number(n) || 0), 0);
}

function aandelenIn(posities, koperId, doelId) {
  return Number(posities?.[koperId]?.[doelId]) || 0;
}

// Toetst een aankoop en rekent de kosten uit. Geeft altijd { ok, reden, kosten } terug; `reden`
// is de tekst die het lid te zien krijgt (zonder opmaak, de aanroeper maakt er een bericht van).
function toetsAankoop({ koperId, doelId, aantal, doelScore, punten, posities = {}, doelIsLid = true, doelVerbannen = false }) {
  const n = Math.floor(Number(aantal) || 0);
  if (n < 1) return { ok: false, reden: 'Een aankoop is minstens één aandeel.', kosten: 0 };
  if (koperId === doelId) return { ok: false, reden: 'Handel in uw eigen aandeel is insiderhandel — de Raad duldt het niet.', kosten: 0 };
  if (!doelIsLid) return { ok: false, reden: 'Alleen aandelen in erkende leden van het genootschap worden verhandeld.', kosten: 0 };
  // Een balling verdient niets, dus zijn koers staat stil en het aandeel is een dode belegging.
  // De beurs schorst de handel liever dan iemand een waardeloos aandeel te verkopen.
  if (doelVerbannen) return { ok: false, reden: 'De handel in dit aandeel is geschorst: het lid is verbannen.', kosten: 0 };

  const alIn = aandelenIn(posities, koperId, doelId);
  if (alIn + n > MAX_PER_DOELWIT) {
    return { ok: false, kosten: 0,
      reden: `U mag hoogstens ${MAX_PER_DOELWIT} aandelen in één lid bezitten (u heeft ${alIn}).` };
  }
  const totaal = totaalAandelen(posities, koperId);
  if (totaal + n > MAX_AANDELEN_TOTAAL) {
    return { ok: false, kosten: 0,
      reden: `Uw portefeuille mag hoogstens ${MAX_AANDELEN_TOTAAL} aandelen bevatten (u heeft ${totaal}).` };
  }
  const kosten = koers(doelScore) * n;
  if (kosten > (Number(punten) || 0)) {
    return { ok: false, kosten, reden: `Dit kost ${kosten} kroketpunten; u heeft ${Number(punten) || 0}.` };
  }
  return { ok: true, reden: '', kosten };
}

// Toetst een verkoop en rekent de opbrengst uit.
function toetsVerkoop({ koperId, doelId, aantal, doelScore, posities = {} }) {
  const n = Math.floor(Number(aantal) || 0);
  if (n < 1) return { ok: false, reden: 'Een verkoop is minstens één aandeel.', opbrengst: 0 };
  const bezit = aandelenIn(posities, koperId, doelId);
  if (bezit < 1) return { ok: false, reden: 'U bezit geen aandelen in dit lid.', opbrengst: 0 };
  if (n > bezit) return { ok: false, reden: `U bezit ${bezit} aandeel/aandelen in dit lid.`, opbrengst: 0 };
  return { ok: true, reden: '', opbrengst: verkoopprijs(doelScore) * n };
}

// Rekent de hele beurs af tegen de eindstand van de week.
//   posities  { koperId: { doelId: aantal } }
//   eindstand [[doelId, score], ...] — AFLOPEND gesorteerd, zoals de ranglijst
// Geeft per koper met een uitkering: { koperId, roem, regels: [{ doelId, aantal, plek, roem }] }.
// Aandelen in iemand buiten de dividendplekken leveren niets op en verschijnen niet in de regels;
// wie helemaal niets ophaalt komt niet in de uitkomst voor.
function berekenAfrekening({ posities = {}, eindstand = [] }) {
  const plekVan = new Map();
  eindstand.forEach(([id], i) => plekVan.set(id, i + 1));
  const uit = [];
  for (const [koperId, bezit] of Object.entries(posities)) {
    const regels = [];
    let roem = 0;
    for (const [doelId, aantalRuw] of Object.entries(bezit || {})) {
      const aantal = Number(aantalRuw) || 0;
      if (aantal < 1) continue;
      const plek = plekVan.get(doelId);
      if (!plek) continue; // doelwit staat niet in de eindstand (bv. uit het genootschap gezet)
      const perAandeel = dividendVoorPlek(plek);
      if (!perAandeel) continue;
      const opbrengst = perAandeel * aantal;
      roem += opbrengst;
      regels.push({ doelId, aantal, plek, roem: opbrengst });
    }
    if (roem > 0) {
      // Hoogste opbrengst eerst: dat is de regel waar de koper om geeft.
      regels.sort((a, b) => b.roem - a.roem || a.plek - b.plek);
      uit.push({ koperId, roem, regels });
    }
  }
  uit.sort((a, b) => b.roem - a.roem);
  return uit;
}

module.exports = {
  MIN_KOERS,
  KOERS_DELER,
  VERKOOP_FACTOR,
  MAX_AANDELEN_TOTAAL,
  MAX_PER_DOELWIT,
  DIVIDEND_PER_PLEK,
  koers,
  verkoopprijs,
  dividendVoorPlek,
  totaalAandelen,
  aandelenIn,
  toetsAankoop,
  toetsVerkoop,
  berekenAfrekening,
};
