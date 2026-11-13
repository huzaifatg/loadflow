import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePublicTrackingByToken } from '@/lib/services/tracking'

const PUBLIC_TRACKING_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

// ─── GET /api/public/tracking/[token] ────────────────────────────────────────
// Unauthenticated, privacy-protected public tracking endpoint.
// Never exposes internal UUIDs, company IDs, driver PII, or internal notes.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const result = await resolvePublicTrackingByToken(prisma, token)

    if (!result.ok) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: result.reason,
            message: result.message,
          },
        },
        {
          status: result.status,
          headers: PUBLIC_TRACKING_HEADERS,
        }
      )
    }

    return NextResponse.json(
      {
        data: result.data,
        error: null,
      },
      {
        status: 200,
        headers: PUBLIC_TRACKING_HEADERS,
      }
    )
  } catch (error) {
    console.error('GET /api/public/tracking/[token] error:', error)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'SERVER_ERROR',
          message: 'Unable to load shipment tracking information right now.',
        },
      },
      {
        status: 500,
        headers: PUBLIC_TRACKING_HEADERS,
      }
    )
  }
}
