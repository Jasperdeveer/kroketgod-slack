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
      'Wat aan wapens en het kanon wordt uitgegeven, is weg, ook als de vijand valt: een wapen kost echt punten.',
      'De weekvijanden zijn sterk: zonder wapens valt er zelden een.',
    ],
    zoWerktHet: [
      ...Object.entries(WAPENS).map(([key, w]) => `${w.icoon} *${w.naam}* (*${w.prijs} pt*) — ${w.uitleg} · \`/kroketgod koop ${key}\``),
      `🛢️ *Frituurkanon* — laad het via het raidbord; bij *${KANON_DOEL} pt* van minstens ${KANON_MIN_LEDEN} leden vuurt het`,
      `Hoogstens *${WAPENREK_MAX} wapens* per lid per vijand, ingezet bij uw volgende aanval. Wat u betaalt, krijgt u niet terug.`,
    ],
    vangnet: 'De Aflatenhandel opent het Frituurarsenaal. Wie de weekvijand wil vellen, koopt een wapen of laadt samen het kanon. Wat u betaalt, krijgt u niet terug.',
    knoppen: [
      { tekst: '🗡️ Naar het arsenaal', actionId: 'naslag_winkel', primair: true },
      { tekst: '⚔️ Val aan', actionId: 'bamischijf_aanval' },
    ],
  },
  raadpleeg: {
    naam: 'Raadpleeg de Kroket God',
    kop: '🔮 Nieuw in het Rijk: Kroket God 5.0 en het raadplegen',
    feiten: [
      'Kroket God 5.0: vier rituelen onder één commando, elk met een klein gevolg in het spel. Elk ritueel mag een lid één keer per dag.',
      'Horoscoop: gunstige of ongunstige sterren verschuiven de winkans in het eerstvolgende duel van vandaag met 10%.',
      'Biecht: vrijspraak, of een boetedoening die bij volbrenging vóór middernacht 1 kroketpunt oplevert.',
      'Orakel: een cryptisch antwoord plus een voorspelling over een ander lid. Komt die vandaag uit, dan krijgt de vrager 1 kroketpunt.',
      'Canoniseer: een lid draagt een ander lid voor; bij 2 bevestigingen met een 😇 van anderen is de kandidaat tot middernacht Heilige van de Dag.',
    ],
    zoWerktHet: [
      '`/kroketgod raadpleeg` of de knop Raadpleeg in de App Home opent het ritueelvenster',
      '`/kroketgod raadpleeg horoscoop` — gunstige of ongunstige sterren voor uw volgende duel',
      '`/kroketgod raadpleeg biecht <zonde>` — vrijspraak of een boetedoening (+1 pt)',
      '`/kroketgod raadpleeg orakel <vraag>` — een antwoord en een voorspelling (+1 pt als die uitkomt)',
      '`/kroketgod raadpleeg canoniseer <naam>` — bevestig met :innocent: voor een Heilige van de Dag',
    ],
    vangnet: 'De Kroket God is nu versie 5.0 en laat zich raadplegen: een horoscoop, een biecht, een orakel en een canonisatie, elk één keer per dag met een gevolg in het spel.',
    knoppen: [
      { tekst: '🔮 Raadpleeg', actionId: 'open_raadpleeg', primair: true },
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
