import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Security: Production Guard ──────────────────────────────────────────────
// This endpoint executes a seed script via child_process.exec().
// It MUST be restricted to non-production environments and validated callers.

export async function POST(request: Request) {
  // ── Environment Guard ──────────────────────────────────────────────────
  // Block this endpoint entirely in production unless explicitly enabled.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RESET !== 'true') {
    return NextResponse.json(
      { error: 'Demo reset is disabled in production.' },
      { status: 403 },
    );
  }

  // ── Secret Validation ──────────────────────────────────────────────────
  // Requires a valid Bearer token matching the DEMO_RESET_SECRET env var.
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.DEMO_RESET_SECRET;

  if (!secret || secret.length < 16) {
    console.error('[SECURITY] DEMO_RESET_SECRET is missing or too short (min 16 chars).');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── Execute Seed Script ────────────────────────────────────────────
    // The command is hardcoded — no user input is interpolated.
    const { stdout, stderr } = await execAsync('npx tsx scripts/seed-demo-data.ts', {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 60_000, // 60-second timeout to prevent hung processes
    });

    if (stderr && !stderr.includes('warn')) {
      console.warn('Seed script stderr:', stderr);
    }

    // Do not leak stdout in production responses
    return NextResponse.json({
      success: true,
      message: 'Demo environment reset successfully',
      ...(process.env.NODE_ENV !== 'production' ? { output: stdout } : {}),
    });
  } catch (error: unknown) {
    console.error('Demo reset failed:', error);
    // Do not leak error details in production
    return NextResponse.json(
      {
        error: 'Failed to reset demo environment',
        ...(process.env.NODE_ENV !== 'production' && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 },
    );
  }
}
