// ── De Voorraadkelder ──────────────────────────────────────────────────────────
// Vooruit gegenereerde kanaalinhoud, 's nachts gemaakt en op het moment van posten uit de kelder
// gehaald in plaats van live bij een LLM opgehaald.
//
// WAT DIT OPLOST. Een cron die om 07:30 een kroketfeitje wil posten heeft precies één kans: is de
// hele providerketen op dat moment door zijn quota of onbereikbaar, dan komt er niets — en niemand
// merkt dat er iets ontbrak, want er staat geen foutmelding in het kanaal. Met een kelder is die
// storing onzichtbaar: het feitje van vannacht ligt klaar. En omdat er om 03:00 niemand wacht, mag
// het vullen rustig meerdere pogingen doen, wat live nooit kan.
//
// WAT DIT NIET OPLOST. Dit is geen quota-truc: dezelfde tekst kost dezelfde tokens, alleen op een
// ander uur. De winst is beschikbaarheid, ruimte om te hertesten, en dat het dag-quota tijdens
// kantooruren naar de @-mentions gaat waar iemand écht op een antwoord zit te wachten.
//
// HARDE REGEL VOOR AANROEPERS — WAT ER NIET IN MAG. Alleen inhoud die naar géén enkele levende
// stand verwijst. Geen scores, geen namen van leden, geen verbanningen, geen HP van de weekvijand,
// geen weer. Die veranderen tussen vannacht en straks, en een bericht dat een verkeerde stand
// noemt is erger dan geen bericht. Een kroketfeitje kan hier wél in; "prijs Jasper voor zijn
// klim naar de tweede plaats" nooit.
//
// STEMMING VAN DE DAG. De stemming zit in de systeemprompt en is per Amsterdamse kalenderdag
// geseed, dus een tekst van 03:00 heeft dezelfde stemming als een post van 14:00 diezelfde dag.
// Daarom is dit een DAGkelder: bij het serveren krijgt inhoud van vandaag voorrang. Is die er niet
// (mislukte nacht), dan gaat er alsnog een oudere tekst uit — een iets verkeerde stemming is nog
// altijd beter dan stilte. Ouder dan MAX_CARRY_DAGEN gaat weg.

const { readJSON, writeJSON } = require('./state.js');

const VOORRAAD_BESTAND = 'voorraad.json';

// Hoe lang een niet-gebruikte tekst mag blijven liggen als noodvoorraad.
const MAX_CARRY_DAGEN = 3;

// Bovengrens per soort, zodat een lus die blijft vullen de kelder niet laat ontploffen.
const MAX_PER_SOORT = 12;

const loadVoorraad = () => readJSON(VOORRAAD_BESTAND, {});
const saveVoorraad = (data) => writeJSON(VOORRAAD_BESTAND, data);

// Dagsleutel in Amsterdamse tijd (YYYY-MM-DD); en-CA levert precies die volgorde.
function dagKeyAms(datum = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(datum);
}

// Normaliseren voor duplicaatdetectie: alleen letters/cijfers, kleine letters. Zo herkennen we
// twee teksten die alleen in opmaak of interpunctie verschillen als hetzelfde.
function vingerafdruk(tekst) {
  return String(tekst || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 200);
}

function isVers(item, nu = Date.now()) {
  return item && typeof item.tekst === 'string' &&
    (nu - (item.gemaakt || 0)) < MAX_CARRY_DAGEN * 86_400_000;
}

// Gooit verlopen inhoud weg. Geeft het aantal verwijderde items terug.
function ruimVoorraadOp() {
  const data = loadVoorraad();
  let weg = 0;
  for (const soort of Object.keys(data)) {
    const voor = (data[soort] || []).length;
    data[soort] = (data[soort] || []).filter(i => isVers(i));
    weg += voor - data[soort].length;
    if (!data[soort].length) delete data[soort];
  }
  if (weg) saveVoorraad(data);
  return weg;
}

