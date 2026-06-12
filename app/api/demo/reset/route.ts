import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  // Validate authorization
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.DEMO_RESET_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run the seed script to clean up and re-create demo data
    // We use npx tsx to execute the typescript file
    const { stdout, stderr } = await execAsync('npx tsx scripts/seed-demo-data.ts', {
      cwd: process.cwd(),
      env: { ...process.env }
    });

    if (stderr && !stderr.includes('warn')) {
      console.warn('Seed script stderr:', stderr);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Demo environment reset successfully',
      output: stdout
    });
  } catch (error: any) {
    console.error('Demo reset failed:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset demo environment',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
