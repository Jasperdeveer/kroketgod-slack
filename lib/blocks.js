// ── Block Kit-opmaak ───────────────────────────────────────────────────────────
// Slack rendert Block Kit met zijn eigen opmaak; CSS is niet mogelijk. De visuele taal van het
// web-dashboard wordt daarom nagebootst met monospace codeblokken: uitgelijnde kaarten en
// balkgrafieken. Pure functies — string in, string uit.

function hpBalk(hp, maxHp) {
  const blokken = 10;
  const vol = Math.round((Math.max(0, hp) / Math.max(1, maxHp)) * blokken);
  return `[${'▓'.repeat(vol)}${'░'.repeat(blokken - vol)}]`;
}

// Uitgelijnde sleutel/waarde-regels — de tegenhanger van een dashboard-kaart.
function homeTabel(paren) {
  const w = Math.max(...paren.map(([l]) => l.length));
  return '```\n' + paren.map(([l, v]) => `${l.padEnd(w)}  ${v}`).join('\n') + '\n```';
}

// Horizontale balkgrafiek — de Block Kit-tegenhanger van de dashboard-hbars: label,
// proportionele balk (t.o.v. de hoogste waarde) en het getal.
function homeBalken(rijen, breedte = 12) {
  if (!rijen.length) return '_geen data_';
  const max = Math.max(1, ...rijen.map(r => r.waarde));
  const lw = Math.min(26, Math.max(...rijen.map(r => r.label.length)));
  return '```\n' + rijen.map(r => {
    const vol = Math.max(1, Math.round((Math.max(0, r.waarde) / max) * breedte));
    const label = (r.label.length > lw ? `${r.label.slice(0, lw - 1)}…` : r.label).padEnd(lw);
    return `${label} ${'▓'.repeat(vol)}${'░'.repeat(Math.max(0, breedte - vol))} ${String(r.waarde).padStart(3)}`;
  }).join('\n') + '\n```';
}

// Voortgangsbalk naar een doel (bv. de volgende rang) — anders dan homeBalken, waar de
// balken relatief zijn t.o.v. de hoogste waarde, is deze absoluut: waarde/doel.
function homeVoortgang(label, waarde, doel, breedte = 14) {
  const vol = Math.max(0, Math.min(breedte, Math.round((Math.max(0, waarde) / Math.max(1, doel)) * breedte)));
  return '```\n' + `${label}  ${'▓'.repeat(vol)}${'░'.repeat(breedte - vol)}  ${waarde}/${doel}` + '\n```';
}

// Compacte voortgang voor gebruik ín een tekstregel (niet in een codeblok, want daar zou de
// omringende tekst mee in monospace gaan). Vaste breedte, dus lijstjes blijven rustig.
function homeVoortgangInline(waarde, doel, breedte = 5) {
  const vol = Math.max(0, Math.min(breedte, Math.round((Math.max(0, waarde) / Math.max(1, doel)) * breedte)));
  return `\`${'▓'.repeat(vol)}${'░'.repeat(breedte - vol)}\` *${waarde}/${doel}*`;
}

// Ladingmeter voor een limiet met losse "beurten": ▓ = nog beschikbaar, ░ = verbruikt. Anders dan
// hpBalk (vaste tien blokken, proportioneel) is dit een blokje PER beurt, want bij 2 van 3 duels
// wil je drie hokjes zien en niet een balk die voor tweederde vol staat.
// Boven METER_MAX beurten wordt de rij onleesbaar breed; dan liever niets dan een muur van blokjes.
const METER_MAX = 8;
function ladingMeter(gebruikt, limiet, breedte = 0) {
  const lim = Number.isFinite(limiet) ? Math.floor(limiet) : 0;
  if (lim <= 0 || lim > METER_MAX) return ''.padEnd(breedte);
  // gebruikt kan de limiet overschrijden als die tussentijds daalde (rang kwijt, zegen verlopen).
  const op = Math.max(0, Math.min(lim, Math.floor(gebruikt) || 0));
  return `${'▓'.repeat(lim - op)}${'░'.repeat(op)}`.padEnd(breedte);
}

// Kaarttitel in de stijl van de dashboard-kaartkoppen (h2): scheidingslijn + vette kop.
function homeKaartKop(titel) {
  return [
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*${titel}*` } },
  ];
}

module.exports = { hpBalk, homeTabel, homeBalken, homeVoortgang, homeVoortgangInline, ladingMeter, METER_MAX, homeKaartKop };
