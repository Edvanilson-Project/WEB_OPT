const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otmiz_new', password: 'admin', port: 5432 });
async function check() {
  try {
    await client.connect();
    const res = await client.query("SELECT result_summary->'blocks' as blocks FROM optimization_runs WHERE id = 476");
    const blocks = res.rows[0].blocks;
    
    let shortBlocks = 0;
    let normalBlocks = 0;
    const sample = [];
    
    for (const b of blocks) {
      const spreadMin = b.spread_minutes || 0;
      if (spreadMin < 360) shortBlocks++;
      else normalBlocks++;
      
      if (sample.length < 10) {
         sample.push({
           block_id: b.block_id,
           trips: b.num_trips,
           spread: spreadMin,
           idle: b.idle_minutes,
           start: b.start_time,
           end: b.end_time
         });
      }
    }
    
    console.log(`Short blocks (< 6h spread): ${shortBlocks}`);
    console.log(`Normal blocks (>= 6h spread): ${normalBlocks}`);
    console.table(sample);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
check();
