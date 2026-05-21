const { Pool } = require('pg');

async function testConnection(url, ssl) {
  const pool = new Pool({ 
    connectionString: url,
    ssl: ssl ? { rejectUnauthorized: false } : false
  });
  
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`Success with SSL=${ssl}:`, res.rows[0]);
  } catch (err) {
    console.error(`Error with SSL=${ssl}:`, err.message);
  } finally {
    await pool.end();
  }
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("No DATABASE_URL");
    return;
  }
  
  console.log("Testing:", url);
  await testConnection(url, false);
  await testConnection(url, true);
}

run();
