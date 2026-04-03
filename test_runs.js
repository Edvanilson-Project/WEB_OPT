const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otimiz_db', password: 'admin', port: 5432 });
(async () => {
  await client.connect();
  const res = await client.query("SELECT id, status, line_ids, total_vehicles, total_crew, total_cost, duration_ms, cct_violations FROM optimization_runs ORDER BY id DESC LIMIT 5;");
  console.log(res.rows);
  await client.end();
})();
