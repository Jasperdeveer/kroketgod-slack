# Herindeling van de App Home en het dashboard

17 november 2026, na de livegang van Kroket God 5.0.

## Waarom

De eigenaar wil "het dashboard en de Home helemaal opnieuw indelen, met de belangrijkste dingen prominent in beeld en de rest mooi verwerkt in slimme menu's". Na V5.0 is er meer te zien en te doen dan ooit, en beide schermen zijn gegroeid door alleen maar dingen toe te voegen.

Wat er nu mis is (inventaris van 17 nov):
- **Home.** Wat een lid dagelijks nodig heeft, staat in drie losse lijsten ("Nu te doen", de actierij, de opdrachten). De opdrachten staan zelfs onder de Zegezaal, en de weekvijand is het elfde blok. Wat de Kroket God vandaag deed, zien leden nergens. De Home zit dicht tegen Slacks grens van 100 blokken, en `kapHomeBlocks` knipt van onderen, dus precies de opdrachten vallen het eerst weg.
- **Dashboard.** De regisseurkaart staat onder zeven grafieken. Alle bediening (weekvijand oproepen, veiling, tribunaal, verkondigen, amnestie) zit in één reuzenkaart Instellingen. Drie activiteitsgrafieken tonen hetzelfde. Niets zegt wat er nu loopt.

## Doelen

- Een lid ziet in één blik: wie hij is, wat er vandaag gebeurt, wat hij nu kan doen, en hoe het met de weekvijand staat.
- De eigenaar ziet in één blik wat er nu loopt, en kan daar meteen ingrijpen.
- Alles wat er nu is, blijft bereikbaar: niets verdwijnt, het verhuist naar een menu of een venster achter een knop.
- De Home blijft ruim onder de 100 blokken, ook op een volle dag.

## Niet-doelen

- Nieuwe spelfuncties. Dit is alleen indeling.
- Een lichte modus voor het dashboard.
- Andere teksten in de vensters dan nodig om ze los te laten staan.

## Anti-doelen

- Een knop of kaart die nu werkt en daarna niet meer te vinden is.
- Een actie met een deadline (stemmen in een tribunaal of gele kaart, een open claim op de bladzijde, een gast vasthouden, bieden op de veiling) die in een menu verdwijnt. Wat nu iets van een lid vraagt, blijft op de Home.

## Aanpakken

1. **Gekozen: een nieuwe bovenkant plus menu's die vensters openen.** De Home krijgt vier vaste blokken bovenaan. Alles wat informatief is, verhuist naar vensters achter een handvol menu's. Het bestaande naslagmechanisme (`NASLAG`, `bouwNaslagVenster`, `naslag_*`) doet dat al en wordt de basis. Het dashboard krijgt een strook "Nu bezig" en een tabindeling met een submenu per tab.
2. Afgevallen: alleen de volgorde omgooien. Dat lost de blokgrens niet op en laat de drie losse lijsten staan.
3. Afgevallen: een tweede Home-tab of een apart "spelbord"-bericht. Slack kent maar één Home per app, en een kanaalbericht is niet persoonlijk.

## Ontwerp: de App Home

Van boven naar onder:
1. **Kop:** naam, rang, punten, plaats (`#3 van 9`) en de voortgang naar de volgende rang. Het bestaande blok "wie u bent", ingekort tot één section plus een context.
2. **Melding** van een zojuist ingedrukte knop (zoals nu, 60 seconden), met eventuele `extraBlocks`.
3. **Perkament** voor de uitverkorene van vandaag (zoals nu; het is een actie voor die ene persoon).
4. **VANDAAG:** wat de Kroket God vandaag deed en wat er nu loopt, in hoogstens vier regels:
   - de lopende effecten met eindtijd (casino dicht tot 15:00, hoge tafel, duelverbod, inflatie, zegendag…);
   - een lopende verrassing (Hete Kroket bij wie, raadsel, puntenregen…) of zaak (licht tribunaal);
   - de laatste ingreep van vandaag in één regel;
   - de heilige van de dag.

   Zonder iets: één regel "De Kroket God houdt zich vandaag nog stil."
