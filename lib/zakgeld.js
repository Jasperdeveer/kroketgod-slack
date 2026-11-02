// ── Zakgeld: vijf kroketpunten, elke maandag om 08:00 ────────────────────────
//
// De weekreset zet alle kroketpunten zondagnacht op nul. Daarna kon niemand iets tot hij eerst
// iets had verdiend: geen offer-aanval op de weekvijand, geen roof (de dader moet borg hebben en
// het doelwit iets bezitten), niets in de winkel. Nu deelt de Raad elke maandag om 08:00 ZAKGELD
// punten uit, om meteen in te zetten.
//
// WIE KRIJGT HET, EN HOE VAAK. Eén keer per lid per week, bijgehouden in `zakgeld.json`
// ({ week, ontvangen: [userIds] }). De maandagcron deelt het uit aan iedereen; de inhaalslag van
// 09:00 vult aan wie het mist (bot plat om 08:00), en een nieuw of hersteld lid krijgt het meteen.
// De lijst is de idempotentie-guard: wie zich in dezelfde week opnieuw aanmeldt of uit het
// archief terugkeert, krijgt het geen tweede keer. De weekreset leegt de lijst.
//
// ⚠️ TWEE VOORWAARDEN, allebei nodig:
//   1. De reset van déze week is geweest. Wordt de zondagse reset gemist, dan staat de marker
//      nog op de vorige week en haalt de inhaalslag hem om 09:00 in. Zou het zakgeld er al
//      vóór liggen, dan veegt die reset het weg — en staat de lijst al vol, dus het komt niet
//      terug.
//   2. Het is maandag 08:00 geweest. Anders deelt de opstart van 03:00 (nachtelijke herstart)
//      het al 's nachts uit, of een nieuw lid op zondagavond voor de week die nog moet beginnen.
//
// WAT HET NIET IS. Zakgeld is geen verdienste. Het levert geen roem op (de uitkering gaat buiten
// pasScoreAanMetCheck om), relikwieën meten wat je erbovenop verdient (`verdiendeStand`), en een
// week waarin niemand boven het zakgeld uitkwam heeft geen kampioen (`kampioenWaardig`). Zonder
// die twee correcties waren de eerste relikwieën (1 en 5 punten) stil cadeau gegeven en werd op
// zondag iemand gekroond die de hele week niets deed.
//
// BESCHERMD TEGEN ROOF, TOT EN MET WOENSDAG (verzoek van de eigenaar). Zakgeld dat je maandag
// krijgt en dinsdag kwijt bent aan een dief, is geen zakgeld. Tot en met woensdag ziet een dief
// daarom alleen wat boven het zakgeld uitkomt; vanaf donderdag is alles weer te halen.
// Het is een BODEM, geen geoormerkt bedrag: wie een deel van zijn zakgeld uitgaf en daarna iets
// verdiende, is tot het zakgeld beschermd — er wordt niet bijgehouden welk punt "zakgeld" was.
// Dat is uit te leggen in één zin ("onder de vijf valt er niets te roven") en niet te omzeilen.
// Alleen wie het zakgeld van deze week echt kreeg, is beschermd: maandag vóór 08:00 ligt er
// niets te beschermen.
//
// Puur: geen I/O en geen klok — de aanroeper geeft de Amsterdamse datum en tijd mee.
// Zie zakgeld.test.js.

'use strict';

const ZAKGELD = 5;
const ZAKGELD_UUR = 8; // maandag 08:00 Amsterdamse tijd
const BESCHERMD_TOT_WEEKDAG = 3; // tot en met woensdag niet te roven (maandag = 1)

// Is het uitdeelmoment van `week` (de maandag, 'YYYY-MM-DD') al geweest? `vandaag` is de
// Amsterdamse datum in hetzelfde formaat, `minuten` het aantal minuten sinds middernacht daar.
function uitdeelMomentGeweest(week, vandaag, minuten) {
  if (!week || !vandaag) return false;
  if (vandaag !== week) return vandaag > week; // ISO-datums sorteren als tekst
  return minuten >= ZAKGELD_UUR * 60;
}

// Welke leden moeten voor `week` nog zakgeld krijgen? `resetWeek` is de week uit de weekreset-
// marker. Een state van een andere week telt als leeg.
function nogTeOntvangen(state, week, ledenIds, { resetWeek, momentGeweest }) {
  if (!week || resetWeek !== week || !momentGeweest) return [];
  const ontvangen = new Set(state?.week === week ? (state.ontvangen || []) : []);
  return [...new Set(ledenIds)].filter(id => !ontvangen.has(id));
}

// De nieuwe state nadat `ids` hun zakgeld voor `week` hebben gekregen.
function naUitkering(state, week, ids) {
  const vorig = state?.week === week ? (state.ontvangen || []) : [];
  return { week, ontvangen: [...new Set([...vorig, ...ids])] };
}

// De stand zonder het zakgeld: wat je deze week netto zelf verdiend hebt. Negatief als je meer
// uitgaf dan je verdiende.
function verdiendeStand(score) {
  return (Number(score) || 0) - ZAKGELD;
}

// Hoeveel van `score` is tegen roof beschermd? `weekdag`: Amsterdamse dag, maandag = 1, zondag = 7.
function beschermdTegenRoof(score, { ontvangen, weekdag }) {
  if (!ontvangen || !(weekdag >= 1 && weekdag <= BESCHERMD_TOT_WEEKDAG)) return 0;
  return Math.min(Math.max(0, Number(score) || 0), ZAKGELD);
}

// Wat een dief bij deze stand kan zien: alles boven het beschermde deel.
function roofbaar(score, opties) {
  return Math.max(0, (Number(score) || 0) - beschermdTegenRoof(score, opties));
}

// Een weekkampioen kronen heeft alleen zin als iemand boven het zakgeld uitkwam.
function kampioenWaardig(topScore) {
  return verdiendeStand(topScore) > 0;
}

module.exports = {
  ZAKGELD, ZAKGELD_UUR, BESCHERMD_TOT_WEEKDAG, uitdeelMomentGeweest, nogTeOntvangen, naUitkering,
  verdiendeStand, kampioenWaardig, beschermdTegenRoof, roofbaar,
};
