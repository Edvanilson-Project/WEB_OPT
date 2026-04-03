const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend/src/modules/optimization/optimization.service.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /max_work_minutes:\s+activeSettings\?.cctMaxWorkMinutes\s+\?\?\s+560,/,
  'max_work_minutes: activeSettings?.cctMaxWorkMinutes ?? (cctBase.max_shift_minutes === 620 ? 440 : 440),' // if max is 620, base is 440. Actually, just ALWAYS send base 440 since max_shift handles spread limit.
);

fs.writeFileSync(file, content);
