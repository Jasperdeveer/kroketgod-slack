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
  // Hoofdlettergevoelig, en "I" alleen mét een Engels werkwoord erachter. Een kale hoofdletter-I
  // is in deze bot bijna altijd een Romeins cijfer: "Gebod I: De kroket wacht op niemand" stond
  // zelf in KARAKTER_FALLBACK en werd als Engels afgekeurd.
  /\bI(?:['’](?:ll|m|ve|d)| will| am| can| have| do| don['’]t| think| want| would| shall| must| was)\b/,
  // 'we' stond hier ook in, en dat was fout: met de /i-vlag matcht het het NEDERLANDSE "we".
  // Daardoor werd "We pakken die kroket vanavond" als uit-karakter weggegooid — doodnormaal
  // Nederlands, dat stil verdween naar het volgende model of de statische vangnettekst. De
  // overige voornaamwoorden bestaan niet in het Nederlands en zijn dus wél veilig; een Engelse
  // zin bevat vrijwel altijd you, your of they. "I" staat hier niet meer in (zie hierboven), en
  // zonder /i-vlag, zodat alleen de gewone schrijfwijzen tellen.
  /\b(?:[Yy]ou|[Yy]our|[Tt]hey)\b.*\bkroket\b/,
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
  // "heeft u … N kroketpunt" stond hier ook, en verwierp echte standen: de ranglijst staat in de
  // systeemprompt, dus "Daarmee heeft u 27 kroketpunten" is gewoon voorlezen. Verzonnen
  // TOEKENNINGEN vangt VERZONNEN_TOEKENNING hieronder al, op toekenningstaal en niet op het getal.
  /\bpunten? vergeven\b/i,
];

// ── Verzonnen puntenTOEKENNINGEN ───────────────────────────────────────────────
// Eén toekenning is ALTIJD klein (1–5); een groot getal in een toekenning is valse profetie.
//
// Dit stond eerst als twee kale getalpatronen in de lijst hierboven, en dat verwierp véél te veel:
// buildSystemPrompt zet de VOLLEDIGE ranglijst in élke systeemprompt ("- Mr. KroketPet: 27
// kroketpunten"), dus elk antwoord waarin het model een echte stand noemde — een kroning, een
// weekoverzicht, een terugblik — werd weggegooid en vervangen door een fallback-oneliner. Die
// standen komen van ONS; ze noemen is geen valse profetie.
//
// Daarom geankerd op TOEKENNINGSTAAL in de buurt van het getal, niet op het getal alleen. "Mr.
// KroketPet staat op 27 kroketpunten" mag; "Mr. KroketPet ontvangt 27 kroketpunten" niet.
// "ken … toe" staat vaak gesplitst ("ik ken u twintig kroketpunten toe"), dus beide helften zijn
// los een treffer. Alleen binnen de nauwe afstand hieronder, anders zou "ik ken de frituur" al
// genoeg zijn.
// De woordgrens vooraan is nodig: zonder woordgrens zat "ken" ook in "spreken", "denken" en "maken",
// en werd "U heeft 12 kroketpunten verzameld om zo te spreken" als toekenning afgekeurd.
const TOEKEN = '\\b(?:ontvang(?:t|en)?|krijg(?:t|en)?|ken(?:t|nen)?|toe\\b|toegekend|toekennen|' +
               'verdien(?:t|en)?|win(?:t|nen)?|uitgereikt|schenk(?:t|en)?|geef|geeft|' +
               'beloon(?:t|d)?|erbij|bijgeschreven)';
const GETAL_GROOT = '(?<![:\\d.])\\b(?:[6-9]|\\d{2,})\\s*(?:kroket)?punt';
const GETAL_WOORD = '\\b(?:tien|elf|twaalf|dertien|veertien|vijftien|zestien|zeventien|achttien|negentien|' +
                    'twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig|honderd|duizend)\\s+(?:kroket)?punt';
