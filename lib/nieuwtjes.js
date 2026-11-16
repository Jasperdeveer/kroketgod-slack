// ── Nieuwe functies uitlichten ─────────────────────────────────────────────────
// Een mededeling van de Kroket God over iets nieuws in het Rijk. Het decreet zelf schrijft de
// keten; wat het kost en hoe het werkt staat hier vast en komt eronder. Een model dat een prijs
// verzint of een commando verkeerd spelt, mag leden niet op het verkeerde been zetten.
//
// Nieuwe functie om uit te lichten? Eén entry in FUNCTIES; `/kroketgod uitlichten <key>` (beheer)
// kent hem dan vanzelf. Pure functies, zodat de test ze zonder Slack kan draaien.

const { KOSTEN_NIEUW, KOSTEN_BESTAAND } = require('./gasten.js');
const { WAPENS, WAPENREK_MAX, KANON_DOEL, KANON_MIN_LEDEN } = require('./wapens.js');

const FUNCTIES = {
  gasten: {
    naam: 'Gasten uitnodigen',
    kop: '🚪 Nieuw in het Rijk: gasten uitnodigen',
    // Wat het model mag gebruiken. Alles wat hier niet staat, hoort het niet te beweren.
    feiten: [
      'Volgelingen kunnen vanaf nu gasten in het kanaal halen: nevenentiteiten zoals Benito, De Heilige Mr. Satébal, of iemand die ze zelf verzinnen.',
      `Een nieuwe gast kost ${KOSTEN_NIEUW} kroketpunten. Het lid geeft hem een naam en een gezicht en beschrijft hoe hij praat; de Hoge Frituurraad schrijft zijn karakter uit en kiest de woorden waarop hij reageert.`,
      `Een bekende gast terughalen kost ${KOSTEN_BESTAAND} kroketpunten.`,
      'Een gast antwoordt als iemand een van zijn trefwoorden noemt, en valt soms ongevraagd in.',
    ],
    zoWerktHet: [
      `\`/kroketgod invite\` — een nieuwe gast: naam, avatar en tone of voice; de trefwoorden kiest de Raad (*${KOSTEN_NIEUW} punten*)`,
      `\`/kroketgod invite bekend\` — haal een bekende gast terug (*${KOSTEN_BESTAAND} punten*)`,
      'Noem een trefwoord van een gast in het kanaal, en hij antwoordt.',
    ],
    // Als de keten niets bruikbaars levert: liever deze vaste zin dan een losse Kroket God-spreuk.
    vangnet: 'De Hoge Frituurraad opent de poorten van het Rijk voor gasten. Wie punten offert, mag een nevenentiteit binnenhalen: een nieuwe, of een oude bekende.',
    knoppen: [
      { tekst: '🚪 Nodig een gast uit', actionId: 'gast_nieuw_open', primair: true },
      { tekst: '👥 Bekende gasten', actionId: 'gast_bekend_open' },
    ],
  },
  // Het Frituurarsenaal (lib/wapens.js). Prijzen en effecten komen uit de catalogus, nooit los getypt.
  wapens: {
    naam: 'Het Frituurarsenaal',
    kop: '🗡️ Nieuw in het Rijk: het Frituurarsenaal',
    feiten: [
      `Zolang er een weekvijand rondloopt, verkoopt de Aflatenhandel wapens: ${Object.values(WAPENS).map(w => `${w.naam} (${w.prijs} punten: ${w.uitleg})`).join('; ')}.`,
      `Elk lid koopt hoogstens ${WAPENREK_MAX} wapens per vijand; een wapen gaat op bij de volgende aanval.`,
      `Het Frituurkanon vuurt als minstens ${KANON_MIN_LEDEN} leden samen ${KANON_DOEL} punten inleggen, en slaat dan een flink stuk van zijn levenspunten weg.`,
      'Alles wat aan wapens en het kanon wordt uitgegeven, gaat naar de buit van de vijand: wie hem velt, krijgt het terug; ontsnapt hij, dan is het weg.',
      'De weekvijanden zijn daarom sterker geworden: zonder wapens valt er zelden een.',
    ],
    zoWerktHet: [
      ...Object.entries(WAPENS).map(([key, w]) => `${w.icoon} *${w.naam}* (*${w.prijs} pt*) — ${w.uitleg} · \`/kroketgod koop ${key}\``),
      `🛢️ *Frituurkanon* — laad het via het raidbord; bij *${KANON_DOEL} pt* van minstens ${KANON_MIN_LEDEN} leden vuurt het`,
      `Hoogstens *${WAPENREK_MAX} wapens* per lid per vijand, ingezet bij uw volgende aanval. Valt hij, dan krijgt iedereen zijn inzet terug.`,
    ],
    vangnet: 'De Aflatenhandel opent het Frituurarsenaal. Wie de weekvijand wil vellen, koopt een wapen of laadt samen het kanon. Valt hij, dan krijgt iedereen zijn inzet terug; ontsnapt hij, dan is alles weg.',
    knoppen: [
      { tekst: '🗡️ Naar het arsenaal', actionId: 'naslag_winkel', primair: true },
      { tekst: '⚔️ Val aan', actionId: 'bamischijf_aanval' },
    ],
  },
};

function uitlichtPrompt(functie) {
  return `Kondig plechtig een nieuwe mogelijkheid in het Rijk aan: ${functie.naam}. Dit is wat er waar is:\n` +
    `${functie.feiten.map(f => `- ${f}`).join('\n')}\n` +
    'Richt je tot de hele groep. Hooguit vier zinnen, in het decreet-formaat. Noem geen commando\'s: die staan onder het decreet. ' +
    'Verzin geen prijzen of regels die hierboven niet staan. Geen inleidingszin.';
}

// De mededeling voor postToChannel: tekst plus knoppen. `decreet` is wat de keten schreef (of
// leeg, dan het vangnet).
function bouwUitlichting(functie, decreet) {
  const kern = String(decreet ?? '').trim() || functie.vangnet;
  const tekst = `*${functie.kop}*\n\n${kern}\n\n*Zo werkt het*\n${functie.zoWerktHet.map(r => `• ${r}`).join('\n')}`;
  const knoppen = functie.knoppen.map(k => ({
    type: 'button', action_id: k.actionId, text: { type: 'plain_text', text: k.tekst, emoji: true },
    ...(k.primair ? { style: 'primary' } : {}),
  }));
  return { tekst, knoppen };
}

module.exports = { FUNCTIES, uitlichtPrompt, bouwUitlichting };
