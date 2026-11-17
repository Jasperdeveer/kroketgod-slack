# De weekvijand in beeld: een GIF bij elke klap

17 november 2026 · goedgekeurd door de eigenaar ("Zelf getekend", "Ja, maak het voorbeeld", "Ja, bouw de rest")

## Waarom

Het Frituurarsenaal (16 nov) maakte de raid interactiever, maar een aanval is nog steeds een tekstregel in de draad. De eigenaar wil dat je de wapens ziet werken: de weekvijand stuurt een zelfgemaakte GIF waarin hij geraakt wordt.

## Doelen

- Bij elke aanval op het raidbord komt onder de tekstregel in de draad een GIF van die klap: het wapen dat je gebruikte, de schade en de HP-balk die leegloopt.
- Elk wapen heeft een eigen beweging en een eigen effect op de vijand. Ook gewone aanvallen, offer-aanvallen, missers, een ketsende Vetbom, terugslag, het kanon en de genadeslag hebben een eigen beeld.
- Een zelfgetekende cartoonsnack voor elk van de 52 weekvijanden.

## Niet-doelen

- Geen animatie van zijn eigen middagbeurt (kan later met dezelfde motor).
- Geen GIF voor raids zonder bord (van vóór de borden).

## Anti-doelen

- **De aanvaller mag niet wachten.** De tekstregel gaat eerst de deur uit; de GIF komt er later bij via `chat.update`.
- **Geen imgbb.** imgbb blokkeerde de server om precies zulke GIF's (11 nov). Zonder R2 komt er geen GIF.
- **Geen namen van leden op het plaatje.** R2 is openbaar; namen staan alleen in de Slack-tekst.
- **Een mislukte GIF breekt niets.** Lukt tekenen of uploaden niet, dan blijft de tekst gewoon staan.

## Aanpakken

1. **Gekozen: elk beeld tekenen in SVG**, met resvg naar pixels en gifenc naar GIF (de motor die het casino al had). Alles hangt alleen af van code in de repo, en het echte schadegetal en de HP-balk komen erin.
2. Afgevallen: kant-en-klare GIF's per snack en wapen. Het zouden er ruim 350 zijn, en het echte getal en de HP kunnen er niet in.
3. Afgevallen: het AI-portret (pollinations) animeren. Een plat plaatje kan alleen schudden, en pollinations valt geregeld weg. De eigenaar koos "Zelf getekend".
4. Afgevallen: een video of een nieuwe tekenbibliotheek. Slack speelt geen video af in een draad, en resvg en gifenc zitten er al in.

## Ontwerp

- **`lib/vijandbeeld.js`** (puur, zonder I/O) geeft een film terug: een lijst `{ svg, ms }`.
  - `aanvalFilm(opties)` maakt de film van één aanval.
  - `kanonFilm(opties)` maakt de film van het kanonschot.
- **Uiterlijk.** De 52 snacks delen twaalf vormen: bal, staaf, schijf, ring, blok, kussen, bakje, broodje, vis, saus, stapel en spies.
  - Elke snack krijgt zijn eigen kleuren, binnenkant en beleg: mayo, curry, ui, poedersuiker, sesam enzovoort.
  - Een boos gezicht. Is hij razend, dan krijgt hij rode ogen en stoom.
  - Een onbekende sleutel valt terug op een bal.
- **Scène.** 480 × 400 pixels en tegels op de achtergrond. Bovenaan staan zijn naam en de HP-balk, met een geel spoor dat leegloopt. Onderaan schuift een banier in beeld.
- **De film** bestaat uit fases: intro, uithalen, klap, inslag, nasleep en eindbeeld. De film speelt één keer af en blijft op het eindbeeld staan.
- **Wapens en hun effect op de vijand:**

  | Wapen | Effect |
  |---|---|
  | Kroket als knuppel (gewone aanval; met vlammen bij een offer) | deuk |
  | Frietvork | gaatjes |
  | Kroketmes | de vijand splijt en toont zijn binnenkant |
  | Vliegenmepper | hij wordt plat geslagen |
  | Ovenwant | stoot en deuk |
  | Vershoudfolie | hij wordt ingepakt |
  | Pekelspuit | zout plakt op hem |
  | Vetbom | ontploffing en een zwartgeblakerde vijand |

- **Situaties:**
  - Een misser: hij duikt weg en "MIS!" verschijnt.
  - Een ketsende Vetbom: de bom komt op de kijker af en "KETST!" verschijnt.
  - Terugslag: hij valt de kijker aan en "−N PT" verschijnt.
  - De genadeslag: X-ogen, hij valt om en "VERSLAGEN!" verschijnt.
  - Het kanon: een frituurkanon dat van links schiet.
- **GIF.** `naarGif` (lib/casinobeeld.js) haalt het palet nu uit een steekproef van álle beelden, niet alleen uit het eerste en het laatste. Een wapen dat alleen halverwege in beeld is, krijgt anders vale kleuren.
- **Slack.** Na de tekstregel in de draad rendert `voegVijandGifToe` de film en zet die op R2 onder `weekvijand/`. Die map heeft geen lifecycle-regel, zodat oude GIF's blijven werken. Daarna voegt `chat.update` een image-blok toe. Dat gebeurt voor de gewone aanval, voor de genadeslag (een nieuwe draadregel) en voor het kanonbericht.

## Aan de bouwer overgelaten

- De precieze tekeningen, kleuren, timing en het aantal beelden. Richtlijn: hoogstens zo'n 60 beelden en onder de 1 MB.
