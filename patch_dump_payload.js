const fs = require('fs');
const fn = '/home/edvanilson/WEB_OPT/backend/src/modules/optimization/optimization.service.ts';
let code = fs.readFileSync(fn, 'utf-8');
code = code.replace(
  'result = await this._callOptimizerService(optimizerUrl, optimizerPayload);',
  `require('fs').writeFileSync('/tmp/optimizer_payload.json', JSON.stringify(optimizerPayload, null, 2));\n            result = await this._callOptimizerService(optimizerUrl, optimizerPayload);`
);
fs.writeFileSync(fn, code);
