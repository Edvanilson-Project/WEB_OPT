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
  
  const tripsReq = await request({ path:'/api/v1/trips?lineId=6&limit=5000', token: login.data.accessToken });
  const trips = tripsReq.data?.data || [];
  
  if(trips.length > 0) {
      let events = [];
      trips.forEach(t => {
          events.push({ time: t.startTimeMinutes, type: 1 }); // Start
          let endTime = t.endTimeMinutes;
          // Apply the 15 min rule: If it ends at terminal 1, reserve 15 more minutes
          if (t.destinationTerminalId === 1) {
             endTime += 15;
          }
          events.push({ time: endTime, type: -1 });  // End
      });
      events.sort((a,b) => {
          if (a.time === b.time) return a.type - b.type; // End before start to prevent artificial peak
          return a.time - b.time;
      });
      let currentPeak = 0;
      let maxPeak = 0;
      events.forEach(e => {
          currentPeak += e.type;
          if (currentPeak > maxPeak) maxPeak = currentPeak;
      });
      console.log(`Peak concurrency with 15m layover at Terminal 1: ${maxPeak}`);
  }
})();
