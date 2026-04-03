const http = require('http');
function request({ method='GET', path='/', token, body }) {
  return new Promise((resolve, reject) => {
    let opts = { hostname: '127.0.0.1', port: 3001, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
       const data = JSON.stringify(body);
       opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(opts, (res) => {
      let raw = ''; res.on('data', (chunk) => raw += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
(async () => {
  const login = await request({ method:'POST', path:'/api/v1/auth/login', body:{ email:'admin@otimiz.com', password:'123456' } });
  const optRequest = {
    companyId: 1, lineIds: [6, 7, 8, 9, 10, 11, 12],
    lineId: null,
    activeSettings: {
        timeBudgetSeconds: 300,
        cctNocturnalFactor: 0.875,
        minWorkMinutes: 360,
        fixedVehicleActivationCost: 3000,
        allowVehicleSplitShifts: true,
        useSetCovering: false,
        pricingEnabled: false
    },
    cspParams: {
        operatorSingleVehicleOnly: true,
        breakMinutes: 20,
    },
    vspParams: {
        timeBudgetSeconds: 300
    },
    mode: 'both',
    algorithm: 'hybrid_pipeline'
  };
  const res = await request({ method:'POST', path:'/api/v1/optimization/run', token: login.data.accessToken, body: optRequest });
  console.log("Opt Trigger Status:", res.status);
  console.log("Opt Trigger Data:", res.data);
})();
