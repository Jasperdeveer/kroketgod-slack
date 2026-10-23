// ── Register van alle commando's ───────────────────────────────────────────────
// Eén bron voor `kroketprompts` én de commandomenu's in de App Home: een commando dat hier
// staat, verschijnt vanzelf in beide. Het sjabloon (`cmd`) bepaalt de formuliervelden in de
// Home (zie lib/homecommandos.js): [naam] = één medelid, [namen] = meerdere, a|b = keuze,
// (voor [x]) = optioneel, al het andere tussen [] = tekst. Getallen die per gebruiker
// verschillen komen binnen als `ctx`.
//
// ADMIN-COMMANDO'S krijgen `admin: true` en staan samen onder 🛠️ Beheer. De App Home toont ze
// alleen aan de beheerder; `kroketprompts` toont ze NOOIT, aan niemand (verzoek van de eigenaar).
// De oude markering — "(admin)" vooraan de uitleg — telt nog steeds mee, zodat een vergeten
// vlag niet meteen een lek is.

const { KOSTEN_NIEUW, KOSTEN_BESTAAND } = require('./gasten.js');

function commandoRegister({ offerPerDag, vetbadMax, genadeKosten }) {
  return [
    { categorie: '📊 De Hoge Frituurraad' },
    { cmd: 'ranglijst',                    uitleg: 'wie staat waar in de goddelijke hiërarchie' },
    { cmd: 'status',                       uitleg: 'de staat van het Rijk, plus uw eigen actieve zegeningen met resttijd en al uw cooldowns' },
    { cmd: 'dossier [naam]',               uitleg: 'het volledige kroket-archief van een volgeling' },
    { cmd: 'streaks',                      uitleg: 'wie verschijnt trouw op het heilige vrijdagmoment' },
    { cmd: 'weekoverzicht',                uitleg: 'wat de Hoge Frituurraad deze week heeft bijgehouden' },
    { cmd: 'stem [naam]',                  uitleg: 'wijs de Held van de Week aan — één stem, één keer' },
    { cmd: 'eer [namen] voor [reden]',     uitleg: 'betuig eer aan een of meer volgelingen — de Raad weegt uw reden (0–5 punten)' },
    { cmd: 'zondebok',                     uitleg: 'de Raad wijst iemand aan — wie dat is, weet u van tevoren niet (één keer per dag)' },

    { categorie: '🎰 Kansspel & macht' },
    // Aantal per dag uit offerLimiet(): dat hangt van de rang af, dus een vast getal hier zou
    // voor de helft van de leden gelogen zijn (en verouderen zodra de limiet wijzigt).
    { cmd: 'offer [aantal]',               uitleg: `offer kroketpunten aan het Grote Vetbad — fortuin of ondergang (max ${vetbadMax}, ${offerPerDag}×/dag)` },
    { cmd: 'troon',                        uitleg: 'aanschouw de huidige Frituurkoning en hoe lang hij heerst' },
    { cmd: 'troon uitdagen',               uitleg: 'bestrijd de koning om de troon — 3 punten inzet, 1×/dag' },

    { categorie: '💸 Schuld en krediet' },
    { cmd: 'wissel',                       uitleg: 'uw openstaande vetwissels — wie u wat schuldig is en omgekeerd' },
    { cmd: 'wissel [naam] [1-3]',          uitleg: 'bied een medelid punten te leen aan — hij moet zelf tekenen; op tijd terugbetalen is renteloos' },
    { cmd: 'los af',                       uitleg: 'betaal uw wissel terug vóór de vervaldag — levert +1 roem op' },
    { cmd: 'scheld kwijt [naam]',          uitleg: 'scheur de wissel doormidden: de schuld weg, +2 roem voor u' },
    { cmd: 'in [naam]',                    uitleg: 'na de vervaldag: haal de schuld bevoorrecht op (kerft, en geeft hem een weerwoord)' },
    { cmd: 'overval [naam]',               uitleg: 'na de vervaldag: ga de schuld zélf halen, met een greep bovenop — maar het kan mislukken' },

    { categorie: '🪵 Wrok, vete en vergiffenis' },
    { cmd: 'kerfstok',                     uitleg: 'wat er tussen u en de anderen openstaat: kerven, twisten, uw weerwoord' },
    { cmd: 'sus',                          uitleg: 'sticht vrede in de vete van het Rijk — 1 eigen punt, +2 roem (u mag geen partij zijn)' },
    { cmd: 'bede',                         uitleg: 'als drager van de Zwarte Korst: één bede bij wie u het zwaarst trof' },

    { categorie: '⚔️ Allianties' },
    { cmd: 'alliantie [naam]',             uitleg: 'sluit een heilig verbond — zit die volgeling al in een verbond van twee, dan vraagt u aan te sluiten (hoogstens 3 leden)' },
    { cmd: 'alliantie verbreek',           uitleg: 'verbreek het verbond — dit wordt niet vergeten' },
    { cmd: 'alliantie overzicht',          uitleg: 'bekijk alle actieve verbonden in het Rijk' },

    { categorie: '⚖️ Recht & orde' },
    { cmd: 'gelekaart [naam] [reden]',     uitleg: 'een uur geschorst, en de tweede in één week is rood: een dag — de Raad stemt' },
    { cmd: 'klacht [naam] [beschrijving]', uitleg: 'dien anoniem een aanklacht in — anonimiteit is niet gegarandeerd' },
    { cmd: 'meld [naam]',                  uitleg: 'meld een verdachte bij de Frituurraad' },
    { cmd: 'rechtbank [naam] vs [naam]',   uitleg: 'breng twee volgelingen voor de rechtbank — de Kroket God oordeelt' },
    { cmd: 'begenade [naam]',              uitleg: `vraag gratie voor een balling — kost u zelf ${genadeKosten} kroketpunten, 1×/week` },
    { cmd: 'beroep [smoes]',               uitleg: 'vraag herziening van uw vonnis — de uitkomst is onbekend' },
    { cmd: 'uitbreken',                    uitleg: 'probeer het ballingschap te verlaten — risico\'s zijn voor eigen rekening' },

    { categorie: '🌍 Goddelijke kennis' },
    { cmd: 'orakel [vraag]',               uitleg: 'stel een vraag — het antwoord is zelden direct' },
    { cmd: 'advies',                       uitleg: 'goddelijk advies voor aardse problemen' },
    { cmd: 'weer',                         uitleg: 'de Kroket God raadpleegt de elementen' },
    { cmd: 'feitje',                       uitleg: 'een feit uit de archieven — herkomst varieert' },
    { cmd: 'quiz',                         uitleg: 'vier keuzes, één waarheid — bewijs uw snackwijsheid' },
    { cmd: 'mop',                          uitleg: 'de Frituurraad heeft humor. Soms.' },
    { cmd: 'bs',                           uitleg: 'een heilige openbaring in managementtaal' },
    { cmd: 'frituur [beschrijving]',       uitleg: 'de Kroket God visualiseert uw verzoek als genummerd visioen (1x/uur) — ook als 🔮-knop in de Home-tab' },
    { cmd: 'frituur portret van [naam]',   uitleg: 'een staatsieportret uit het échte dossier van dat lid: rang, kroon, titels, nemesis' },
    { cmd: 'galerij',                      uitleg: 'de galerij der visioenen — alle genummerde beelden tot nu toe' },

    { categorie: '🔮 Rituelen & mysteriën' },
    { cmd: 'hoelang',                      uitleg: 'hoever is het heilige vrijdagmoment nog' },
    { cmd: 'vrijdag',                      uitleg: 'de toestand van het heiligste moment van de week' },
    { cmd: 'gebod [1-10]',                 uitleg: 'raadpleeg een van de Tien Geboden' },
    { cmd: 'biecht [zonde]',               uitleg: 'beken uw overtreding — openbaar of fluisterend' },
    { cmd: 'missie',                       uitleg: 'uw lopende opdracht — als u die heeft' },
    { cmd: 'complot',                      uitleg: 'de Raad heeft de berichten gelezen — conclusies volgen' },
    { cmd: 'slachtoffer',                  uitleg: 'de Raad kiest iemand — criteria zijn geheim' },
    { cmd: 'horoscoop [naam]',             uitleg: 'de sterren spreken over een volgeling' },
    { cmd: 'straf [naam]',                 uitleg: 'de Kroket God spreekt iemand aan' },
    { cmd: 'bekeer [naam]',                uitleg: 'breng een buitenstaander in contact met de snackleer' },
    { cmd: 'canoniseer [naam]',            uitleg: 'verhef een volgeling tot heilige van de frituur' },
    { cmd: 'geef [naam] een kroket-therapiesessie', uitleg: 'de Hoge Frituurraad analyseert een ziel' },
    { cmd: 'onthul de naam van mijn spirit-kroket', uitleg: 'ontdek welke kroket uw innerlijk vertegenwoordigt' },

    { categorie: '🚪 Gasten' },
    { cmd: 'invite',                       uitleg: `nodig een nieuwe gast uit in het kanaal — u beschrijft hem, de Raad schrijft zijn karakter (${KOSTEN_NIEUW} punten)` },
    { cmd: 'invite bekend',                uitleg: `haal een bekende gast terug, zoals Benito of de Heilige Satébal (${KOSTEN_BESTAAND} punten)` },

    { categorie: '📜 Het Vetgeschrift — de Onderste Codex' },
    { cmd: 'vetgeschrift',                 uitleg: 'het gevonden boek: herkomst, de wet, en het vers van vandaag' },
    { cmd: 'vetgeschrift rangen',          uitleg: 'blad I — de acht treden en de Korsten die niet ophouden' },
    { cmd: 'vetgeschrift ambten',          uitleg: 'blad II — de vijf ambten en hun bevoegdheden' },
    { cmd: 'ambt',                         uitleg: 'welk ambt u draagt, hoeveel zegels u nog heeft en hoe u aanspraak opbouwt' },
    { cmd: 'ambtsboek',                    uitleg: 'elke ambtsdaad: wie, op wie, en wat — openbaar' },

    { categorie: '🛠️ Beheer' },
    { cmd: 'missie starten',               uitleg: 'de Raad wijst een stille opdracht toe', admin: true },
    { cmd: 'rolwissel [naam] | [nieuwe rol]', uitleg: 'een functie in het Rijk wisselt van hand', admin: true },
    { cmd: 'quiz starten',                 uitleg: 'post een triviavraag — eerste juiste antwoord in de thread wint', admin: true },
    { cmd: 'quiz onthul',                  uitleg: 'onthul het antwoord van de actieve quiz nu', admin: true },
    { cmd: 'kroket-van-de-dag',            uitleg: 'het dagelijkse voorstel en de uitslag van gisteren', admin: true },
    { cmd: 'uitlichten [functie]',         uitleg: 'de Kroket God kondigt een nieuwe functie aan, met uitleg en knoppen (bv. gasten)', admin: true },
    { cmd: 'onthoud [tekst]',              uitleg: 'schrijf iets in de rijksarchieven', admin: true },
    { cmd: 'vergeet [zoekterm]',           uitleg: 'wis een gegeven uit de rijksarchieven', admin: true },
    { cmd: 'kennisbank',                   uitleg: 'raadpleeg de rijksarchieven', admin: true },
  ];
}

