// ── Nieuwe functies uitlichten ─────────────────────────────────────────────────
// Een mededeling van de Kroket God over iets nieuws in het Rijk. Het decreet zelf schrijft de
// keten; wat het kost en hoe het werkt staat hier vast en komt eronder. Een model dat een prijs
// verzint of een commando verkeerd spelt, mag leden niet op het verkeerde been zetten.
//
// Nieuwe functie om uit te lichten? Eén entry in FUNCTIES; `/kroketgod uitlichten <key>` (beheer)
// kent hem dan vanzelf. Pure functies, zodat de test ze zonder Slack kan draaien.

const { KOSTEN_NIEUW, KOSTEN_BESTAAND } = require('./gasten.js');

const FUNCTIES = {
  gasten: {
    naam: 'Gasten uitnodigen',
    kop: '🚪 Nieuw in het Rijk: gasten uitnodigen',
    // Wat het model mag gebruiken. Alles wat hier niet staat, hoort het niet te beweren.
    feiten: [
      'Volgelingen kunnen vanaf nu gasten in het kanaal halen: nevenentiteiten zoals Benito, De Heilige Mr. Satébal, of iemand die ze zelf verzinnen.',
      `Een nieuwe gast kost ${KOSTEN_NIEUW} kroketpunten. Het lid geeft hem een naam, een gezicht en trefwoorden, en beschrijft hoe hij praat; de Hoge Frituurraad schrijft zijn karakter uit.`,
      `Een bekende gast terughalen kost ${KOSTEN_BESTAAND} kroketpunten.`,
      'Een gast antwoordt als iemand een van zijn trefwoorden noemt, en valt soms ongevraagd in.',
    ],
    zoWerktHet: [
      `\`/kroketgod invite\` — een nieuwe gast: naam, avatar, trefwoorden en tone of voice (*${KOSTEN_NIEUW} punten*)`,
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
