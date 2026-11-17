# App Home 2.0

17 november 2026. Vervolg op de herindeling van de Home (taken H1-H2: vaste bovenkant, menu's met vensters). De eigenaar: "ik vind ook de app home in slack zelf belangrijk. deze heeft ook een upgrade nodig". Gekozen richting: **Home 2.0 met terugval**.

## Waarom

De Home is waar leden de Kroket God elke dag openen. Na de herindeling is hij overzichtelijk, maar nog steeds een lijst tekst met knoppen. Slack heeft sinds april/mei 2026 nieuwe blokken voor de Home-tab: kaarten met afbeelding en knoppen, een carrousel van kaarten, inklapbare secties (container), een waarschuwingsbalk (alert), tabellen (ook sorteerbaar met pagina's) en ingebouwde grafieken. Daarmee kan de Home voelen als een app.

## Proef (17 nov, op de Home van de eigenaar)

`views.publish` met elk nieuw blok accepteerde: `card` (met `actions` als array van knoppen en `hero_image`), `carousel`, `container` (inklapbaar), `alert`, `table`, `data_table` (`caption` als string), `data_visualization` (`title` als string). Hoe ze er op telefoon en desktop uitzien, is nog niet gezien: dat gebeurt in de bèta-uitrol (hieronder).

Documentlimieten: kaart titel/subtitel 150, body/subtext 200 tekens, hoogstens 3 knoppen; carrousel 1-10 kaarten; container hoogstens 10 kindblokken (geen kaart, carrousel, data_table of grafiek erin); grafiek: lijn/staaf/vlak/taart, hoogstens 12 reeksen van 20 punten, titel 50 tekens, **hoogstens 2 grafieken per view**; data_table 1-20 kolommen, tot 200 rijen, page_size 1-100; Home-view hoogstens 100 blokken.

## Doelen

- Een lid ziet in één blik wie hij is, wat er vandaag speelt, wat hij nu kan doen (als kaarten om op te tikken), zijn opdrachten, zijn week als grafiek en de weekvijand met portret.
- De rest staat in inklapbare secties op de Home zelf (geen dropdowns meer nodig).
- Er breekt nooit iets: weigert Slack een view, dan komt de klassieke Home.
- De eigenaar ziet de nieuwe Home eerst zelf, voordat iedereen hem krijgt.

## Niet-doelen

- Nieuwe spelfuncties.
- De klassieke Home weggooien: hij blijft de terugval en de keuze voor wie hem liever heeft.

## Anti-doelen

- Een kapotte of lege Home voor een lid.
- Een actie met een deadline die verstopt raakt (stemming, claim, gast, veiling, uitdaging, Hete Kroket): die staat bovenaan als waarschuwingsbalk plus knop.
- Een Home die traag wordt door per keer plaatjes te renderen.

## Aanpakken

1. **Gekozen: nieuwe blokken waar ze het verschil maken, met terugval.** Zie Ontwerp.
2. Afgevallen: alleen klassiek (wat H1/H2 bouwen). Werkt overal, maar blijft een tekstlijst.
3. Afgevallen als basis: de Home grotendeels als gegenereerde afbeeldingen. Elke verversing zou een render en upload kosten, en tekst in een plaatje is niet klikbaar. Wel gebruikt voor vaste illustraties (actiekaarten) en het vijandportret, één keer gerenderd en hergebruikt.

## Ontwerp

Van boven naar onder:
1. **Kop:** header + section (rang, punten, plaats) + context met voortgang (zoals H1).
2. **Waarschuwingen:** per acute zaak een `alert` (hoogstens 3): een stemming die sluit, de Hete Kroket in uw handen, verbannen, een open claim. De knop staat in de kaart of de sectie eronder.
3. **VANDAAG:** een `container` (open) met de regels uit `vandaagBlokken` (effecten, verrassing, zaak, laatste ingreep, heilige).
4. **Actiekaarten:** een `carousel` met een kaart per beschikbare actie (raadpleeg, duel, roof, offer, casino, eer, gunst, visioen, bingo, gok; plus deadline-acties zoals bieden of vasthouden). Elke kaart: vaste illustratie (`hero_image`), titel, één regel status ("nog 1 duel vandaag"), 1-3 knoppen met de bestaande `action_id`'s. Hoogstens 10 kaarten; wat niet past, staat als knop in de sectie UW BEURT.
5. **UW OPDRACHTEN:** `container` (open) met de opdrachten van vandaag en deze week (compact, met voortgang).
6. **Uw week:** `data_visualization` (lijn): uw punten per dag deze week tegen het gemiddelde van het genootschap. Vereist dagstanden (zie Data).
7. **WEEKVIJAND:** een `card` met het portret van de vijand (`hero_image`), HP en aanvallen over in de subtitel/body, knoppen Val aan / Offer.
8. **Inklapbare secties** (`container`, standaard dicht): Ranglijst (een `table`), Recht & Raad, Mijn status, Het Rijk, Alle commando's. Inhoud uit de naslagvensters van H2 (zelfde teksten), ingekort tot hoogstens 10 blokken per sectie; "meer" opent het bestaande venster.
9. **Voet:** verversknop + voetnoot.

## Data

- **Dagstanden:** een klein statebestand met per dag per lid de weekscore aan het eind van de dag (cron 23:55 Amsterdam, plus bij opstart de stand van vandaag). Gedeeld met het nieuwe dashboard (grafieken per lid). Hoogstens 60 dagen bewaren.

## Uitrol en terugval

- Instelling `homeVersie`: `klassiek` | `beta` (alleen de eigenaar krijgt 2.0) | `iedereen`. Standaard na deploy: `beta`. In het dashboard instelbaar.
- Bij het publiceren van 2.0: weigert Slack (fout van `views.publish`), dan meteen de klassieke Home voor dat lid publiceren en de fout één keer per uur loggen (audit). Een lid ziet dus nooit een lege Home.
- Plaatjes: de illustraties worden één keer gerenderd (resvg) en op R2 gezet; hun URL's staan in een klein cachebestand. Ontbreekt R2 of een URL, dan krijgt de kaart geen afbeelding (kaarten werken zonder).

## Aan de bouwer overgelaten

- De illustraties zelf (stijl: dezelfde getekende frituurstijl als de casino- en vijandbeelden).
- De precieze teksten en de volgorde van de kaarten (actie die het meest oplevert eerst).