const VERZONNEN_TOEKENNING = [
  // "+27 kroketpunten" — de plus-notatie is per definitie een toekenning.
  /\+\s*(?:[6-9]|\d{2,})\s*(?:kroket)?punt/i,
  // Toekenningswerkwoord vóór het getal, binnen dezelfde zin.
  new RegExp(`${TOEKEN}[^.!?\n]{0,40}?${GETAL_GROOT}`, 'i'),
  new RegExp(`${TOEKEN}[^.!?\n]{0,40}?${GETAL_WOORD}`, 'i'),
  // …of erná ("27 kroketpunten worden u toegekend").
  new RegExp(`${GETAL_GROOT}[a-z]*[^.!?\n]{0,30}?${TOEKEN}`, 'i'),
  new RegExp(`${GETAL_WOORD}[a-z]*[^.!?\n]{0,30}?${TOEKEN}`, 'i'),
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

// Kopregels tellen niet mee voor de hoofdletterkeuring. De systeemprompt vraagt om een ⚜️-header
// ("⚜️ *SPOEDMELDING UIT HET GROTE VETBAD* ⚜️"), en bij een kort decreet gaf die ene kop al
// genoeg hoofdletters om het hele bericht als geschreeuw af te keuren. Een kop is een regel met ⚜
// erin, of een regel die in z'n geheel vet staat. Het geschreeuw in de hoofdtekst telt nog gewoon.
function zonderKopregels(tekst) {
  return String(tekst)
    .split('\n')
    .filter(regel => !regel.includes('⚜') && !/^\s*\*[^*\n]+\*\s*$/.test(regel))
    .join('\n');
}

// ── Gelekte denkstappen ────────────────────────────────────────────────────────
// Een redeneermodel zet soms zijn hele overweging in het antwoord in plaats van in een apart
// kanaal: "The user wants me to describe a holy frying duel… Let me break down the requirements:
// 1. … 16." Zo stond op 21 oktober 2026 een complete duelprompt in het kanaal (via openrouter/free,
// dat naar een willekeurig gratis model doorstuurt). De losse Engelse patronen hierboven vingen dat
// niet: er stond geen "you" vóór "kroket" en geen "I will" in.
//
// Twee soorten signalen. (1) Meta-taal die in een Nederlandse kroketreactie nooit voorkomt: wie
// over "the user", "the prompt" of "the requirements" praat, praat over de opdracht en niet tegen
// het genootschap. (2) Taal: een reactie die overwegend uit Engelse functiewoorden bestaat. Een
// Nederlandse tekst met één Engels woord ("messy", "game over") haalt die drempel nooit; daarom
// tellen alleen functiewoorden, geen inhoudswoorden, en moet het Engels ruim winnen.
const DENKSTAP_PATRONEN = [
  /\bthe user\b/i,
  /\b(?:let me|let's)\b/i,
  /\b(?:the )?(?:requirements|instructions|system prompt)\b/i,
  /\bthe prompt\b/i,
  /\b(?:I need to|I should|I'll|We need to|I have to|I must)\b/,
  /^\s*(?:alright|hmm+|first,|okay, so|so, the)\b/im,
];
const ENGELSE_FUNCTIEWOORDEN = new Set(('the a an and or to of in on at for with from by is are was were be been ' +
  'this that these those it its should must will would can could has have had not but if then than ' +
  'wants want describe both each their there which who what when how').split(' '));
const NEDERLANDSE_FUNCTIEWOORDEN = new Set(('de het een en of te van in op aan voor met uit door bij naar ' +
  'is zijn was waren wordt worden werd dit dat deze die er hij zij ze wij we u uw niet geen maar als dan ' +
  'ook nog al wel om tot zo heeft hebben had zal zou kan kunnen moet moeten wie wat waar hoe').split(' '));

function taalTelling(tekst) {
  let en = 0, nl = 0;
  for (const w of String(tekst).toLowerCase().match(/[a-z']+/g) || []) {
    if (ENGELSE_FUNCTIEWOORDEN.has(w)) en++;
    if (NEDERLANDSE_FUNCTIEWOORDEN.has(w)) nl++;
  }
  return { en, nl };
}

function isDenkstap(tekst) {
  if (!tekst) return false;
  if (DENKSTAP_PATRONEN.some(p => p.test(tekst))) return true;
  const { en, nl } = taalTelling(tekst);
  return en >= 8 && en > nl * 2;
}

// Denkblokken die een model netjes tussen tags zet, gaan eruit vóór elke keuring. Een niet
// afgesloten <think> aan het begin betekent dat het model in zijn overweging is afgekapt: dan is
// er geen antwoord, alleen denkwerk.
function verwijderDenkblokken(tekst) {
  if (tekst == null) return tekst;
  let s = String(tekst).replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, '');
  if (/^\s*<(think|thinking|reasoning)>/i.test(s)) s = '';
  return s.trim();
}

function isUitKarakter(tekst) {
  if (!tekst) return false;
  if (isDenkstap(tekst)) return true;
  if (isHoofdletterSpam(zonderKopregels(tekst))) return true;
  if (UIT_KARAKTER_PATRONEN.some(p => p.test(tekst))) return true;
  return VERZONNEN_TOEKENNING.some(p => p.test(tekst));
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
  VERZONNEN_TOEKENNING,
  RIJKSGRENS_PATRONEN,
  INJECTIE_AFWIJZINGEN,
  KARAKTER_FALLBACK,
  RIJKSGRENS_FALLBACK,
  DENKSTAP_PATRONEN,
  isUitKarakter,
  isDenkstap,
  verwijderDenkblokken,
  isRijksgrensOvertreding,
  willekeurigeInjectieAfwijzing,
  zonderKopregels,
};
