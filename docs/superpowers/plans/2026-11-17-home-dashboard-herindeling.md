# Herindeling Home en dashboard, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** De App Home en het dashboard opnieuw indelen: het belangrijkste bovenaan, de rest in menu's en vensters, niets kwijt.

**Architecture:** Home: `bouwAppHomeBlocks` krijgt een vaste bovenkant (kop, melding, perkament, VANDAAG, UW BEURT, WEEKVIJAND) en daaronder vijf menu's; de kaarten die verdwijnen, worden naslagvensters (`NASLAG`/`bouwNaslagVenster`). Dashboard: een strook "Nu bezig" boven de tabs en een nieuwe tabindeling met chips en URL-hash in `dashboard.html`; `bouwDashboardData` levert een samenvatting `nuBezig`.

**Tech Stack:** Node 20, Slack Bolt (Block Kit), `node:test`, het rooktest-harnas (`scripts/rooktest/harnas.js`), plain HTML/JS in `dashboard.html`.

**Spec:** docs/superpowers/specs/2026-11-17-home-dashboard-herindeling-design.md

## Global Constraints

- Home onder **60 blokken** op een volle dag (alle kaarten die kunnen verschijnen tegelijk); Slack-maximum blijft 100 met `kapHomeBlocks` als vangnet, dat eerst de menu's opoffert en nooit de bovenkant.
- Elke actie die nu op de Home staat, blijft werken, en elke kaart die nu op de Home staat, blijft bereikbaar (als blok bovenaan of als venster achter een menu).
- Acties met een deadline (open stemming tribunaal/licht tribunaal/gele kaart, open claim op de bladzijde, gast vasthouden, veiling, uitdaging van de koploper, Hete Kroket vasthouden) staan als regel met knop in UW BEURT.
- Bestaande `action_id`'s blijven bestaan, zodat oude Home-weergaven en handlers blijven werken.
- Dashboard: geen nieuwe schrijfacties; alle bestaande knoppen en formulieren blijven bestaan (verhuizen mag), achter de bestaande Bearer-token-controle. Donker thema met de bestaande `:root`-tokens.
- Repo is openbaar: geen geheimen, echte namen of ids.
- Rooktests offline (`scripts/rooktest/README.md`); `regie-week.js` alleen met `ALLEEN=normaal|wild`.

## Review Focus

1. **Een kaart of knop verdwijnt.** Verwacht: een inventaristest die de oude secties/knoppen opsomt en voor elk aantoont waar hij nu zit (bovenkant of menu-optie -> venster). Task H2 en D2.
2. **Volle dag over de blokgrens.** Verwacht: < 60 blokken met alles aan (melding met extraBlocks, perkament, verrassing, zaak, raid, veiling, tribunaal, claims, gasten). Task H1/H2.
3. **Een deadline-actie in een menu.** Verwacht: een open stemming of claim staat als knop in UW BEURT. Task H1.
4. **Verbannen lid.** Verwacht: kop, verbannen-melding, VANDAAG, menu's; geen actieknoppen. Task H1.
5. **Dashboard: een knop is weg of doet iets anders.** Verwacht: dezelfde verzameling API-aanroepen (`/api/...`, acties) vóór en na. Task D2.

---

### Task H1: De bovenkant van de Home

**Files:** `index.js` (`bouwAppHomeBlocks` en helpers), `scripts/rooktest/home-indeling.js` (nieuw).
- Kop (bestaand blok "wie u bent", één section + voortgangscontext), melding (+ extraBlocks), perkament: zoals nu.
- VANDAAG: helper `vandaagBlokken(userId, nu)` uit `regieStaat()` (lopende effecten met eindtijd `hhmmAms`, verrassing, zaak, laatste ingreep van vandaag, heilige van de dag). Hoogstens 4 regels; leeg -> één stille regel.
- UW BEURT: helper `uwBeurtBlokken(userId, nu)`: opdrachten compact (één regel per opdracht met voortgang), "Op: …"-regel uit de bestaande `persoonlijkeStatus`, de bestaande actieknoppen (zelfde voorwaarden; raadpleeg erbij via `open_raadpleeg`), en de deadline-regels met hun bestaande knoppen (`tribunaal_voor/tegen`, `regie_zaak_*`, gele-kaartstemming als die knoppen heeft anders een link/uitleg, `claim_*`, `gast_vasthouden_*`, `veiling_bied_*`, `regie_uitdaging`, `regie_hete_kroket`).
- WEEKVIJAND: de bestaande raid-kaart, ingekort (kop + section + actions).
- Haal de oude losse kaarten "NU TE DOEN", "Raadpleeg", de los staande opdrachtenkaart (feature `opdrachten.home`), "ACTIEF OP U", gasten, veiling, premie, Zegezaal en de feature-kaarten nog NIET weg: dat doet H2. In H1 alleen de nieuwe bovenkant bovenaan zetten en wat er dubbel door ontstaat (raadpleeg, NU TE DOEN, actierij, opdrachten) verwijderen.
- [ ] Rooktest `home-indeling.js`: volgorde (kop < VANDAAG < UW BEURT < WEEKVIJAND); VANDAAG toont een gezet effect en een lopende verrassing; UW BEURT toont de opdrachten en de actieknoppen; een open licht tribunaal geeft `regie_zaak_*`-knoppen in UW BEURT; raid actief -> `bamischijf_aanval`; verbannen lid -> geen actieknoppen; stil -> de stille regel.
- [ ] Implementeer. `npm test`, de nieuwe rooktest en de bestaande rooktests die de Home lezen (`raadpleeg-home.js`, `raadpleeg-gevolgen.js`, `regie-toespraken.js`) groen. Commit.

