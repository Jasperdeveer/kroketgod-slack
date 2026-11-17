# Dashboard 2.0, implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Het eigenaarsdashboard wordt een app: secties in een zijbalk (desktop) of tabbalk onderin (telefoon), per sectie cijfertegels, grafieken en uitklapbare bediening, gevuld met echte data.

**Architecture:** `dashboard.html` wordt herschreven naar het goedgekeurde ontwerp (de mockup), met dezelfde endpoints (`/api/stats`, `/api/actie`, `/api/instellingen`, `/api/verkondig`, persona- en ban-endpoints) en dezelfde acties. `bouwDashboardData` krijgt een veld `reeksen` met tijdreeksen voor de grafieken, berekend uit bestaande statebestanden; wat nergens bewaard wordt (Schatkist per dag, HP van de weekvijand per dag), komt in de dagstand van `puntenhistorie.json`.

**Tech Stack:** Node 20, plain HTML/JS met handgeschreven inline SVG-grafieken (geen bibliotheek, geen CDN), `node:test`, rooktest-harnas.

**Spec:** de goedgekeurde mockup `docs/superpowers/specs/2026-11-18-dashboard-v2-mockup.html` (eigenaar: "Bouw het zo", 18 nov) en de sectie "Ontwerp: het dashboard" in `docs/superpowers/specs/2026-11-17-home-dashboard-herindeling-design.md` (strook Nu bezig, niets kwijt).

## Global Constraints

- Zeven secties zoals de mockup: Live, Spelers, Economie, Casino, Regie, Vijand, Systeem; dezelfde grafieken, tegels en panelen; dezelfde kleurtokens; elke grafiek met tooltip en een "Tabel"-weergave.
- **Niets kwijt:** elke knop, elk formulierveld (`id="i_…"`), elke `/api/...`-aanroep en elke actienaam uit de huidige `dashboard.html` (commit b8ebc84) bestaat ook in de nieuwe (de inventaristest `scripts/rooktest/dashboard-indeling.js` blijft groen, aangepast aan de nieuwe structuur).
- Geen nieuwe schrijfacties; alles achter de bestaande Bearer-token-controle; het inlogscherm blijft werken.
- Werkt op 375 px breed zonder horizontaal scrollen; donker thema met `:root`-tokens; `localStorage` alleen in try/catch (token en laatste sectie), sectie in de URL-hash.
- Verversen elke 15 s zonder invoer te wissen (formulieren niet opnieuw opbouwen).
- Ontbrekende data: een grafiek zonder punten toont een nette lege toestand ("nog geen data, vult zich vanaf vandaag"), nooit een fout.
- Repo openbaar: geen echte namen of ids in tests of fixtures.

## Review Focus

1. Een knop of veld verdwijnt (inventaristest).
2. Verversen wist wat de eigenaar typt (persona, verkondigen, test-console, instellingen).
3. Grafiek met lege of korte reeks crasht of toont onzin.
4. `reeksen` gooit bij een ontbrekend statebestand.
5. Telefoonbreedte: horizontaal scrollen of onbereikbare knoppen.

---

### Task DB1: Tijdreeksen voor de grafieken
**Files:** `index.js` (`bouwDashboardData` -> `reeksen`), `lib/puntenhistorie.js` (dagstand uitbreiden met `schatkist` en `raid: { key, hp, maxHp }`), tests.
- `reeksen`: punten per lid per dag (deze week, uit puntenhistorie), activiteit per lid per weekdag (archief), kaarten per lid deze maand (geleKaarten), Schatkist per dag (21 dagen, uit de dagstand), gegeven/genomen per dag (regie-log, 21 dagen), ingrepen per dag per soort en per id (regie-log), verrassingen deze week, Aflatenhandel-omzet per item, casino ingezet/uitbetaald/huiswinst per dag (14 dagen, uit wat casinostats bewaart; bekijk het bestand), spellen per soort, grootste winnaars/verliezers deze week, weekvijand HP per dag + schade per strijder + wapens, LLM-verbruik per dag per provider (llmstats). Alles met lege standaardwaarden als een bestand ontbreekt.
- [ ] Unittests voor elke afleiding die puur te maken is (in een `lib/`-module), rooktest dat `bouwDashboardData().reeksen` bestaat en de verwachte vormen heeft bij lege en gevulde state.

### Task DB2: Het nieuwe dashboard.html
**Files:** `dashboard.html`, `scripts/rooktest/dashboard-indeling.js`.
- Port de mockup naar echte data: dezelfde schil, secties, tegels, grafieken (SVG-helpers uit de mockup), panelen; alle bestaande bediening en formulieren uit de huidige `dashboard.html` verhuizen naar de sectie waar ze horen (Live: regisseur, effecten, verrassing, zaak, weekvijand-knoppen, veiling, gele kaart; Spelers: scorebeheer, bans, verbonden; Economie: power-ups/Aflatenhandel-beheer; Casino: limieten, bonus, gokpauzes; Regie: niveau, effecten; Vijand: opkomen/spotten/beurt/afsluiten, veiling; Systeem: instellingen, verkondigen + geplande posts, persona's, test-console, LLM, logs).
- [ ] Inventaristest groen; script parseert; zeven secties; elke grafiek rendert met lege én gevulde `reeksen`.
- [ ] Bekijk het lokaal met een dump van `bouwDashboardData` (desktop + 375 px) en maak screenshots.
