const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otimiz_db', password: 'admin', port: 5432 });
async function check() {
  try {
    await client.connect();
    const res = await client.query("SELECT id, status, total_vehicles as veh, total_crew as crew, error_message, result_summary->'meta' as meta FROM optimization_runs ORDER BY id DESC LIMIT 5");
    console.table(res.rows.map(r => ({
      id: r.id, status: r.status, veh: r.veh, crew: r.crew,
      error: r.error_message ? r.error_message.substring(0, 60) : null
    })));
  } catch (e) { console.error(e); } finally { await client.end(); }
}
check();
