const { Client } = require('pg');

const regions = [
  'eu-central-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1'
];

const ref = 'hmbvqqnjkwupkclenflf';
const password = 'aRJXGvtovPyv1hT8'; // Extracted from current .env.local

async function findRegion() {
  console.log('Testing regions for Supavisor Pooler...');
  for (const region of regions) {
    const url = `postgresql://postgres.${ref}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres?sslmode=require`;
    
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      console.log(`\nSUCCESS! Region found: ${region}`);
      console.log(`Pooler URL: ${url}`);
      await client.end();
      return url;
    } catch (e) {
      process.stdout.write('.');
    }
  }
  console.log('\nCould not find a working pooler region.');
  return null;
}

findRegion();