### Task H2: De rest naar menu's en vensters

**Files:** `index.js` (`bouwAppHomeBlocks`, `NASLAG`, `bouwNaslagVenster`, `kapHomeBlocks`, een `app.action` voor de menu-selects), `scripts/rooktest/home-indeling.js` (uitbreiden).
- Vijf `static_select`'s in één actions-blok (`block_id: 'home_menus'`, action_ids `home_menu_spel|recht|status|rijk|commandos`). Een keuze opent `views.open` met het bijbehorende venster.
- Vensters (naslag-sleutels), elk met de inhoud van de oude kaart: Spellen (casino-stand/bonus/loterij, veiling, bingo, kroket van de dag, gasten, Aflatenhandel), Recht & Raad (bladzijde, wrok met `open_bede`/`sus_vete`, tribunaal-uitleg/stand, premie, verbonden), Mijn status (actief op u, sinds uw laatste bezoek, voorrechten, relikwieën, titels), Het Rijk (ranglijst, seizoen, Zegezaal, galerij, weefsel), Alle commando's (de bestaande commando-selects per categorie in één venster; een keuze werkt zoals nu via `home_cmd_kies_*`/`home_cmd_modal`).
- Haal de oude kaarten van de Home: gasten, veiling-kaart, premie, Zegezaal, de feature-`home`-kaarten (bladzijde, wrok, statusmeldingen, seizoen, opdrachten, tribunaal-waarschuwing), ACTIEF OP U, de rij naslagknoppen en de los staande commando-selects. Wat een deadline heeft, staat al in UW BEURT (H1). Ruim dode config op (`homeOrde` zonder `home`).
- `kapHomeBlocks`: offer eerst de menu's op, nooit de bovenkant (bovenkant gemarkeerd met een vaste `block_id`-prefix).
- [ ] Rooktest uitbreiden: inventaris van de oude secties en knoppen -> voor elk: blok bovenaan of menu-optie die een venster met die inhoud opent (`views.open` met verwachte tekst); volle dag < 60 blokken; elke menu-optie opent een venster zonder fout.
- [ ] Implementeer. `npm test` en alle rooktests groen. Commit.

### Task D1: Strook "Nu bezig" en de regisseur bovenaan

**Files:** `index.js` (`bouwDashboardData`: veld `nuBezig`), `dashboard.html`, `scripts/rooktest/regie-dashboard.js` (uitbreiden).
- `nuBezig`: `{ regie: { niveau, schatkist, ingrepenVandaag, effecten, verrassing, zaak }, raid: { actief, naam, hp, maxHp }, veiling: { open }, tribunaal: { fase }, gelekaart: { actief, sluitTs }, gokpauzes: n }` uit de bestaande state.
- Strook boven de tabs met per item een knop die een BESTAANDE actie aanroept (beëindig effect/verrassing/zaak, regisseur nu, niveau opslaan via de bestaande instellingen-POST, weekvijand beurt/afsluiten, veiling hamer). De oude regisseurkaart in Overzicht vervalt (de strook vervangt hem).
- [ ] Rooktest: `/api/stats` (of `bouwDashboardData`) bevat `nuBezig` met de verwachte velden bij een gezet effect, verrassing, zaak en actieve raid; `dashboard.html` bevat de strook en roept alleen bestaande acties aan.
- [ ] Implementeer. Commit.

### Task D2: Tabs met submenu, ontdubbelen

**Files:** `dashboard.html`, `scripts/rooktest/dashboard-indeling.js` (nieuw).
- Tabs: Overzicht, Spel, Recht, Verkondigen, Persona's, Systeem (zie spec). Per tab een rij chips die naar de kaarten springt; tab en kaart in de URL-hash (`#spel/casino`), en bij laden openen. `localStorage`-tab blijft als terugval.
- Splits de reuzenkaart Instellingen over de tabs; voeg casino-statistieken en -limieten samen, en Aflatenhandel-overzicht en -beheer; één activiteitsgrafiek in Overzicht (de dubbele weg).
- [ ] Rooktest `dashboard-indeling.js`: haal uit de oude `dashboard.html` (git show d031a64:dashboard.html) en de nieuwe de verzameling API-aanroepen (`/api/...`-paden en actienamen in `act('…')`/`post('…')`) en de formuliervelden (`id="i_…"`); de nieuwe bevat ze allemaal. Het inline script parseert (`new Function` of `node --check` op een geëxtraheerd bestand). De zes tabs bestaan, elke tab heeft chips.
- [ ] Implementeer. Bekijk het dashboard lokaal in de browser (lokale preview zonder token, zoals eerder) en maak een screenshot. Commit.

### Task E: Eindreview, samenvoegen, deploy

- [ ] Eindreview (opus) over H1-D2. Eén fix-ronde.
- [ ] Samenvoegen H en D, `npm test` en alle rooktests groen, md5-controle, deploy (index.js met de persona-fix, dashboard.html), herstart, log controleren.
