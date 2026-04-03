const http = require('http');
function request({ method='GET', path='/', token, body }) { return new Promise((resolve, reject) => { const data = body ? JSON.stringify(body) : null; const req = http.request({ hostname:'127.0.0.1', port:3001, path, method, headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(data ? {'Content-Length':Buffer.byteLength(data)} : {})}}, (res) => { let raw=''; res.on('data', (c)=>raw+=c); res.on('end', ()=>{ try{resolve({status:res.statusCode,data:JSON.parse(raw)})}catch{resolve({status:res.statusCode,data:raw})}}); }); req.on('error', reject); if (data) req.write(data); req.end(); }); }
(async () => {
  const login = await request({ method:'POST', path:'/api/v1/auth/login', body:{ email:'admin@otimiz.com', password:'123456' } });
  const token = login.data?.accessToken;
  const launch = await request({ method:'POST', path:'/api/v1/optimization/run', token, body:{
    companyId:1,
    lineIds:[6,7,8,9,10,11,12],
    algorithm:'hybrid_pipeline',
    vspParams:{ maxVehicles:120, fixedVehicleActivationCost:3000, maxConnectionCostForReuseRatio:10.0, max_vehicle_shift_minutes:1440, preserve_preferred_pairs:false },
    cspParams:{ fairnessWeight:0.8, fairnessTargetWorkMinutes:420, strictHardValidation:true }
  }});
  console.log('RUN', launch.data?.id);
})();