5. **UW BEURT:** alles wat het lid nu kan doen, samengevoegd:
   - de opdrachten van vandaag en deze week, compact met voortgang (één regel per opdracht);
   - één regel met wat op is ("Op: duel, roof");
   - de actieknoppen, in één actions-blok: raadpleeg, duel, offer, eer, casino, gunst, visioen, bingo, gok (dezelfde voorwaarden als nu);
   - **acties met een deadline**, elk als één regel met knop: een open stemming (tribunaal, licht tribunaal, gele kaart), een open claim op de bladzijde, gasten om vast te houden, de veiling, de uitdaging van de koploper, de Hete Kroket als je hem vasthoudt.
6. **WEEKVIJAND** (alleen als er een is): naam, HP-balk, eigen schade, aanvallen over vandaag, en de knoppen aanval en offer.
7. **MENU'S:** één actions-blok met vijf `static_select`'s. Elke optie opent een venster (modal):
   - **Spellen:** casino (stand, bonus, loterij), veiling, bingo, kroket van de dag, gasten van vandaag, Aflatenhandel;
   - **Recht & Raad:** de bladzijde, wat er tussen u en de anderen staat (wrok), tribunaal, premie, verbonden;
   - **Mijn status:** actief op u (titels, power-ups, horoscoop, voorspelling), sinds uw laatste bezoek, voorrechten, relikwieën, titels;
   - **Het Rijk:** ranglijst, seizoen, Zegezaal, galerij, weefsel;
   - **Alle commando's:** de bestaande commandomenu's, per categorie, in één venster.
8. **Voet:** verversknop en voetnoot (versie, reset, tijdstip).

`kapHomeBlocks` blijft als vangnet, maar knipt voortaan van de menu's en niet van de bovenkant. De vaste bovenkant (1 tot 6) gaat altijd voor.

Verbannen leden zien de kop, de verbannen-melding, VANDAAG en de menu's (alleen lezen), zoals nu zonder actieknoppen.

## Ontwerp: het dashboard

1. **Kop:** zoals nu (titel, status, uptime, stemming), compacter.
2. **Strook "Nu bezig"**, altijd zichtbaar boven de tabs:
   - de regisseur: niveau (select, slaat meteen op), Schatkist, ingrepen vandaag, en de knop "Laat hem nu iets doen";
   - wat er nu loopt, elk met een knop: lopende effecten (beëindig), verrassing (beëindig), zaak (beëindig), weekvijand (HP, beurt geven, afsluiten), veiling (hamer), tribunaal en gele-kaartstemming (stand), gokpauzes (aantal).
3. **Tabs,** elk met een rij chips bovenaan die naar de kaarten in die tab springen, en de tab en kaart in de URL-hash zodat je er direct naartoe kunt linken:
   - **Overzicht:** de KPI-tegels, de ranglijst, één activiteitsgrafiek (dag en type samen) en de geplande posts;
   - **Spel:** casino (statistieken plus limieten plus bonusknop samen), weekvijand (opkomen, spotten, beurt, afsluiten), veiling, kroket van de dag, quiz, bingo, troon, Gouden Kroket, Aflatenhandel (overzicht plus beheer samen), gokpauze;
   - **Recht:** tribunaal (alle knoppen, amnestie), verbanningen en vergrijpen, scorebeheer, verbonden en eer;
   - **Verkondigen:** verkondigen namens de Kroket God, geplande posts, seizoen en wereldbord;
   - **Persona's:** zoals nu;
   - **Systeem:** algemene instellingen (stemming, stil, weekendrust, providers, emoji, decreet, huisonderwerpen), LLM-providers en quota, test-console, logs (galerij, audit, activiteit).

   De oude reuzenkaart Instellingen verdwijnt: elk deel staat in de tab waar het hoort. De drie dubbele activiteitsgrafieken worden er één.
4. **Thema:** zoals nu (donker), met de bestaande tokens in `:root`. Nieuwe kleuren alleen via die tokens.

## Beslissingen van de ontwerper

- Het naslagmechanisme wordt de basis voor de vensters achter de menu's. Elke kaart die van de Home verdwijnt, wordt een naslagvenster.
- Acties met een deadline blijven op de Home, als regel met knop in UW BEURT, niet in een menu.
- `static_select` in Slack kan geen knop zijn; een keuze opent direct het venster (`views.open` met de trigger van de keuze).
- Dashboardknoppen blijven achter de bestaande Bearer-token-controle; er komen geen nieuwe acties bij, alleen verhuizingen.

## Aan de bouwer overgelaten

- De precieze teksten van de nieuwe koppen en regels.
- De volgorde binnen een menu.
- De opmaak van de chips en de strook "Nu bezig", binnen de bestaande stijl.
