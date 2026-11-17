# Het Frituurarsenaal: wapens tegen de weekvijand

> **Wijziging 17 november 2026:** de oorlogskas is geschrapt. Wapens en het kanon kosten nu echt punten, en wie de vijand velt krijgt niets terug. De prijzen zijn verdubbeld (Frietvork 2, Vliegenmepper/Ovenwant/Vershoudfolie 4, Kroketmes/Pekelspuit 6, Vetbom 10) en het kanon vraagt 24 punten. Aanleiding: de eigenaar vond de vijand te makkelijk; de Gehaktstaaf viel op dinsdag en de winnaars kregen hun wapens terug.

Goedgekeurd door de eigenaar op 16 november 2026.

## Waarom

De eigenaar wil wapens kunnen kopen in de winkel om de weekvijand aan te vallen, zodat het spel
interactiever en spannender wordt, zonder dat de balans omvalt.

## Doelen en grenzen

- Doel: elke week een keuze. Welk wapen past bij de gave van deze snack, wanneer zet je het in,
  en zet de groep vrijdag alles in of niet.
- Doel: samenwerken blijft de kern. Eén rijke speler velt de vijand niet alleen.
- Geen doel: wapens als gewone power-ups (ze horen bij één vijand en verdwijnen met hem).
- Anti-doel: een vijand die met wapens al op dinsdag of woensdag valt.

## Balans

Punten gaan elke zondag op nul. Op maandag heeft iedereen ongeveer 5 punten, tegen vrijdag 50
tot 145. Een prijs remt dus alleen vroeg in de week. Daarom houden regels de wapens in toom:

- Hoogstens 2 wapens per lid per vijand (het wapenrek), één tegelijk in de hand.
- Je valt nog steeds één keer per dag aan; het wapen gaat op bij je volgende aanval.
- De Vetbom hoogstens 1 keer per lid per vijand (telt mee in het rek).

Oorlogskas: alles wat je aan wapens en het kanon uitgeeft, gaat naar de buit van de vijand.
Valt hij, dan krijgt iedereen zijn inleg terug. Ontsnapt hij, dan is die weg.

HP per lid gaat van 7 naar 8,5. Simulatie (40.000 weken, 4 vaste strijders met 85% kans per
dag, de helft offert, 2 losse leden met 20%):

| | 7 HP (nu) | 8,5 HP |
|---|---|---|
| zonder wapens | 75% | 30% |
| helft van de rekken gebruikt | 96% | 81% |
| alle rekken gebruikt | 99% | 89% |
| zware snack (×1,3), alle rekken | 79% | 39% |

## De wapens

| Wapen | Prijs | Effect |
|---|---|---|
| 🍴 Frietvork | 1 | +1 schade |
| 🔪 Kroketmes | 3 | +2 schade, gaat door pantser |
| 🪰 Vliegenmepper | 2 | +1, mist nooit (gaat door ontwijk) |
| 🧤 Ovenwant | 2 | +1, geen terugslag en geen knal bij de genadeslag |
| 🎞️ Vershoudfolie | 2 | geen extra schade; bij zijn volgende beurt herstelt hij niet |
| 🧂 Pekelspuit | 3 | +1, en de volgende twee aanvallen van anderen die dag +1 |
| 💣 Vetbom | 5 | +2 tot +6 schade (bij een gewone aanval 3–9); 1 op 6 ketst terug: 0 schade en 2 punten naar zijn buit |

Wapens werken ook tegen een offerdove vijand. Offer en wapen samen in één aanval mag.

🛢️ Het Frituurkanon: inleggen via het raidbord. Bij 12 punten van minstens 3 verschillende leden
vuurt het: 15% van zijn max-HP. Eén keer per vijand. De inleg gaat in de oorlogskas.

Het raidbord toont de oorlogskas, de stand van het kanon, wie welk wapen in de hand heeft en per
gave een tip ("Zwak tegen: 🔪").

## Keuzes van de bouwer

- Wapenstaat hoort bij de raid (`raid.arsenaal`, `raid.kanon` in `bamischijf.json`), niet in
  `powerups.json`: hij verdwijnt vanzelf met de vijand.
- Wapens staan niet in `WINKEL_ITEMS`. Zo komen ze niet in de rang-gunst, de veiling of de
  korting, en geldt er geen rangkorting.
- Kopen kan met `/kroketgod koop <wapen>`, in de App Home-winkel en met een keuzelijst op het
  raidbord. Een koper die nog niet aanviel, wordt geen strijder (geen overwinningsbeloning).
- De nieuwe HP geldt vanaf de eerstvolgende vijand.