// Haalt één tekst uit de kelder en verwijdert hem daar. Inhoud van vandaag eerst, anders de
// oudste nog-verse als noodvoorraad. Geeft null als de kelder voor dit soort leeg is — de
// aanroeper valt dan terug op live genereren.
function haalUitVoorraad(soort) {
  try {
    const data = loadVoorraad();
    const lijst = (data[soort] || []).filter(i => isVers(i));
    if (!lijst.length) {
      if ((data[soort] || []).length) { data[soort] = []; saveVoorraad(data); } // alles verlopen
      return null;
    }
    const vandaag = dagKeyAms();
    const idx = lijst.findIndex(i => i.dagKey === vandaag);
    const gekozen = idx !== -1 ? lijst.splice(idx, 1)[0] : lijst.shift();
    data[soort] = lijst;
    saveVoorraad(data);
    return { ...gekozen, vanVandaag: gekozen.dagKey === vandaag };
  } catch (err) {
    console.warn('⚠️ Voorraad uitnemen mislukt:', err.message);
    return null;
  }
}

// Legt één tekst in de kelder. Weigert duplicaten (ook t.o.v. wat er al ligt) en lege tekst.
function legInVoorraad(soort, tekst) {
  const schoon = String(tekst || '').trim();
  if (!schoon) return false;
  const data = loadVoorraad();
  const lijst = (data[soort] || []).filter(i => isVers(i));
  if (lijst.length >= MAX_PER_SOORT) return false;
  const vinger = vingerafdruk(schoon);
  if (lijst.some(i => vingerafdruk(i.tekst) === vinger)) return false;
  lijst.push({ tekst: schoon, gemaakt: Date.now(), dagKey: dagKeyAms() });
  data[soort] = lijst;
  saveVoorraad(data);
  return true;
}

// Vult de kelder tot `doel` verse items voor dit soort. `maker` is een async functie die één
// tekst teruggeeft (of null/leeg bij mislukking). Doet hoogstens doel*3 pogingen, zodat een
// generator die steeds hetzelfde of niets teruggeeft niet eindeloos doorloopt.
// Faalt nooit hard: een lege kelder betekent alleen dat de aanroeper straks live genereert.
async function vulVoorraad(soort, doel, maker) {
  const uit = { soort, gemaakt: 0, mislukt: 0, dubbel: 0 };
  try {
    const aanwezig = (loadVoorraad()[soort] || []).filter(i => isVers(i)).length;
    const tekort = Math.max(0, Math.min(doel, MAX_PER_SOORT) - aanwezig);
    if (!tekort) return uit;
    for (let poging = 0; poging < tekort * 3 && uit.gemaakt < tekort; poging++) {
      let tekst = null;
      try {
        tekst = await maker();
      } catch (err) {
        console.warn(`⚠️ Voorraad "${soort}" genereren mislukt:`, err.message);
      }
      if (!tekst || !String(tekst).trim()) { uit.mislukt++; continue; }
      if (legInVoorraad(soort, tekst)) uit.gemaakt++;
      else uit.dubbel++;
    }
  } catch (err) {
    console.warn(`⚠️ Voorraad "${soort}" vullen mislukt:`, err.message);
  }
  return uit;
}

// Stand per soort, voor het dashboard en de nachtelijke logregel.
function voorraadStand() {
  const data = loadVoorraad();
  const vandaag = dagKeyAms();
  const uit = {};
  for (const [soort, lijst] of Object.entries(data)) {
    const vers = (lijst || []).filter(i => isVers(i));
    uit[soort] = { totaal: vers.length, vanVandaag: vers.filter(i => i.dagKey === vandaag).length };
  }
  return uit;
}

module.exports = {
  VOORRAAD_BESTAND,
  MAX_CARRY_DAGEN,
  MAX_PER_SOORT,
  dagKeyAms,
  vingerafdruk,
  ruimVoorraadOp,
  haalUitVoorraad,
  legInVoorraad,
  vulVoorraad,
  voorraadStand,
};
