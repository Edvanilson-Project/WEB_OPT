const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otimiz_db', password: 'admin', port: 5432 });
(async () => {
  await client.connect();
  const res = await client.query("SELECT id, name FROM lines WHERE id IN (5, 11, 23, 26, 27, 43, 44);");
  console.log(res.rows);
  await client.end();
})();
