# Inventaris van de Kroket God, 2 november 2026

Een overzicht van wat er in de bot zit, wat er vandaag uit is gegaan, en wat beter kan. De
gebruikscijfers komen van de server: `statistiekhistorie.json` (8 juni tot vandaag), de
laatste schrijfdatum van elk state-bestand en het Grote Archief (5 oktober tot vandaag). Meer
detail per functie staat in [gebruik-2026-11.md](gebruik-2026-11.md).

## In cijfers

| | |
|---|---|
| `index.js` | 23.214 regels (vanochtend 24.023) |
| Modules in `lib/` | 46, met 42 testbestanden en 786 tests |
| Geregistreerde functies | 34 |
| Commandowoorden in de menu's | ruim 80 |
| Vaste momenten waarop de bot uit zichzelf iets doet | 44 (62 geplande taken in totaal) |
| Knoppen / vensters / dashboard-routes | 42 / 19 / 18 |

Berichten in het kanaal van 5 oktober tot vandaag: de Kroket God 878, zijn gasten 400, de
leden 1.049. Het verschil is het grootst op stille dagen. Op maandag 12 en 19 oktober
plaatste de Kroket God vóór twaalf uur 14 en 17 berichten; de leden samen 1.

Het meest gebruikt in de laatste 30 dagen: opdrachten (125), offer (98), winkel (84), duel (72),
eer (51), troon (40), kroketgok (40), weekvijand (34), veiling (29), roof (19), claim (17).

## Vandaag weggehaald

| Functie | Waarom | Wat blijft |
|---|---|---|
| Tijdcapsule (`voorspel`, `capsules`) | sinds 15 augustus geen enkele capsule | niets |
| Rechtbank en jurisprudentie (`rechtbank`, `jurisprudentie`, `zaak`) | sinds 15 augustus geen enkele zaak | `rechtbank X vs Y` werkt nog als vrije vraag; de Kroket God oordeelt dan zonder zaaknummer |
| Held van de Week (`stem`, de verkondiging op vrijdag 16:00) | laatste stem in mei, nooit een held gekroond | niets |
| WK 2026-standen bij een mention | het WK is sinds juli voorbij | niets |
| Huisonderwerpen voordragen (`huisonderwerp`, het paneel op het dashboard) | nooit gebruikt | uw eigen lijst in de instellingen (nu `tavernehoek`) telt nog gewoon mee bij eer |
| Vier functies die nergens werden aangeroepen | dode code | niets |
| `start.command` | startte de bot op de Mac; naast de server geeft dat twee bots | niets |

Samen 1.588 regels, waarvan 813 in `index.js`. Wie een weggehaald commando intypt, krijgt een
gewoon antwoord van de Kroket God, geen foutmelding.

## Uw keuze: groot en nauwelijks gebruikt

Deze drie heb ik laten staan, omdat ze groter zijn of omdat u er zelf aan hebt gewerkt.

| Functie | Gebruik | Omvang | Advies |
|---|---|---|---|
| Vetwissel (`wissel`, `los af`, `scheld kwijt`, `in`, `overval`) | 16 acties op de lanceerdag (16 oktober), 2 geweigerde aanbiedingen op 20 oktober, daarna niets. Er staat er nu geen open. | ongeveer 1.400 regels met module en tests, 2 vaste momenten | weg |
| Ambten en de Openbaring (`ambt`, `ambtsboek`, `vetgeschrift ambten`) | nooit gestart. De commando's staan wel in het menu en tonen dus niets. | ongeveer 1.400 regels met module en tests, 3 vaste momenten | weg |
| Stille Missie (`missie`, `missie starten`, `complot`, `meld`) | alleen de beheerder kan hem starten, laatst op 7 augustus | ongeveer 300 regels | weg |

De vetwissel is in oktober op uw verzoek herontworpen; daarom haal ik hem niet zonder u weg.
Bij de ambten stelde ik vanochtend nog voor ze aan te zetten. Met minder als doel past er geen
nieuw systeem bij, en sinds de Opperpaneerder de weekvijand niet meer kiest, heeft één van de
vijf ambten ook geen taak meer.

## Beter uitdenken

### Eén commandolijst

`help` en `kroketprompts` tonen elk een andere helft van de commando's.
In `kroketprompts` ontbreken `duel`, `roof`, `winkel`, `opdrachten`, `bingo` en `beurs`, dus
juist de populairste. In `help` ontbreken `casino`, `status`, `dossier` en `invite`. Alleen de
App Home voegt de twee lijsten samen. Voorstel: één register waaruit `help`, `kroketprompts` en
de Home alle drie lezen. Sinds vandaag telt de bot per commando hoe vaak het gebruikt wordt;
rond 1 december kunnen de commando's die niemand intypt (kandidaten: `orakel`, `horoscoop`,
`bs`, `mop`, `biecht`, `canoniseer`, `slachtoffer`) uit het menu. Als vrije vraag aan de Kroket
God blijven ze dan gewoon werken.

### De Verbondszegen

Het vaakst geposte bericht van de bot: 378 keer sinds juni, 91 keer in de
laatste 30 dagen. Leden sloten in totaal 7 keer een verbond. Voorstel: de bonus blijft, het
losse bericht verdwijnt. Hij komt alleen nog als regel in de thread van de actie die hem
veroorzaakte.

### De maandagochtend

Tussen 07:30 en 11:05 staan ruim twintig vaste momenten: weekopening,
seizoensfase, vete, kroniek, weekvijand, Dubbele Korst, Zwarte Korst, kroket van de dag,
rang-gunst, Vetpapier, Blinde Handdruk, bingo, tribunaalklok en meer. Niet elk moment post
iets, maar het zijn er genoeg om een stille ochtend vol te zetten. Voorstel: één weekopening
om 09:00 waarin die onderdelen als blokken staan; een los bericht alleen als er iets van een
lid gevraagd wordt.

### De wroklaag is half verbouwd

Op 14 oktober is vastgesteld dat het Paarboek (`bladzijde`,
de claim) de kerfstok en de eeuwige twist vervangt. Dat is niet afgemaakt: `kerfstok.json`,
`twisten.json` en `paarboek.json` worden alle drie nog bijgewerkt, `lib/paar.js` en
`lib/paarboek.js` beschrijven zichzelf allebei als "wat er tussen twee leden staat", en een lid
ziet zowel `kerfstok` als `bladzijde`. Voorstel: de overgang afmaken. Zwarte Korst, Dubbele
Korst, Vetpapier en Blinde Handdruk blijven; die hebben geen opvolger.

### Twee vijanden tegelijk

Het seizoen heeft een eigen vijand met HP die zes weken lang door
ieders spel wordt teruggedrongen. Daarnaast is er elke week de weekvijand die leden zelf
aanvallen. Voor een lid is het verschil tussen de twee balken moeilijk te zien. Voorstel: het
seizoen wordt een reeks van zes weekvijanden met de seizoensvijand als laatste, in plaats van
een tweede balk.

### `index.js` zelf

De code van één functie staat vaak op meerdere plekken: de weekvijand op
drie, de vetwissel op twee, de persona's op twee, en de App Home is verspreid over ruim 1.500
regels. Voorstel: niet in één keer verbouwen, maar elke functie die we aanraken naar één eigen
bestand in `lib/` verhuizen.

## Op de server, alleen met uw akkoord

Twee bestanden worden door niets meer gelezen: `kroniek.ndjson` (1,6 MB, sinds 18 augustus
vervangen door `grootarchief.ndjson`) en `stemmen.json` (van de Held van de Week; geeft bij elke
start de melding "Niet in de backup"). Ze kunnen weg, of naar `backups/`.
