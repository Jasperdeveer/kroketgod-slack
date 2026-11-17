# Spoor 2: de regisseur, de Kroket God beslist zelf

17 november 2026. Uitwerking van spoor 2 uit docs/superpowers/specs/2026-11-17-kroketgod-compacter-en-autonoom-design.md.

## Waarom

De eigenaar wil minder zelf regelen, en wil dat de Kroket God "echt voelt alsof hij zelf beslissingen maakt en de macht heeft". Nu reageert de bot vooral: op commando's, knoppen en vaste tijdstippen. De eigenaar koos voor volle macht. Hij mag dus ook afpakken en straffen, met harde plafonds.

## Doelen

- Op werkdagen grijpt hij een paar keer per dag uit zichzelf in, op momenten die niemand kan voorspellen.
- Zijn ingrepen hebben echte gevolgen: hij geeft, hij neemt, hij sluit het casino, hij verbiedt iets voor een paar uur, hij schorst iemand en hij zet een uitspraak van de Raad opzij.
- Elke ingreep kondigt hij aan in zijn eigen stem, met een reden.
- De eigenaar ziet in het dashboard wat hij deed, en kan hem dimmen of een lopend effect beëindigen.

## Niet-doelen

- Het terugbrengen van gerechtigheidsfuncties: gele kaart voordragen, tribunaal, premie, Stille Missie, verbonds- en zegendagen en bedelen. Dat is spoor 3. Die ingrepen gebruiken straks dezelfde motor.
- De tekstcommando's: dat is spoor 4.

## Anti-doelen

- Iemands week kapotmaken. Er zijn plafonds per dag en per lid, en niemand is twee dagen op rij doelwit van een straf.
- Spam. Hoogstens een paar ingrepen per dag, met minstens 45 minuten ertussen.
- Een ingreep zonder aankondiging, of een straf zonder reden.
- Een punteneconomie die ontspoort. Wat hij afpakt, gaat in zijn Schatkist, en daaruit betaalt hij zijn geschenken.

## Aanpakken

1. **Gekozen: een regieboek als data, met een pure kiezer.** `lib/regie.js` bevat de ingrepen als regels data en een functie die er per ronde één kiest, met alle plafonds. `index.js` levert de stand aan, voert de gekozen ingreep uit en laat de Kroket God hem aankondigen. Dit is testbaar, uitbreidbaar met één regel per nieuwe ingreep, en dezelfde vorm als de opdrachtenmotor.
2. Afgevallen: het taalmodel laten kiezen wat hij doet. Dat is onvoorspelbaar in de verkeerde zin: geen harde plafonds, en elke ronde kost een LLM-aanroep op een krap quotum.
3. Afgevallen: meer vaste crons met een kans. Dat is precies wat het nu is (premiejacht, spontane post), en dat voelt niet als iemand die beslist.

## Ontwerp

### De ronde

`planCron('*/20 8-17 * * 1-5', regieTik)`: elke 20 minuten op werkdagen. De tik doet niets buiten 8:30-17:30, in stille modus, bij weekendrust, bij alleen-testkanaal of als het niveau op "uit" staat.

Per tik:
1. `bouwRegieStand()` in `index.js` maakt een momentopname van het Rijk.
2. `kiesIngreep(stand, regieLog, { nu, rng, niveau })` in `lib/regie.js` geeft een ingreep met een doelwit terug, of `null`.
3. `voerIngreepUit(client, keuze, stand)` in `index.js` voert het effect uit, laat de Kroket God het aankondigen, en schrijft het in `regie.json` en het auditlog.

### De stand

- **Leden:** wie vandaag actief was (`activiteit.json`), wie drie of meer werkdagen stil is, de weekscores, de koploper en de hekkensluiter.
- **Casino:** het aantal spellen vandaag, de grootste nettowinst en het grootste verlies vandaag (wie en hoeveel), en de reeksen van drie winsten op rij.
- **Duels:** wie vandaag won, plus reeksen.
- **Weekvijand:** actief of niet, HP en maxHP, de dag, het aantal strijders, en of `extraAanval` al gezet is.
- **Raad:** lopende gele-kaartstemmingen en ballingen.
- **Zijzelf:** de lopende effecten en het regielog van vandaag en gisteren.

