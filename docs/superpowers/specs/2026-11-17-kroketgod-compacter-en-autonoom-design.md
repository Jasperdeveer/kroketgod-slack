# De Kroket God compacter en zelfstandiger

17 november 2026. Wens van de eigenaar: de bot compacter maken; weinig gebruikte spelfuncties terug in het spel brengen in plaats van ze te schrappen; de losse tekstcommando's inkrimpen en leuker maken; en de Kroket God zelf laten handelen, zodat de eigenaar minder hoeft te regelen. "Wees hier creatief in en zorg dat er meer dingen kunnen gebeuren dan dat hij alleen maar reactief is."

## Waar dit op rust

- Gebruik op de server, uit `statistiekhistorie.json`: gebeurtenissen per type sinds 8 juni, slash-commando's sinds 2 november. Daarnaast de laatste schrijfdatum van elk statebestand.
- Een inventaris van de code per functie: regels, vaste momenten, ingangen en wat er van afhangt. Regelnummers hieronder slaan op `index.js` in de werkmap van 17 november.
- De grens die de eigenaar koos: minder dan één keer per week, dus minder dan 4 keer in 30 dagen, telt als weinig gebruikt.
- De graphify-graaf (1.884 knopen, 74 groepen) laat zien dat bijna elke module in `lib/` alleen aan `index.js` hangt. Los hangen zegt hier dus weinig; het gebruik is de maat.

Gebruik in de laatste 30 dagen (19 oktober tot 17 november):

