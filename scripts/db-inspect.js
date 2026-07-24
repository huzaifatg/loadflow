require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  console.log('DIRECT_URL:', process.env.DIRECT_URL?.replace(/:[^:@]+@/, ':***@'));
  
  const p = new PrismaClient();
  try {
    const result = await p.$queryRaw`SELECT 1 as ok`;
    console.log('Connection OK:', result[0].ok === 1 ? 'YES' : 'NO');
  } catch (e) {
    console.error('Connection FAILED:', e.message);
  } finally {
    await p.$disconnect();
  }
}
main();