### De kiezer (`lib/regie.js`, puur)

Elke ingreep in `REGIEBOEK` heeft deze velden:
- `id`;
- `soort`: geven, nemen, casino, gril, toespraak of weekvijand;
- `gewicht`;
- `afkoelUren`;
- `maxPerDag`;
- `voorwaarde(stand)`;
- `kiesDoel(stand, rng)`, dat een userId geeft of `null` als de ingreep iedereen raakt;
- de `punten` die hij geeft (positief) of neemt (negatief), of 0;
- de `duurMinuten` voor een effect;
- een korte `opdracht` voor de tekst.

Per ronde gebeurt dit:
1. **Tempo.** Het niveau bepaalt de kans dat hij nu iets doet en het dagbudget:

   | Niveau | Kans per tik | Ingrepen per dag |
   |---|---|---|
   | laag | 8% | 2 |
   | normaal | 15% | 4 |
   | wild | 25% | 7 |

   Er zit minstens 45 minuten tussen twee ingrepen.
2. **Kandidaten.** Alle ingrepen waarvan de voorwaarde klopt, met deze regels:
   - geen ingreep binnen zijn eigen afkoeltijd of boven zijn eigen dagmaximum;
   - geen doelwit dat vandaag al doelwit was;
   - bij een straf (`nemen`) geen doelwit dat gisteren ook gestraft werd.
3. **Plafonds per dag:**
   - hoogstens 15 punten weggegeven;
   - hoogstens 10 punten afgepakt, en per lid hoogstens 5;
   - hoogstens één schorsing;
   - nooit onder nul: hij pakt niet meer dan iemand heeft.
4. **Keuze.** Gewogen loting onder de kandidaten. Na een straf krijgen de geef-ingrepen tijdelijk extra gewicht, zodat hij wispelturig voelt en niet alleen streng.

### Het regieboek, eerste versie

Geven:
- **Het Huis geeft.** Iedereen krijgt vandaag 3 extra spellen in het casino, via het bestaande `casinobonus.json`. Voorwaarde: na 12:00 zijn er vandaag minder dan 3 spellen gespeeld.
- **Een persoonlijke gunst.** Een lid dat drie werkdagen stil is, krijgt een knop. Drukt het binnen een uur, dan krijgt het 2 punten.
- **De loterij gevuld.** Hij doet 3 punten in de pot van de Frituurloterij. Voorwaarde: het is donderdag of vrijdag vóór de trekking.

Nemen (de macht):
- **Belasting.** De koploper van de week draagt 10% van zijn weekscore af aan de Schatkist, met minimaal 2 en hoogstens 5 punten. Voorwaarde: de koploper staat 15 of meer punten voor op nummer twee.
- **Beslag.** Wie vandaag in het casino 10 of meer netto won, verliest 3 punten aan de Schatkist.
- **Schorsing.** Een lid wordt een uur geschorst, zonder stemming en zonder kaart. Dit gebruikt het bestaande verbanningsmechanisme, met de reden erbij. Voorwaarde: het lid kreeg deze week al een gele kaart, of heeft vandaag een vergrijp. Laag gewicht; hoogstens één per dag.
- **De Raad overruled.** Dit is geen ingreep in de ronde, maar een haak in het sluiten van een gele-kaartstemming. Met 20% kans draait hij de uitslag om: een afgewezen kaart gaat toch door, of een aangenomen kaart scheldt hij kwijt. Hoogstens één keer per week, en het telt mee voor de plafonds.

Casino:
- **De hoge tafel.** Een uur lang is de maximale inzet twee keer zo hoog. Voorwaarde: iemand won vandaag drie keer op rij, of er werden vandaag 10 of meer spellen gespeeld.
- **Het casino gaat dicht.** Twee tot drie uur gesloten, want "de frituur wordt gereinigd". Het casinovenster toont tot hoe laat. Voorwaarde: vandaag 15 of meer spellen, of iemand verloor vandaag 10 of meer. Niet in het laatste uur van de werkdag.
- **Het gouden uur.** Een uur lang betaalt één spel anderhalf keer uit, met hoogstens 5 extra punten per spel.

