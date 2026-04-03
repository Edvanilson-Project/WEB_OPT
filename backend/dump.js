const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otmiz_new', password: 'admin', port: 5432 });
(async () => {
    await client.connect();
    const res = await client.query('SELECT result_summary FROM optimization_runs WHERE id=487');
    if (res.rows.length) {
        console.log(JSON.stringify(res.rows[0].result_summary.meta.csp, null, 2));
    }
    await client.end();
})();
