# Gebruik en releasevoorstel, 2 november 2026

**Bronnen** (allemaal van jsprsuperserver): `statistiekhistorie.json` (gebeurtenissen per dag, 8 juni tot 2 november),
de laatste schrijfdatum van elk state-bestand, `casinostats.json`, het Grote Archief en de containerlog van de
laatste 30 uur.

**Wat je hier niet ziet:** losse `/kroketgod`-commando's worden nergens geteld. Zichtbaar is alleen wat
`logGebeurtenis` aanroept of wat een eigen state-bestand schrijft. Een commando dat alleen iets laat zien (zoals
`ranglijst` of `dossier`) kan dus veel gebruikt worden zonder dat het hier opvalt.

## Wie er meedoet

6 leden. Actief per week: 4 in augustus, 2 of 3 in september, 4 of 5 in oktober. De laatste twee weken waren de
drukste ooit (279 en 580 berichten van leden in het archief).

## Veel gebruikt (laatste 30 dagen)

| Functie | Gebeurtenissen |
|---|---|
| Opdrachten | 124 |
| Vetbad (`offer`) | 96 |
| Winkel | 76 |
| Scores | 74 |
| Duel | 71 |
| Eer | 51 |
| Troon | 40 |
| Kroketgok | 37 |
| Bamischijf | 30 |
| Veiling | 29 |
| Titels en achievements | 27 elk |
| Roof | 19 |
| Paarboek (`claim`) | 17 |
| Gunst | 13 |
| Casino | sinds 28 okt: 47 spellen, 4 van de 6 leden |

## Nooit gebruikt

| Functie | Gebouwd | Commando's | Waaraan te zien |
|---|---|---|---|
| Rechtbank en jurisprudentie | 15 aug | `rechtbank`, `jurisprudentie`, `zaak` | `jurisprudentie.json` bestaat niet; 0 zaken |
| Tijdcapsule | 15 aug | `voorspel`, `capsules` | `tijdcapsule.json` bestaat niet |
| Ambten en de Openbaring | 30 sep | `ambt`, `ambtsboek`, `vetgeschrift ambten` | nooit gestart (alleen via de testconsole, `openbaringStart`). De commando's staan wel in het menu en tonen dus niets. |
| Huisonderwerpen | 14 okt | `huisonderwerp [woord]` | `huisonderwerpen.json` bestaat niet |

## In slaap gevallen

| Functie | Laatste gebruik |
|---|---|
| Held van de Week (`stem`) | week van 18 mei, 2 stemmen |
| Vetwissels (`wissel`, `los af`, `scheld kwijt`) | 16 gebeurtenissen op 16 okt (de lanceerdag), daarna niets; 0 open |
| Stille Missie | 7 aug; alleen de beheerder kan hem starten |
| Allianties | 7 keer ooit, laatste 23 okt |
| Profetie | 16 keer ooit, laatste 13 okt |
| Klacht, zegen, zelflof | 2 keer elk, laatste in augustus |
| Tribunaal | 17 aug. Vuurt alleen bij inactieve leden, dus met 5 van 6 actief is stilte normaal. |

Weinig maar bewust zeldzaam: de wroklaag (vete 7, zwarte korst 5, twist 2, handdruk 1 in 30 dagen). Die blijft.
Lofzang daalt: 89 in totaal, 5 in de laatste 30 dagen.

## Fouten die dit onderzoek opleverde

1. **De App Home is elk weekend kapot, voor iedereen** (sinds de Verborgen Hand, 20 okt). In het weekend geeft
   `verborgenHandVandaag()` `null`; `perkamentHomeBlocks` roept dan `magSchrijven(null, id, undefined)` aan,
   `undefined === undefined` laat de controle door en `null.userId` gooit. 19 keer in de log van 1 november.
   Oplossing: `!!staat &&` in `magSchrijven` (lib/verborgenhand.js) plus een test.
2. `fortuin.json` valt buiten de backup (waarschuwing bij elke start). `daggasten.json` ook, maar dat lost het
   lopende werk aan "gasten van vandaag" al op.
3. De server draait niet-gecommit werk uit de hoofdmap. `master` staat op 4 augustus, 118 commits achter.
4. De waakhond en de herstart van 03:00 staan alleen op de server, niet in de repo. De waakhond herstart na 20
   minuten zonder internet de hele server, en dus ook pihole en homebridge.

## Voorstel voor de volgende release

**A. Repareren en meten**
- Fout 1 oplossen.
- `fortuin.json` in de backup.
- Een teller per commando: in `voerKroketCommandoUit` het eerste woord tellen met `bumpStatHistorieEvent('cmd:' + woord)`.
  Dan is de volgende ronde van dit overzicht volledig in plaats van half.
- Waakhond-script en crontab-regel in de repo, zodat de server opnieuw op te bouwen is.

**B. Opruimen** (minder menu, minder code)
- Weg: Held van de Week-stem, vetwissels, tijdcapsule.
- Laatste kans: rechtbank. Eén keer aankondigen; geen zaak binnen twee weken, dan weg.
- Huisonderwerpen: weg als er bij de volgende meting nog steeds niets is.

**C. Nieuw**
1. **De ambten aanzetten.** Gebouwd en getest (38 tests in `lib/ambten.test.js`), er hoeft alleen een Openbaring
   gestart te worden. Dat is de goedkoopste nieuwe functie die er is.
2. **Casino in de vrijdagsamenvatting**: wie won en verloor deze week, en wat het huis verdiende. De cijfers staan
   al in `casinostats.json`.
3. **Iets bovenop wat populair is**, opdrachten en duels. Bijvoorbeeld een reeksbonus voor opdrachten of een
   maandelijks duel-toernooi. Kies er één.

**Volgorde:** eerst A, dan de lopende sessies (casino, gasten van vandaag) committen, alles mergen naar
`wereld-tribunaal-weekvijand` en daarna naar `master`, taggen en met `bash deploy.sh` uitrollen. B en C daarna
als losse stappen.
