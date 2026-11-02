// ── Toegang: wie mag lid worden ───────────────────────────────────────────────
//
// `aanmelden` werd afgehandeld vóór de toets op DM en kanaal. Iedereen in de werkruimte kon zich
// dus via een DM of de App Home aanmelden, ook wie nooit in het besloten kanaal van het
// genootschap zat — en daarna meespelen, punten krijgen en in de systeemprompt belanden. Wie al
// lid was en het nog eens deed, verloor zijn rol en karakter: het intakeformulier schreef het
// hele dossier opnieuw.
//
// DE REGELS:
//   · Wie al lid is, wordt niet opnieuw ingeschreven. Het dossier blijft staan.
//   · Aanmelden in het gewijde kanaal zelf bewijst het lidmaatschap van dat kanaal: in een
//     besloten kanaal typt alleen wie erin zit. Dat geldt NIET voor de App Home, die zich voor
//     de commando-afhandeling als het hoofdkanaal voordoet.
//   · Elders telt alleen een bevestiging uit de ledenlijst van het kanaal
//     (conversations.members). Kan die niet worden opgehaald — in productie ontbreekt de scope
//     daarvoor vaak — dan is het antwoord nee, met de verwijzing naar het kanaal.
//
// Puur: geen Slack. De aanroeper geeft mee wat hij weet. Zie toegang.test.js.

'use strict';

// kanaalLid: true (bevestigd), false (niet in het kanaal) of null (onbekend).
function magAanmelden({ alLid = false, inHoofdkanaal = false, kanaalLid = null } = {}) {
  if (alLid) {
    return { ok: false, reden: 'U bent al lid van de Kroket Illuminati. Uw dossier wordt niet opnieuw ingeschreven — een wijziging loopt via de beheerder.' };
  }
  if (inHoofdkanaal || kanaalLid === true) return { ok: true };
  return { ok: false, reden: 'Aanmelden kan alleen in het gewijde kanaal van het genootschap zelf. Wie daar niet zit, kan geen volgeling worden.' };
}

module.exports = { magAanmelden };