Grillen (een verbod of gebod voor een paar uur):
- **Duelverbod.** Twee uur lang mag niemand duelleren.
- **Inflatie.** Een uur lang is alles in de Aflatenhandel twee keer zo duur.
- **Uitverkoop.** Een uur lang is alles in de Aflatenhandel 1 punt goedkoper, met een minimum van 1.
- **Dubbele eer.** Een uur lang telt elke eer één klasse hoger, voor iedereen.

Toespraken:
- **Een stil lid aanspreken.** Dit hoort bij de persoonlijke gunst hierboven.
- **De koploper uitdagen.** Hij daagt de koploper uit om de hekkensluiter tot een duel uit te dagen. Wint de hekkensluiter, dan krijgt die 3 punten extra. Dit is een knop met een looptijd van 2 uur.
- **Een praatje.** Een roddel uit het casino, een kroketfeitje of een spontane gedachte. Dit vervangt de vaste casinoroddel (dinsdag 16:30), het vaste kroketfeitje (werkdagen 7:30) en de spontane posts (dinsdag en donderdag 10:00 en 14:00). Die drie crons vervallen.

Weekvijand:
- **Een extra aanvalsdag.** Het gebruikt het bestaande `raid.extraAanval`. Voorwaarde: het is woensdag of donderdag, de vijand staat nog op meer dan 60% HP en er vochten minder dan de helft van de leden mee.

### Verrassingen (zeldzaam)

De eigenaar wil ook verrassingen die buiten het dagelijkse ritme vallen, maar niet te vaak. Dit is een eigen laag in het regieboek, met strengere regels:

- **Budget:** hoogstens 2 per week, nooit 2 op dezelfde dag, en dezelfde verrassing niet binnen 3 weken opnieuw.
- **Kans:** 3% per tik, los van de gewone ingrepen. Gemiddeld valt er dus ongeveer één per week, op een moment dat niemand verwacht.
- **Plafonds:** de verrassingen tellen mee voor dezelfde dagplafonds voor punten en schorsingen.
- **Aankondiging:** altijd groots, in de stem van de dag, met een eigen kop.

De verrassingen:

1. **De Hete Kroket.** Hij geeft een willekeurig lid een gloeiende kroket met een knop "Geef door". Wie hem vasthoudt, moet hem binnen 30 minuten aan iemand anders geven; elke keer doorgeven verlengt de tijd met 10 minuten. Na 90 minuten ontploft hij. Wie hem dan vasthoudt, verliest 3 punten aan de Schatkist, en wie hem het vaakst doorgaf, krijgt 1 punt. Het hele kanaal ziet een teller in het bericht lopen.
2. **De Flitsopdracht.** "Wie binnen tien minuten …": bijvoorbeeld een foto van een kroket plaatst, het woord "paneermeel" in een serieuze zin gebruikt, of als eerste een duel wint. De eerste die het doet, krijgt 3 punten. Een pool van opdrachten die de bot zelf kan controleren (een bericht, een duel, een offer).
3. **Het Raadsel.** Hij verstopt een schat: een raadsel over het Rijk of over kroketten, met een vast antwoord uit een pool. Wie het juiste antwoord als eerste in de draad zet, krijgt 5 punten. Na een uur verklapt hij het antwoord en spot hij met de groep.
4. **De Stadhouder.** Een willekeurig actief lid krijgt een uur lang zijn macht: één keer een knop "Sluit het casino", "Hef belasting op de koploper" of "Deel een gunst uit". Kiest de stadhouder niets, dan bespot hij die zwakte. Het effect telt mee voor alle gewone plafonds.
5. **De Grote Herverdeling.** Hij neemt van de twee hoogste weekscores elk 10%, met hoogstens 4 punten per lid, en verdeelt dat onder de twee laagsten. Alleen als het verschil tussen nummer één en de laatste meer dan 40 punten is.
6. **Het Archief spreekt.** Hij haalt een bericht van een lid van precies een maand geleden uit het Grote Archief, citeert het, en velt een oordeel: een zegen van 1 punt of een spottende berisping. Hij kiest alleen berichten van leden zelf, nooit iets uit een draad of uit een DM.
7. **Hij mengt zich in de strijd.** Met een eigen bliksemschicht doet hij 15% schade aan de weekvijand. Of, als de vijand te snel valt (voor woensdag onder de 30%), heelt hij hem juist met 10%, omdat "een te makkelijke overwinning geen overwinning is". Met een eigen GIF.
8. **Het Omgekeerde Uur.** Een uur lang krijgt de verliezer van een duel de punten van de winnaar, en betaalt in het casino het verlies uit. Hoogstens 5 punten per spel of duel, en het telt mee voor de plafonds.

