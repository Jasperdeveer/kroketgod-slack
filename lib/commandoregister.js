// ── Register van alle commando's ───────────────────────────────────────────────
// Eén bron voor `kroketprompts` én de commandomenu's in de App Home: een commando dat hier
// staat, verschijnt vanzelf in beide. Het sjabloon (`cmd`) bepaalt de formuliervelden in de
// Home (zie lib/homecommandos.js): [naam] = één medelid, [namen] = meerdere, a|b = keuze,
// (voor [x]) = optioneel, al het andere tussen [] = tekst. `(admin)` vooraan de uitleg = alleen
// zichtbaar voor de Opperkroket. Getallen die per gebruiker verschillen komen binnen als `ctx`.

function commandoRegister({ offerPerDag, vetbadMax, genadeKosten }) {
  return [
    { categorie: '📜 Schuld en krediet' },
    { cmd: 'wissel',                       uitleg: 'uw openstaande vetwissels — wie u wat schuldig is en omgekeerd' },
    { cmd: 'wissel [naam] [1-3]',          uitleg: 'leen een medelid punten tegen 1 punt rente, terug op vrijdag' },
    { cmd: 'los af',                       uitleg: 'betaal uw wissel terug vóór de vervaldag — levert +1 roem op' },
    { cmd: 'scheld kwijt [naam]',          uitleg: 'scheur de wissel doormidden: de schuld weg, +2 roem voor u' },
    { cmd: 'in [naam]',                    uitleg: 'na de vervaldag: haal de schuld bevoorrecht op (kerft, en geeft hem een weerwoord)' },

    { categorie: '🪵 Wrok, vete en vergiffenis' },
    { cmd: 'kerfstok',                     uitleg: 'wat er tussen u en de anderen openstaat: kerven, twisten, uw weerwoord' },
    { cmd: 'sus',                          uitleg: 'sticht vrede in de vete van het Rijk — 1 eigen punt, +2 roem (u mag geen partij zijn)' },
    { cmd: 'bede',                         uitleg: 'als drager van de Zwarte Korst: één bede bij wie u het zwaarst trof' },

    { categorie: '📜 Het Vetgeschrift — de Onderste Codex' },
    { cmd: 'vetgeschrift',                 uitleg: 'het gevonden boek: herkomst, de wet, en het vers van vandaag' },
    { cmd: 'vetgeschrift rangen',          uitleg: 'blad I — de acht treden en de Korsten die niet ophouden' },
    { cmd: 'vetgeschrift ambten',          uitleg: 'blad II — de vijf ambten en hun bevoegdheden' },
    { cmd: 'ambt',                         uitleg: 'welk ambt u draagt, hoeveel zegels u nog heeft en hoe u aanspraak opbouwt' },
    { cmd: 'ambtsboek',                    uitleg: 'elke ambtsdaad: wie, op wie, en wat — openbaar' },

    { categorie: '📊 De Hoge Frituurraad' },
    { cmd: 'ranglijst',                    uitleg: 'wie staat waar in de goddelijke hiërarchie' },
    { cmd: 'status',                       uitleg: 'de staat van het Rijk, plus uw eigen actieve zegeningen met resttijd en al uw cooldowns' },
    { cmd: 'dossier [naam]',               uitleg: 'het volledige kroket-archief van een volgeling' },
    { cmd: 'streaks',                      uitleg: 'wie verschijnt trouw op het heilige vrijdagmoment' },
    { cmd: 'stem [naam]',                  uitleg: 'wijs de Held van de Week aan — één stem, één keer' },
    { cmd: 'eer [namen] voor [reden]',     uitleg: 'betuig eer aan een of meer volgelingen — de Raad weegt uw reden (0–5 punten)' },
    { cmd: 'zondebok',                     uitleg: 'de Raad wijst iemand aan — wie dat is, weet u van tevoren niet' },
    { cmd: 'weekoverzicht',                uitleg: 'wat de Hoge Frituurraad deze week heeft bijgehouden' },

    { categorie: '⚖️ Recht & orde' },
    { cmd: 'gelekaart [naam] [reden]',     uitleg: 'een formele waarschuwing — de Raad onthoudt alles' },
    { cmd: 'begenade [naam]',              uitleg: `vraag gratie voor een balling — kost u zelf ${genadeKosten} kroketpunten, 1×/week` },
    { cmd: 'beroep [smoes]',               uitleg: 'vraag herziening van uw vonnis — de uitkomst is onbekend' },
    { cmd: 'uitbreken',                    uitleg: 'probeer het ballingschap te verlaten — risico\'s zijn voor eigen rekening' },
    { cmd: 'klacht [naam] [beschrijving]', uitleg: 'dien anoniem een aanklacht in — anonimiteit is niet gegarandeerd' },
    { cmd: 'meld [naam]',                  uitleg: 'meld een verdachte bij de Frituurraad' },
    { cmd: 'rechtbank [naam] vs [naam]',   uitleg: 'breng twee volgelingen voor de rechtbank — de Kroket God oordeelt' },

    { categorie: '⚔️ Allianties' },
    { cmd: 'alliantie [naam]',             uitleg: 'sluit een heilig verbond met een andere volgeling' },
    { cmd: 'alliantie verbreek',           uitleg: 'verbreek het verbond — dit wordt niet vergeten' },
    { cmd: 'alliantie overzicht',          uitleg: 'bekijk alle actieve verbonden in het Rijk' },

    { categorie: '🌍 Goddelijke kennis' },
    { cmd: 'weer',                         uitleg: 'de Kroket God raadpleegt de elementen' },
    { cmd: 'feitje',                       uitleg: 'een feit uit de archieven — herkomst varieert' },
    { cmd: 'mop',                          uitleg: 'de Frituurraad heeft humor. Soms.' },
    { cmd: 'quiz',                         uitleg: 'vier keuzes, één waarheid — bewijs uw snackwijsheid' },
    { cmd: 'advies',                       uitleg: 'goddelijk advies voor aardse problemen' },
    { cmd: 'bs',                           uitleg: 'een heilige openbaring in managementtaal' },
    { cmd: 'orakel [vraag]',               uitleg: 'stel een vraag — het antwoord is zelden direct' },
    { cmd: 'frituur [beschrijving]',       uitleg: 'de Kroket God visualiseert uw verzoek als genummerd visioen (1x/uur) — ook als 🔮-knop in de Home-tab' },
    { cmd: 'frituur portret van [naam]',   uitleg: 'een staatsieportret uit het échte dossier van dat lid: rang, kroon, titels, nemesis' },
    { cmd: 'galerij',                      uitleg: 'de galerij der visioenen — alle genummerde beelden tot nu toe' },

    { categorie: '🎰 Kansspel & macht' },
    // Aantal per dag uit offerLimiet(): dat hangt van de rang af, dus een vast getal hier zou
    // voor de helft van de leden gelogen zijn (en verouderen zodra de limiet wijzigt).
    { cmd: 'offer [aantal]',               uitleg: `offer kroketpunten aan het Grote Vetbad — fortuin of ondergang (max ${vetbadMax}, ${offerPerDag}×/dag)` },
    { cmd: 'troon',                        uitleg: 'aanschouw de huidige Frituurkoning en hoe lang hij heerst' },
    { cmd: 'troon uitdagen',               uitleg: 'bestrijd de koning om de troon — 3 punten inzet, 1×/dag' },

    { categorie: '🔮 Rituelen & mysteriën' },
    { cmd: 'hoelang',                      uitleg: 'hoever is het heilige vrijdagmoment nog' },
    { cmd: 'vrijdag',                      uitleg: 'de toestand van het heiligste moment van de week' },
    { cmd: 'slachtoffer',                  uitleg: 'de Raad kiest iemand — criteria zijn geheim' },
    { cmd: 'gebod [1-10]',                 uitleg: 'raadpleeg een van de Tien Geboden' },
    { cmd: 'biecht [zonde]',               uitleg: 'beken uw overtreding — openbaar of fluisterend' },
    { cmd: 'horoscoop [naam]',             uitleg: 'de sterren spreken over een volgeling' },
    { cmd: 'straf [naam]',                 uitleg: 'de Kroket God spreekt iemand aan' },
    { cmd: 'bekeer [naam]',                uitleg: 'breng een buitenstaander in contact met de snackleer' },
    { cmd: 'canoniseer [naam]',            uitleg: 'verhef een volgeling tot heilige van de frituur' },
    { cmd: 'geef [naam] een kroket-therapiesessie', uitleg: 'de Hoge Frituurraad analyseert een ziel' },
    { cmd: 'onthul de naam van mijn spirit-kroket', uitleg: 'ontdek welke kroket uw innerlijk vertegenwoordigt' },
    { cmd: 'complot',                      uitleg: 'de Raad heeft de berichten gelezen — conclusies volgen' },
    { cmd: 'missie',                       uitleg: 'uw lopende opdracht — als u die heeft' },
    { cmd: 'missie starten',               uitleg: '(admin) de Raad wijst een stille opdracht toe' },
    { cmd: 'rolwissel [naam] | [nieuwe rol]', uitleg: '(admin) een functie in het Rijk wisselt van hand' },
    { cmd: 'quiz starten',                 uitleg: '(admin) post een triviavraag — eerste juiste antwoord in de thread wint' },
    { cmd: 'quiz onthul',                  uitleg: '(admin) onthul het antwoord van de actieve quiz nu' },
    { cmd: 'kroket-van-de-dag',            uitleg: '(admin) het dagelijkse voorstel en de uitslag van gisteren' },
    { cmd: 'onthoud [tekst]',              uitleg: '(admin) schrijf iets in de rijksarchieven' },
    { cmd: 'vergeet [zoekterm]',           uitleg: '(admin) wis een gegeven uit de rijksarchieven' },
    { cmd: 'kennisbank',                   uitleg: '(admin) raadpleeg de rijksarchieven' },
  ];
}

module.exports = { commandoRegister };
