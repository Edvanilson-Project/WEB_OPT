const http = require('http');
function request({ method='GET', path='/', token, body }) {
  return new Promise((resolve, reject) => {
    let opts = { hostname: '127.0.0.1', port: 3001, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let raw = ''; res.on('data', (chunk) => raw += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, data: raw }); } });
    });
    req.on('error', reject);
    req.end();
  });
}
(async () => {
  const login = await request({ method:'POST', path:'/api/v1/auth/login', body:{ email:'admin@otimiz.com', password:'123456' } });
  const lines = [5, 11, 23, 26, 27, 43, 44];
  let allTrips = [];
  for (let l of lines) {
     const t = await request({ path:`/api/v1/trips?lineId=${l}&limit=5000`, token: login.data.accessToken });
     if (t.data?.data) allTrips = allTrips.concat(t.data.data);
  }
  
  if(allTrips.length > 0) {
      let events = [];
      allTrips.forEach(t => {
          events.push({ time: t.startTimeMinutes, type: 1 });
          events.push({ time: t.endTimeMinutes, type: -1 });  
      });
      events.sort((a,b) => {
          if (a.time === b.time) return a.type - b.type;
          return a.time - b.time;
      });
      let peak = 0, maxPeak = 0;
      events.forEach(e => { peak += e.type; if (peak > maxPeak) maxPeak = peak; });
      console.log(`Peak concurrency WITHOUT 15m layover: ${maxPeak}`);

      events = [];
      allTrips.forEach(t => {
          events.push({ time: t.startTimeMinutes, type: 1 });
          let end = t.endTimeMinutes;
          if (t.destinationTerminalId === 1) end += 15;
          events.push({ time: end, type: -1 });  
      });
      events.sort((a,b) => {
          if (a.time === b.time) return a.type - b.type;
          return a.time - b.time;
      });
      peak = 0; maxPeak = 0;
      events.forEach(e => { peak += e.type; if (peak > maxPeak) maxPeak = peak; });
      console.log(`Peak concurrency WITH 15m layover at Terminal 1: ${maxPeak}`);
  }
})();
