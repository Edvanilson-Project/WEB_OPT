const http = require('http');
function request({ method='GET', path='/', token, body }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ hostname: '127.0.0.1', port: 3001, path, method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (res) => {
      let raw = ''; res.on('data', (chunk) => raw += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
(async () => {
  const login = await request({ method:'POST', path:'/api/v1/auth/login', body:{ email:'admin@otimiz.com', password:'123456' } });
  
  if (!login.data.accessToken) {
    console.log("Login failed", login);
    return;
  }
  
  const linesReq = await request({ path:'/api/v1/lines', token: login.data.accessToken });
  const lines = linesReq.data?.data || [];
  
  for (const line of lines) {
    const trips = await request({ path:`/api/v1/trips?lineId=${line.id}&limit=5000`, token: login.data.accessToken });
    if (trips.data?.data) {
       const t = trips.data.data.sort((a,b)=>a.startTimeMinutes - b.startTimeMinutes);
       let shortGaps = 0;
       for(let i=0; i<t.length-1; i++) {
          if(t[i].destinationTerminalId === 1 && t[i+1].originTerminalId === 1) {
             const gap = t[i+1].startTimeMinutes - t[i].endTimeMinutes;
             if(gap >= 0 && gap < 15) {
                shortGaps++;
             }
          }
       }
       if (shortGaps > 0) {
           console.log(`Line ${line.id} - ${line.name}: short gaps (< 15m) = ${shortGaps}`);
       }
    }
  }
  console.log("Done");
})();