Daarnaast twee kleinere, die wel vaker mogen maar in dezelfde laag zitten:
- **Puntenregen.** De volgende drie leden die iets in het kanaal zeggen, krijgen elk 1 punt.
- **Woede bij stilte.** Was het kanaal op een werkdag drie uur stil, dan dreigt hij: als er binnen 15 minuten niemand iets zegt, verliest iedereen 1 punt. Zegt er wel iemand iets, dan krijgt die persoon 1 punt.

### Tijdelijke effecten

`regie.json` heeft twee delen:
- `effecten`: een lijst `{ soort, tot, data }`;
- `log`: de ingrepen van de laatste 14 dagen.

Deze plekken lezen de lopende effecten:
- het casino: `dicht`, `hogeTafel` en `goudenUur`;
- het begin van een duel: `duelverbod`;
- de winkelprijs: `inflatie` en `uitverkoop`;
- de eerweging: `dubbeleEer`.

Een verlopen effect telt gewoon niet meer en wordt bij de volgende tik opgeruimd. Wie iets probeert wat verboden is, krijgt een korte uitleg in de stem van de Kroket God, met de tijd tot het effect afloopt.

### Aankondigen

Elke ingreep wordt een kanaalbericht van de Kroket God. Het taalmodel schrijft de tekst in de stem van de dag. Het krijgt mee:
- de feiten: wat, wie, hoeveel en tot wanneer;
- de reden, uit de voorwaarde (bijvoorbeeld "staat 18 punten voor");
- de opdracht van de ingreep.

Lukt het taalmodel niet, dan gebruikt hij een vaste zin per ingreep. Een ingreep met een knop krijgt die knop onder het bericht.

### Dashboard

- **Instelling `regieNiveau`:** uit, laag, normaal of wild. Standaard: normaal.
- **Een kaart "Wat de Kroket God vandaag deed":** de ingrepen van vandaag met tijd, wat, wie en punten, plus de lopende effecten met hun eindtijd.
- **Per effect een knop "beëindig".** Een effect dat je beëindigt, verdwijnt meteen.
- **Een knop "laat hem nu iets doen".** Dat is één tik die de kans en het minimumtempo overslaat, maar wel de plafonds respecteert. Handig om te testen.
- **Auditlog.** Elke ingreep komt in het bestaande auditlog.

### Compacter

- **Drie crons vervallen:** de casinoroddel, het kroketfeitje en de spontane post. Ze worden ingrepen in het regieboek.
- **De premiejacht** (woensdag 11:00) gaat in spoor 3 naar het regieboek.

### Testen

- `lib/regie.test.js` heeft unittests voor de kiezer:
  - de plafonds en het nooit-onder-nul;
  - het minimumtempo en de afkoeltijden;
  - geen dubbel doelwit, en geen straf twee dagen op rij;
  - het niveau "uit";
  - het tijdvenster;
  - de gewogen keuze met een vaste `rng`.
- Een rooktest door de echte bot met het nep-Slack-harnas. Daarin:
  - draait elke ingreep één keer;
  - maakt het casino dicht spelen onmogelijk, en is het na afloop weer open;
  - weigert het duelverbod een duel;
  - gaat bij een belasting het bedrag van de score naar de Vetpot;
  - maakt een schorsing het lid een uur een balling.

## Beslissingen na de bouwerscheck