| Veel gebruikt | 30 d | Weinig gebruikt | 30 d |
|---|---|---|---|
| Opdrachten | 156 | Gele kaart | 10 |
| Offer | 145 | Verhoor, genade | 8 elk |
| Winkel | 114 | Lofzang, Gouden Kroket, belediging | 5 elk |
| Duel | 89 | Beurs, premiejacht | 4 elk |
| Weekvijand | 70 | Seizoen | 3 |
| Troon | 60 | Bedelarij | 2 |
| Eer, kroketgok | 48 elk | Allianties | 1 |
| Casino | 38 (84 commando's sinds 2 nov) | Vetwissel, profetie, tribunaal, verbanning, klacht, zegen, zelflof | 0 |

Losse tekstcommando's sinds 2 november: `horoscoop` 1 keer; `orakel`, `bs`, `mop`, `biecht`, `canoniseer` en `slachtoffer` geen enkele keer.

De wroklaag (twist, handdruk, Vetpapier, Zwarte Korst, vete, Dubbele Korst) zit ook onder de grens, maar de eigenaar heeft die eerder bewust beschermd. Die blijft buiten dit plan.

## Vier sporen

1. Opruimen: klein en veilig, en daarna is er minder code om in te werken.
2. De regisseur: een motor waarmee de Kroket God zelf ingrijpt.
3. Terugbrengen in het spel: dagopdrachten en bingovakjes, en ingrepen van de regisseur.
4. Tekstcommando's: minder commando's, maar elk met een gevolg in het spel.

Spoor 3 bouwt op spoor 2: wat de Kroket God "uitlokt", is een ingreep van de regisseur. Elk spoor krijgt een eigen uitgewerkt bouwplan met tests en wordt los gedeployd.

## Spoor 1: opruimen

### 1a. De ronde van 2 november afmaken

Op 2 november zijn tijdcapsule, rechtbank en jurisprudentie, Held van de Week, de WK-standen, het voordragen van huisonderwerpen, vier dode functies en `start.command` weggehaald: 1.588 regels, waarvan 813 in `index.js`. Dat werk is nooit gecommit. Het staat als losse wijzigingen in de werkmap, en de server draait die functies dus nog. Stappen: de wijzigingen nalopen tegen de huidige code, de tests draaien, committen en deployen. Er zijn nog drie restjes van die ronde over: 'rechtbank' en 'stem' in `KORTAF_UITGESLOTEN` (`:1998`), de suggestie 'rechtbank [naam1] vs [naam2]' (`:6221`) en een los commentaar op `:8160`.

### 1b. Nog weg (keuze eigenaar)

| Functie | Gebruik | Omvang | Vaste momenten | Risico | Advies |
|---|---|---|---|---|---|
| Vetwissel | 16 keer op de lanceerdag (16 okt), daarna 0 | ~1.250 regels (`index.js` ~565, `lib/vetwissel.js` 284, test 397) | 2: do/vr 9:15 aanmaning, werkdagen 11:05 vervallen schulden | laag | weg |
| Profetie | 0 in 30 dagen, laatst 13 oktober | ~40 regels | 1: di/do 13:00 (35% kans), plus de beoordeling in het weekoverzicht | laag | weg |
| Beurs | 4 in 30 dagen, 0 in de laatste 14 | ~930 regels (`index.js` ~470, `lib/beurs.js` 198, test 259) | geen eigen; de afrekening zit in de weekreset | middel | weg |
| Ambten en de Openbaring | nooit gestart | ~2.000 regels (`index.js` ~1.330, `lib/ambten.js` 275, test 387) | 4, die allemaal niets doen zolang de ambten niet gesticht zijn | middel | weg, maar zie hieronder |
| Dode code | nergens aangeroepen | ~20 losse functies, imports en constanten | geen | laag | weg |

Wat er meegaat bij het weghalen:
- **Vetwissel:**
  - `lib/paarboek.js` en zijn test verwachten de sleutel `wissel_geind`.
  - Een Verbondsknop en Dubbel of niks gebruiken `meldKnopTerug`. Die blijft staan.
  - `/kroketgod in …` vangt nu alle tekst die met "in " begint als inning. Na het weghalen gaat die tekst gewoon naar de Kroket God.
- **Profetie:** alleen de profetieën (`profetie.json`). De profeet blijft, omdat `zegen` in spoor 3 terugkomt.
- **Beurs:**
  - de weekopdracht "Koop twee aandelen" (`w-beurs`);
  - de Boekenzegel van de Rekenmeester;
  - de afrekening in de weekreset;
  - een daad in `SOLO_DADEN` van de Dubbele Korst. Dat is één regel in de beschermde wroklaag; alleen die regel gaat eruit.
- **Ambten.** Dit is de grootste en de enige met een echte keuze. Het extra zegel en de zegelkorting zijn het enige voorrecht van de rangen Korsten, Kroon, Paneerknecht en Aspirant, en deels van Meester der Ragout. Het hoofdeffect van het winkelitem Gouden Korst is immuniteit voor een ambtsdaad. Zonder ambten moeten die rangen en de Gouden Korst een nieuw voorrecht krijgen. Voorstel: rangen krijgen een extra dagactie (een extra offer of duel), en de Gouden Korst beschermt voortaan tegen een gele kaart.

### 1c. Oude statebestanden op de server

Met akkoord en na een back-up weg:
- `kroniek.ndjson` (1,6 MB). Geen code verwijst ernaar; het is sinds augustus vervangen door het Grote Archief.
- `stemmen.json`, van de Held van de Week.
- De bestanden die 1a en 1b overbodig maken: `wissels.json`, `wisselroem.json`, `profetie.json`, `beurs.json`, `ambten.json`, `ambtsboek.json`, `venstertellers.json` en `openbaring.json`.

Elke functie die weggaat, moet ook uit `BACKUP_BASIS` (`lib/backup.js`). Anders waarschuwt de bot bij elke opstart dat een bestand niet in de back-up zit.

Blijven staan:
- **Wereldbord.** `wereldbord.json` lijkt dood (laatst geschreven op 10 augustus), maar het bestand verandert alleen als er een nieuw bord gepost wordt. Het bord zelf wordt elk halfuur bijgewerkt.
- **De bestanden van functies die terugkomen:** `missie.json`, `verdacht.json`, `tribunaal.json` en `allianties.json`.

## Spoor 2: de regisseur

Een motor die de Kroket God laat ingrijpen zonder dat iemand iets typt. De regels staan in een nieuwe, pure module `lib/regie.js` met tests; `index.js` levert de stand aan en voert de gekozen ingreep uit.

### Hoe hij besluit

Elke 20 minuten op werkdagen tussen 8:30 en 17:30 kijkt hij naar de stand van het Rijk:

- wie er vandaag iets deed en wie al dagen stil is. Daarvoor bestaat de activiteitsregistratie al: `activiteit.json`, `isAfwezig`;
- de koploper en de hekkensluiter;
- het casino van vandaag: aantal spellen, de grootste winst en het grootste verlies, en wie er een gokpauze heeft;
- de weekvijand: HP, de dag van de week en hoeveel leden meevochten;
- openstaande gele kaarten, ballingen en lopende missies;
- het seizoen en zijn stemming van de dag;
- wat hij zelf vandaag al deed.

Elke ingreep in het regieboek is één regel data:
- een voorwaarde op de stand;
- een gewicht;
- een afkoeltijd en een maximum per dag of per week;
- een doelwit (iedereen of één lid);
- het effect, in code;
- een schrijfopdracht voor de tekst.

Per ronde is er een kans dat hij iets doet, afhankelijk van het niveau. Doet hij iets, dan loot hij gewogen uit de ingrepen waarvan de voorwaarde klopt. De tekst schrijft hij zelf, in de stem van de dag. Het effect zelf ligt vast in code, met harde grenzen.

### Het regieboek, eerste versie

Het casino:
- **Het Huis geeft.** Iedereen krijgt vandaag 3 extra spellen. Dit gebruikt het bestaande `casinobonus.json` en `voerCasinoBeheerUit`. Voorwaarde: het casino bleef tot de middag stil.
- **De hoge tafel.** Een uur lang mag de inzet twee keer zo hoog. Voorwaarde: iemand won drie keer op rij, of er werd vandaag al flink gespeeld. Nieuw: een tijdelijk effect met een eindtijd, dat `casinoMax()` leest.
- **Het casino gaat dicht.** Twee tot drie uur gesloten, want "de frituur wordt gereinigd". Het casinovenster laat zien tot hoe laat. Voorwaarde: er werd vandaag al veel gespeeld, of iemand verloor groot. Nieuw: een sluitingseffect naast de instelling `casinoAan`.
- **Het gouden uur.** Een uur lang betaalt één spel anderhalf keer uit, met een plafond per spel.
- **Een persoonlijke uitnodiging.** Een stil lid krijgt één gratis spel.
- **Roddel aan de bar.** De vaste casinoroddel van dinsdag 16:30 wordt een ingreep die komt als er iets te roddelen valt.

Toespraken:
- Hij spreekt een lid aan dat drie werkdagen niets zei. Er komt een knop bij: wie binnen een uur antwoordt, krijgt een kleine zegen.
- Hij spreekt de koploper toe en daagt die uit tot een duel met de hekkensluiter. Wint de hekkensluiter, dan krijgt die een bonus.
- Hij prijst wie net iets bijzonders deed: een genadeslag, een reeks gewonnen duels of een grote winst in het casino.
- Hij preekt op een bijzonder moment: maandag na de weekreset, of vrijdag vlak voor twaalf uur.

Gerechtigheid (dit brengt functies uit spoor 3 terug):
- **Een gele kaart voor ketterij.** De bestaande herkenning van ketterij (ketchup op een kroket, de airfryer) laat hem zelf een voordracht doen. De Raad stemt daarover zoals nu.
- **Het tribunaal.** Hij roept het bijeen over een ketter of een lid met twee kaarten, met een vonnis dat een straf of een titel is en nooit een kick (zie spoor 3).
- **Een premie op de koploper.** De premiejacht van woensdag 11:00 (nu 50% kans) wordt een ingreep met een doelwit dat past.
- **Een Stille Missie.** Hij geeft een willekeurig lid een geheime missie. Nu kan alleen de beheerder dat.
- **Een verbondsdag.** Wie vandaag een verbond sluit, krijgt de Verbondszegen dubbel.
- **Een zegendag of een klachtenuur.** Zegenen of klagen levert vandaag iets op.
- **Een vrijgevige bui.** Een uur lang levert bedelen iets op in plaats van straf.
- **Genade.** Hij heft een verbanning eerder op als de balling berouw toont.

De weekvijand:
- **Een extra aanvalsdag**, zoals vandaag met de hand (`raid.extraAanval`). Voorwaarde: het is donderdag, de vijand staat nog ruim boven de helft en er werd weinig gevochten.
- **Aanmoediging.** Hij noemt wie de vijand deze week nog niet aanviel en zet een kleine beloning op hun eerste klap.

Het seizoen:
- **Seizoensdagen.** Een dag met een thema uit het lopende seizoen, bijvoorbeeld een Vetdag waarop offers dubbel tellen.

### Grenzen

- **Niveau in het dashboard:** uit, laag (hoogstens 2 ingrepen per dag), normaal (4) of wild (7). Standaard: normaal.
- **Wanneer:** alleen op werkdagen van 8:30 tot 17:30. Hij houdt zich aan stille modus, weekendrust en alleen-testkanaal.
- **Tempo:**
  - minstens 45 minuten tussen twee ingrepen;
  - geen lid twee keer per dag als doelwit;
  - elke soort ingreep heeft een eigen afkoeltijd.
- **Punten:** hij geeft per dag hoogstens 15 punten weg en pakt geen punten af buiten de bestaande regels. Gele en rode kaarten blijven via de Raad lopen.
- **Zicht en ingrijpen:** elke ingreep komt in het auditlog en op een nieuwe dashboardkaart, "Wat de Kroket God vandaag deed". Een lopend effect, zoals het casino dicht of de hoge tafel, kun je daar met één knop beëindigen.
- **Zonder taalmodel:** lukt de tekst niet, dan gebruikt hij een vaste zin. Een ingreep met effect gebeurt nooit zonder aankondiging.

### Compacter door de regisseur

De bot heeft 64 geplande taken. Een deel ervan zijn vaste berichten met een kans, en die passen beter als ingreep die de regisseur kiest wanneer het past. Daarmee verdwijnen een cron en een eigen stuk timingcode per bericht:
- de premiejacht: woensdag 11:00, 50% kans;
- de casinoroddel: dinsdag 16:30;
- de spontane post: dinsdag en donderdag 10:00 en 14:00, met een kans;
- het kroketfeitje: werkdagen 7:30, 60% kans;
- de Verbondszegen. Dat is geen cron, maar een post bij 80% van alle puntentoekenningen. Hij werd 378 keer gepost, terwijl er 7 verbonden gesloten werden. Wordt de zegen een regel in de draad, dan blijft alleen de bonus over.

Blijft vast: alles wat op een vast moment hoort, zoals de weekvijand, de veiling, de weekreset, het zakgeld, de back-up en de wroklaag.

## Spoor 3: terugbrengen in het spel

Twee middelen per functie: een regel in de opdrachtenmotor (`OPDRACHTEN` in `index.js`; een nieuwe opdracht is één regel data plus een `telActie` waar de actie gebeurt) of een bingovakje, en een ingreep van de regisseur. Elke opdracht en elke ingreep heeft een knop, dus ze worden vanzelf zichtbaar.

| Functie | Hoe het nu werkt | Opdracht of bingovakje | De regisseur |
|---|---|---|---|
| Gele kaart | een lid draagt voor, de Raad stemt 5 minuten met emoji; de tweede in een week wordt rood en betekent een schorsing | week: "Stem mee in de Raad over een gele kaart" | ketterij leidt tot een voordracht |
| Verbanning | de enige straf van het spel: na vergrijpen 4 uur, na een belediging 1 tot 2 dagen, na een rode kaart een schorsing; uitwegen zijn `begenade`, `beroep` en `uitbreken` | week: "Help een balling terug" (`begenade`) | genade bij berouw; een balling die uitbreekt, wordt een premie waard |
| Klacht | `klacht` geeft alleen een tekst | week: "Dien een klacht in bij de Raad" | klachtenuur: een klacht levert die ochtend een onderzoek (Verhoor) of een gele-kaartvoordracht op |
| Zegen | `zegen [naam]` is de Profetenzegen; alleen de weekkampioen, de profeet, mag zegenen | dag: "Laat u zegenen door de profeet" | zegendag: vandaag mag iedereen één keer zegenen |
| Zelflof | geen commando, maar een straf binnen `eer` voor wie zichzelf probeert te eren; het is ook de enige rem die voorkomt dat iemand zichzelf punten geeft | bingovakje: "Overleef een poging tot zelflof" | hij grijpt een zelflof aan voor een publieke berisping |
| Tribunaal | de klok om 10:40 por inactieve leden; de stemming kan iemand uit het kanaal zetten | week: "Stem in een tribunaal" | roept het bijeen over een ketter of een lid met twee kaarten, met een lichte uitspraak: een straf of een titel, nooit een kick |
| Allianties en Verbondszegen | een verbond tussen twee leden geeft bonussen, maar ook verplichtingen bij straf en duel | week: "Sluit een verbond" | verbondsdag; de zegen alleen nog als regel in de draad |
| Bedelarij | wie bij een mention om punten bedelt, krijgt straf | bingovakje: "Bedel tijdens een vrijgevige bui" | de vrijgevige bui (zie spoor 2) |
| Seizoen | een groot systeem met fases op maandag, een campagne, dreiging, nalatenschap in de winkelprijzen en het kanaalonderwerp | opdrachten met het thema van het seizoen | seizoensdagen |
| Premiejacht | woensdag 11:00, met 50% kans een premie op iemand; je int hem met een duel | week: "Claim een premie" | zet premies uit wanneer het past; de vaste cron vervalt |
| Stille Missie | alleen de beheerder kan een missie starten; de missie wordt herkend in berichten en reacties | week: "Voltooi een stille missie" | deelt missies uit, zonder beheerder |

De pool groeit van 17 naar ongeveer 28 opdrachten. Per dag blijven het er 3 en per week 2, dus de nieuwe komen in de wisseling mee zonder dat het drukker wordt.

Aandachtspunten:
- **Het tribunaal kan iemand uit het kanaal zetten.** Dat mag alleen zo blijven voor echt inactieve leden. Een tribunaal van de regisseur krijgt een eigen, lichte uitspraak.
- **Zelflof blijft als rem.** Weghalen kan alleen met een filter in `voerEer` die de gever uit de ontvangers haalt.
- **Allianties en verbanning zitten in de puntenstroom en in straffen.** Daar verandert alleen de zichtbaarheid; aan de mechaniek wordt niet gesleuteld.

## Spoor 4: tekstcommando's, minder en leuker

Wat er nu is: `orakel`, `horoscoop`, `bs`, `mop`, `biecht`, `canoniseer` en `slachtoffer` (samen sinds 2 november één keer gebruikt). Daarnaast tonen ook deze alleen tekst:
- `gebod`, `bekeer`, `hoelang`, `vrijdag`, `weer` en `feitje`;
- `quiz`, een algemene quiz via OpenTDB, niet de Kroket Quiz;
- `complot` en `meld`;
- de tabel `VERKONDIGINGEN`: quote, nieuws, grondwet, advies, rap, debat, therapie, spirit-kroket en meer.

Voorstel: één commando, `raadpleeg`, met een knop "Raadpleeg de Kroket God" in de App Home. Je kiest een ritueel, en elk ritueel heeft een klein gevolg in het spel:
- **Horoscoop:** één keer per dag. Geeft geluk of pech voor één spel vandaag, bijvoorbeeld +1 of −1 in je volgende duel.
- **Biecht:** je biecht een kroketzonde op. Hij spreekt je vrij of geeft je een boetedoening, die als mini-opdracht meetelt.
- **Orakel:** een antwoord plus een voorspelling die de bot later controleert, zoals "vandaag wint Kroquinty een duel". Komt die uit, dan krijgt de vrager 1 punt.
- **Canoniseer:** je draagt een lid voor als heilige van de dag. Anderen bevestigen met een emoji, en de heilige draagt die dag een titel.

De rest gaat uit het menu. Alle oude woorden blijven werken als vrije vraag aan de Kroket God, dus niemand krijgt een foutmelding. Twee dingen moeten mee:
- de bingopool, waarin vakjes staan voor orakel, biecht en horoscoop;
- de suggestielijst in `prompts`.

`stuurMop` en `stuurKroketFeitje` blijven bestaan voor de spontane posts.

## Volgorde en omvang

| Spoor | Wat | Omvang | Eigen deploy |
|---|---|---|---|
| 1 | de ronde van 2 november afmaken, plus 1b, 1c en de dode code | klein tot middel (Ambten is het grootste stuk) | ja |
| 2 | regiemotor, dashboardkaart en de eerste ingrepen (casino en toespraken) | groot | ja |
| 3 | opdrachten en bingovakjes, en de ingrepen voor gerechtigheid, weekvijand en seizoen | middel | in twee delen |
| 4 | `raadpleeg` met vier rituelen | middel | ja |

## Nog te kiezen door de eigenaar

- 1b: Vetwissel, Profetie en Beurs weg? Advies: ja.
- 1b: Ambten weg, met een nieuw voorrecht voor de rangen (een extra dagactie) en voor de Gouden Korst (bescherming tegen een gele kaart)? Advies: ja.
- 1c: de oude statebestanden van de server weg? Advies: ja, na een back-up.
- Het standaardniveau van de regisseur. Voorstel: normaal, 4 ingrepen per werkdag.
- Mag de regisseur zelf gele kaarten voordragen en een licht tribunaal bijeenroepen? Voorstel: ja, en de Raad blijft stemmen.