function isAdminCommando(item) {
  return item?.admin === true || /^\(admin\)/i.test(item?.uitleg || '');
}

// De kroketprompts: het register als overzicht voor ieder lid, één blok per categorie.
// Admin-commando's staan er NOOIT in, ook niet voor de beheerder, en evenmin een regel waarin
// een geheim staat (`geheim`: de code van het Gefluisterde Voorrecht) — ook niet als iemand hem
// per ongeluk in het register zet. Een categorie die daardoor leeg is, verdwijnt.
function promptOverzicht(register, { geheim = [] } = {}) {
  const geheimen = geheim.map(g => String(g || '').trim().toLowerCase()).filter(Boolean);
  const bevatGeheim = (...teksten) => teksten.some(t => geheimen.some(g => String(t || '').toLowerCase().includes(g)));
  const groepen = [];
  for (const item of register) {
    if (item.categorie) { groepen.push({ categorie: item.categorie, regels: [] }); continue; }
    if (!groepen.length || isAdminCommando(item) || bevatGeheim(item.cmd, item.uitleg)) continue;
    groepen[groepen.length - 1].regels.push(`\`${item.cmd}\`${item.uitleg ? ` — ${item.uitleg}` : ''}`);
  }
  return [
    { type: 'header', text: { type: 'plain_text', text: '🕵️ Alle kroketprompts', emoji: true } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Typ ze achter `/kroketgod`. Wat tussen [haken] staat, vult u zelf in.' }] },
    ...groepen.filter(g => g.regels.length && !bevatGeheim(g.categorie)).map(g => ({
      type: 'section', text: { type: 'mrkdwn', text: `*${g.categorie}*\n${g.regels.join('\n')}` },
    })),
  ];
}

module.exports = { commandoRegister, isAdminCommando, promptOverzicht };
