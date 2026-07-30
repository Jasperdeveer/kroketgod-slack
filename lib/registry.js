// ── Feature-registry ───────────────────────────────────────────────────────────
// Features declareren naast hun eigen code wat ze nodig hebben; de afgeleide lijsten (backup,
// help, App Home) worden hieruit opgebouwd. Aanleiding: zestien state-bestanden vielen buiten
// de backup — waaronder de veiling-escrow — omdat registreren op vijf plekken duizenden regels
// uit elkaar gebeurde.
//
// Deze module heeft opzettelijk geen enkele afhankelijkheid, zodat hij als eerste geladen kan
// worden. Dat is ook nodig: als de FEATURES-declaratie later komt dan de registratie-aanroepen,
// crasht de bot op een temporal dead zone ("Cannot access 'FEATURES' before initialization").

const FEATURES = [];

function registreerFeature(feature) {
  FEATURES.push(feature);
  return feature;
}

module.exports = {
  FEATURES,
  registreerFeature,
};
