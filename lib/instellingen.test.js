// Tests voor de instellingen: alleen het regie-niveau (de regisseur). Run: `npm test`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.KROKET_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'instellingen-'));
const { STANDAARD_INSTELLINGEN, saveInstellingen, instelling } = require('./instellingen.js');

test('regieNiveau staat standaard op normaal', () => {
  assert.equal(STANDAARD_INSTELLINGEN.regieNiveau, 'normaal');
  assert.equal(instelling('regieNiveau'), 'normaal');
});

test('regieNiveau accepteert uit, laag, normaal en wild', () => {
  for (const n of ['uit', 'laag', 'wild', 'normaal']) {
    saveInstellingen({ regieNiveau: n });
    assert.equal(instelling('regieNiveau'), n);
  }
});

test('regieNiveau weigert waarden buiten de vier niveaus', () => {
  saveInstellingen({ regieNiveau: 'laag' });
  for (const slecht of ['extreem', '', 'WILD', 5, null]) {
    saveInstellingen({ regieNiveau: slecht });
    assert.equal(instelling('regieNiveau'), 'laag', `${String(slecht)} had geweigerd moeten worden`);
  }
});
