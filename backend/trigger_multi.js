const http = require('http');

const data = JSON.stringify({
  companyId: 1,
  lineIds: [1, 2, 4, 3, 5, 6, 7], // or whatever the line IDs are
  algorithm: 'full_pipeline',
  vspParams: { timeBudgetSeconds: 30 }
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3001,
  path: '/optimization/run',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  res.on('data', chunk => process.stdout.write(chunk));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
