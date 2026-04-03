const fs = require('fs');
const file = 'backend/src/modules/optimization/optimization.service.ts';
let code = fs.readFileSync(file, 'utf8');

// The logical modification to cleanly support the user's scenario.
// We intercept cctBase creation to inject 7h20 + 2h = 560 exactly if settings aren't strict.
// And we add a boolean rule to force Split Shift / Single Shift if desired.

code = code.replace(
  'max_shift_minutes:    activeSettings?.cctMaxShiftMinutes    ?? 840,',
  `max_shift_minutes:    activeSettings?.cctMaxShiftMinutes    ?? ((dto.cspParams as any)?.singleShiftOnly ? 620 : 840),`
);

code = code.replace(
  'max_work_minutes:     activeSettings?.cctMaxWorkMinutes     ?? 560,',
  `// Force 560 (9h20) max work if not strictly overriden in DB
          max_work_minutes:     activeSettings?.cctMaxWorkMinutes     ?? 560,`
);

fs.writeFileSync(file, code);
