const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'otmiz_new', password: 'admin', port: 5432 });
async function check() {
  try {
    await client.connect();
    const res = await client.query("SELECT id, status, total_vehicles as veh, total_crew as crew, result_summary->'duties' as duties FROM optimization_runs WHERE id = 476");
    if (res.rows.length === 0) return console.log("Run not found");
    const duties = res.rows[0].duties;
    if (!duties) return console.log("No duties found");
    
    console.log(`Run 476: ${res.rows[0].veh} veh, ${res.rows[0].crew} crew`);
    
    let shortDuties = 0;
    let normalDuties = 0;
    const sample = [];
    
    for (const d of duties) {
      const workMin = d.work_time || 0;
      const spreadMin = d.spread_time || 0;
      const blocks = d.blocks ? d.blocks.length : 0;
      if (workMin < 360) shortDuties++;
      else normalDuties++;
      
      if (sample.length < 10) {
         sample.push({
           duty_id: d.duty_id,
           work: workMin,
           spread: spreadMin,
           blocks: d.blocks ? d.blocks.join(',') : '',
         });
      }
    }
    
    console.log(`Short duties (< 6h work): ${shortDuties}`);
    console.log(`Normal duties (>= 6h work): ${normalDuties}`);
    console.table(sample);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
check();
