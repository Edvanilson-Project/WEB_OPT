const { Client } = require('pg');
const client = new Client({ user: 'postgres', database: 'otmiz_new', password: 'admin' });
(async () => {
    await client.connect();
    const res = await client.query(`
        SELECT start_time, end_time FROM trips 
        WHERE line_id IN (6,7,8,9,10,11,12)
    `);
    const events = [];
    for (const t of res.rows) {
        events.push({t: t.start_time, type: 1});
        events.push({t: t.end_time, type: -1});
    }
    events.sort((a,b) => a.t === b.t ? a.type - b.type : a.t - b.t);
    let max = 0, current = 0;
    for (const e of events) {
        current += e.type;
        if (current > max) max = current;
    }
    console.log("MAX CONCURRENT TRIPS (Peak Vehicles):", max);
    await client.end();
})();