Een frisse bouwer las dit ontwerp en stelde vragen. Twee daarvan waren al beantwoord; de rest is beslist zoals hieronder. Die beslissingen zijn keuzes van de ontwerper, niet van de eigenaar.

Al beantwoord:
- **De puntenschaal.** Een oud commentaar in `index.js` spreekt van 1-4 punten per lid. De echte stand op 17 november: 4 tot 59 punten op dinsdag, en 50 tot 145 op vrijdag (punten resetten zondag, en maandag is er 5 zakgeld). De plafonds (15 geven, 10 nemen per dag) en de voorwaarden (koploper 15 voor, casinowinst van 10) passen bij die schaal.
- **`raid.extraAanval`.** Bestaat sinds f993103 in `bamischijf.json`, en `aanvalsLimiet` in `lib/weekvijand.js` leest hem. Er was nog geen code die hem zet; dat doet de eigenaar nu met de hand. De regisseur wordt de eerste zetter.

Beslist (keuze van de ontwerper):
- **Waar zijn punten vandaan komen.** Wat hij afpakt, gaat in zijn eigen Schatkist (`regie.json`), niet in de Vetpot. Geschenken betaalt hij eerst uit de Schatkist. Is die leeg, dan mag hij binnen het dagplafond van 15 punten zelf punten scheppen, zoals het zakgeld dat ook doet. De Schatkist staat op het dashboard. Zo stroomt wat hij neemt terug naar de leden, en verdwijnen er geen punten in een pot die bijna nooit uitkeert.
- **Gekochte bescherming telt.**
  - De Zegen van de Paneerlaag maakt immuun voor belasting, beslag en de puntenstraf van de Hete Kroket. Hij spot dan met de afgeketste straf, zoals nu bij de zondebok.
  - De Gouden Korst vangt ook zijn schorsing op.
  - Ballingen, wie zich afwezig meldde (`afwezigTot`) en gasten zijn nooit doelwit. Leden van een verbond wel.
- **De schorsing is een kale verbanning van een uur, zonder kaart.** Een kaart zou de volgende kaart rood maken en het verbond meeslepen. Voorwaarde: het lid kreeg deze week al een gele kaart, of heeft vandaag een vergrijp in `vergrijpen.json`. De ketterijherkenning bestaat niet als logbare gebeurtenis en valt daarom als voorwaarde af.
- **De Raad overrulen.** De kaart wordt pas opgelegd bij het sluiten van de stemming. Daar, vóór `legKaartSchorsingOp`, kan hij de uitslag omdraaien. Zijn de plafonds op, dan gebeurt er niets en meldt hij ook niets. De aanklager van een voordracht noemt hij nooit.
- **Prijzen in de Aflatenhandel.** Er is geen prijsfunctie, alleen de vaste `prijs` per item in `WINKEL_ITEMS`. Er komt één functie `winkelPrijs(item)` die de effecten toepast:
  - inflatie: de prijs keer 2;
  - uitverkoop: de prijs min 1, met een minimum van 1.

  Dat geldt alleen voor de Aflatenhandel, niet voor de wapens.
- **Dubbele eer.** Eer is een klasse van 0 tot 5, en die kan niet echt verdubbelen. Het uur van dubbele eer promoveert de klasse daarom één trede, met `promoveerKlasse` (`lib/eerwaarde.js`), net als de bestaande zegen.
- **Praatjes hebben een eigen baan.** Ze tellen niet mee voor het dagbudget van 2, 4 of 7. Het is hoogstens één praatje per werkdag, met een kans per tik die zo is afgesteld dat er op ongeveer vier van de vijf werkdagen één komt.
- **Het rooktest-harnas gaat de repo in**, als `scripts/rooktest/harnas.js`, met een korte uitleg erbij. Er staan geen geheimen in, alleen nepwaarden. Het is geen `*.test.js`, dus `npm test` draait het niet.

## Aan de bouwer overgelaten

- De precieze teksten van het vangnet en de schrijfopdrachten.
- De exacte plek van elke effect-haak in `index.js`.
- Of het praatje een eigen ingreep is of drie losse (roddel, feitje, gedachte), zolang de drie crons vervallen.
