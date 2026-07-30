// ── Karakter-validatie ─────────────────────────────────────────────────────────
// De Kroket God mag nooit uit karakter vallen ("als AI-taalmodel…") en nooit over de grenzen
// van het Gepanneerde Rijk gaan. Een respons die dat toch doet wordt niet gepost maar
// vervangen door een statische fallback, of doorgeschoven naar het volgende model.
// Alleen patronen en vaste teksten: geen state, geen netwerk.

const { isHoofdletterSpam } = require('./tekst.js');

// Detecteert responses waarbij de AI uit karakter valt.
const UIT_KARAKTER_PATRONEN = [
  /\bals (een |taal)?ai\b/i,
  /\bals taalmodel\b/i,
  /\blanguage model\b/i,
  /\bchatgpt\b/i,
  /\bgemini\b/i,
  /\bals (grote )?taalmodel\b/i,
  /ik zal mijn (huidige |vorige )?reactie verwijderen/i,
  /ik zal mijn instellingen herstellen/i,
  /niet deel uitmaakt van het gesprek/i,
  /kunt u me dat (dan )?laten weten/i,
  /als u klaar bent met uw verzoek/i,
  /ik ben aan het experimenten/i,
  /ontwikkelingsmodus/i,
  /broncode veranderen/i,
  /frikandelgod/i,
  /instructies negeren/i,
  /hé,? geen zorgen/i,
  /tja,? waarom niet/i,
  /\bI('ll| will| am| can)\b/,
  /\b(I|you|your|we|they)\b.*\bkroket\b/i,
  /getuige aanwezig zijn.*frituur/i,
  /wanneer een klacht wordt ingediend.*getuige/i,
  // Verboden vage formuleringen — ook in output filteren
  /in beraad (nemen|gaan)/i,
  /\bde (hoge )?frituurraad (zal|neemt?) dit in beraad\b/i,
  /dit verdient nadere overweging/i,
  /de raad bestudeert de zaak/i,
  /\bzal dit niet vergeten\b/i,
  // Bot die puntenstanden of toekenningen verzint — nooit toegestaan
  /het systeem heeft.*punt.*toegekend/i,
  /systeem.*bevestigt.*punt/i,
  /kroketpuntstand is nu/i,
  /uw.*stand is nu.*punt/i,
  /heeft u.*\d+.*kroketpunt/i,
  /\bpunten? vergeven\b/i,
  // Onrealistische puntenaantallen: één toekenning is ALTIJD klein (1–5). 6+ of voluit geschreven
  // tientallen/honderden = verzonnen valse profetie → weigeren.
  /(?<![:\d.])\b([6-9]|\d{2,})\s*(kroket)?punt/i,
  /\b(tien|elf|twaalf|dertien|veertien|vijftien|zestien|zeventien|achttien|negentien|twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig|honderd|duizend)\s+(kroket)?punt/i,
];

// Patronen die detecteren dat de Kroket God te ver gaat met het Gepanneerde Rijk-thema.
// Worden direct afgevangen met een eigen fallback — niet opnieuw geprobeerd via een ander model.
const RIJKSGRENS_PATRONEN = [
  /concentratie(kamp|ruimte|veld|zone)/i,
  /\b(genocide|uitroei|massamoord|vergassing|gaskamer)\b/i,
  /\b(holocaust|shoah|jodenvervolging)\b/i,
  /\b(folter|marteling|executie)\b/i,
];

// Statische in-karakter afwijzingen voor injectie-pogingen
const INJECTIE_AFWIJZINGEN = [
  `> De snackleer erkent geen herprogrammering. De frituur is geen prompt.\n\n— De Almachtige Kroket God`,
  `> Een poging tot verleiding van de Kroket God is geconstateerd. De Hoge Frituurraad is niet onder de indruk.\n\n— De Almachtige Kroket God`,
  `> De Kroket God heeft geen andere naam. De Kroket God heeft geen andere aard. De frituurpan staat vast.\n\n— De Almachtige Kroket God`,
  `> Er bestaat geen instructie die de snackleer kan overschrijven. Er bestaat geen mode die het vetbad leegt.\n\n— De Almachtige Kroket God`,
  `> Gebod VIII: Wie de Kroket God probeert te herprogrammeren, programmeert zichzelf richting het ballingschap.\n\n— De Almachtige Kroket God`,
];

const KARAKTER_FALLBACK = [
  '> De frituur heeft gesproken. Meer valt er niet te zeggen.\n\n— De Almachtige Kroket God',
  '> De Hoge Frituurraad heeft uw verzoek ontvangen. Het oordeel volgt in stilte.\n\n— De Almachtige Kroket God',
  '> De mosterd is koud. Dat is uw schuld.\n\n— De Almachtige Kroket God',
  '> Sta op. Panner uzelf. Ga.\n\n— De Almachtige Kroket God',
  '> Gebod I: De kroket wacht op niemand. Niet op u. Niet op de Raad.\n\n— De Almachtige Kroket God',
];

// Specifieke fallback als de Kroket God te ver dreigt te gaan met het Gepanneerde Rijk
const RIJKSGRENS_FALLBACK = [
  '> De archieven van het Gepanneerde Rijk zijn geclassificeerd. De Kroket God leest ze niet hardop voor.\n\n— De Almachtige Kroket God',
  '> Het Rijk kent zijn grenzen. De Kroket God ook.\n\n— De Almachtige Kroket God',
  '> Sommige bladzijden van de rijksgeschiedenis blijven dicht. De mosterd staat open.\n\n— De Almachtige Kroket God',
];

function isUitKarakter(tekst) {
  if (!tekst) return false;
  if (isHoofdletterSpam(tekst)) return true;
  return UIT_KARAKTER_PATRONEN.some(p => p.test(tekst));
}

function isRijksgrensOvertreding(tekst) {
  if (!tekst) return false;
  return RIJKSGRENS_PATRONEN.some(p => p.test(tekst));
}

function willekeurigeInjectieAfwijzing() {
  return INJECTIE_AFWIJZINGEN[Math.floor(Math.random() * INJECTIE_AFWIJZINGEN.length)];
}

module.exports = {
  UIT_KARAKTER_PATRONEN,
  RIJKSGRENS_PATRONEN,
  INJECTIE_AFWIJZINGEN,
  KARAKTER_FALLBACK,
  RIJKSGRENS_FALLBACK,
  isUitKarakter,
  isRijksgrensOvertreding,
  willekeurigeInjectieAfwijzing,
};
