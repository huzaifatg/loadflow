import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/security';
import {
  getOperationalExceptions,
  summarizeExceptions,
} from '@/lib/services/operational-exceptions';
import {
  listRecentCompanyActivity,
  NOTIFIABLE_ACTIVITY_TYPES,
} from '@/lib/services/activity';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const [exceptions, activities, stateRecord] = await Promise.all([
      getOperationalExceptions(prisma, auth.companyId),
      listRecentCompanyActivity(prisma, auth.companyId, {
        types: NOTIFIABLE_ACTIVITY_TYPES,
        take: 15,
      }),
      prisma.notificationState
        .findUnique({
          where: {
            companyId_userId: {
              companyId: auth.companyId,
              userId: auth.userId,
            },
          },
        })
        .catch(() => null),
    ]);

    const lastReadAt = stateRecord?.lastReadAt ?? null;
    const summary = summarizeExceptions(exceptions);

    const formattedActivities = activities.map((evt) => {
      const isUnread =
        evt.actorId !== auth.userId &&
        (!lastReadAt || new Date(evt.createdAt) > new Date(lastReadAt));
      const href =
        evt.entityType === 'LOAD_PLAN'
          ? `/loads/${evt.entityId}`
          : `/deliveries/${evt.entityId}`;
      return {
        id: evt.id,
        entityType: evt.entityType,
        entityId: evt.entityId,
        type: evt.type,
        message: evt.message,
        actorLabel: evt.actorLabel,
        createdAt: evt.createdAt,
        href,
        unread: isUnread,
      };
    });

    const unreadActivityCount = formattedActivities.filter((a) => a.unread).length;

    return NextResponse.json({
      exceptions: exceptions.slice(0, 12),
      exceptionSummary: summary,
      activities: formattedActivities,
      unreadActivityCount,
      badgeCount: summary.critical + summary.warning + unreadActivityCount,
      lastReadAt,
    });
  } catch (error) {
    console.error('[notifications_GET]', error);
    return NextResponse.json(
      { error: 'Failed to load operational notifications.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const now = new Date();
    await prisma.notificationState
      .upsert({
        where: {
          companyId_userId: {
            companyId: auth.companyId,
            userId: auth.userId,
          },
        },
        create: {
          companyId: auth.companyId,
          userId: auth.userId,
          lastReadAt: now,
        },
        update: {
          lastReadAt: now,
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, lastReadAt: now.toISOString() });
  } catch (error) {
    console.error('[notifications_POST]', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read.' },
      { status: 500 }
    );
  }
}

