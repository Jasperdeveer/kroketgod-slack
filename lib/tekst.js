// ── Tekstbewerking op LLM-uitvoer ──────────────────────────────────────────────
// Pure functies zonder projectstate: afgekapte zinnen netjes afsluiten, hoofdletterspam
// herkennen en de ondertekening van de Kroket God normaliseren.

// Detecteert of een tekst grotendeels in hoofdletters is (zoals 8B-model output)
function isHoofdletterSpam(tekst) {
  if (!tekst || tekst.length < 30) return false;
  const letters = tekst.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 20) return false;
  const hoofdletters = letters.replace(/[^A-Z]/g, '').length;
  return (hoofdletters / letters.length) > 0.65; // meer dan 65% hoofdletters = fout
}

// Bekende afkortingen die op een punt eindigen — een punt hierachter is GEEN zinseinde. Zonder
// deze lijst zou een afgekapte "…uw bondgenoot Mr." als "afgeronde zin" gelden en bleef de halve
// zin staan (precies de bug die we zagen).
const AFKORTING_VOOR_PUNT = /(?:^|[\s(«"'([])(bijv|bv|nr|dhr|mevr|mej|mr|mrs|ms|dr|drs|ir|mw|prof|ing|enz|etc|blz|pag|vgl|zgn|ca|resp|incl|excl|max|min|tel|o\.a|t\.o\.v|a\.u\.b|z\.o\.z|i\.p\.v|d\.w\.z|m\.a\.w|e\.d|n\.a\.v|i\.v\.m|d\.d)\.?$/i;

// Kapt een (door de tokenlimiet) afgebroken respons netjes af op de laatste volledige zin, zodat de
// Kroket God nooit een halve zin de wereld in stuurt. In plaats van blind op het laatste leesteken
// te knippen (dan blijft een afgekapte "…Mr." staan), zoekt hij ECHTE zinsgrenzen: een . ! ? …
// gevolgd door witruimte, en niet direct achter een afkorting. Eindigt de tekst zelf al op een echt
// zinseinde, dan blijft hij ongemoeid. Vindt hij geen bruikbare grens (heel korte respons), dan laat
// hij de tekst staan — liever een korte gedachte dan niets.
function kapAfOpZinsgrens(tekst) {
  if (!tekst || typeof tekst !== 'string') return tekst;
  const s = tekst.trimEnd();
  if (s.length < 15) return s;
  // Verzamel alle ÉCHTE zinsgrenzen: leesteken(s) + optionele sluit-aanhaling, gevolgd door
  // witruimte, waarbij het leesteken niet direct op een afkorting volgt.
  const grenzen = [];
  const re = /[.!?…]+["'”’)\]]?(?=\s)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (AFKORTING_VOOR_PUNT.test(s.slice(0, m.index))) continue; // afkorting → geen zinsgrens
    grenzen.push(m.index + m[0].length);
  }
  // Eindigt de tekst zelf al op een echt zinseinde (leesteken, geen afkorting)? Dan niets afgekapt.
  // Strip ook afsluitende markdown-tekens (*_~`) — "…gesproken._" is een compleet einde.
  const kern = s.replace(/["'”’)\]*_~`]+$/, '');
  if (/[.!?…]$/.test(kern) && !AFKORTING_VOOR_PUNT.test(kern.slice(0, -1))) return s;
  // Anders: terugknippen tot de laatste volledige zin.
  if (grenzen.length) {
    const geknipt = s.slice(0, grenzen[grenzen.length - 1]).trimEnd();
    if (geknipt.length >= 15) return geknipt;
  }
  return s; // geen bruikbare grens → liever de (afgekapte) tekst dan een leeg bericht
}

// Normaliseer ondertekening — de Kroket God ondertekent ALTIJD als "De Almachtige Kroket God"
function normaliseerOndertekening(tekst) {
  if (!tekst) return tekst;
  // Vang elke variatie van "— [evt. de] [evt. bijvoeglijke naamwoorden] Kroket God", maar
  // ALLEEN als handtekening: verankerd op het einde van een regel ($ met m-flag). Zonder anker
  // herschreef dit ook lopende tekst ("— de tempel van de Kroket God staat centraal") en de
  // vaste EER-footer ("— _De Kroket God heeft gesproken_ …").
  return tekst.replace(
    /([—–-])\s*(?:de\s+)?(?:\w+\s+){0,4}kroket\s*god\b\.?\s*$/gim,
    '$1 De Almachtige Kroket God'
  );
}

module.exports = { isHoofdletterSpam, kapAfOpZinsgrens, normaliseerOndertekening, AFKORTING_VOOR_PUNT };
