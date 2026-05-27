import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const company = auth.company;
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Company name is required' } },
        { status: 400 }
      );
    }

    const dataPayload = {
      name: body.name.trim(),
      timezone: body.timezone,
      units: body.units,
      emailNotifications: body.emailNotifications,
      dispatchAlerts: body.dispatchAlerts,
      weeklyReport: body.weeklyReport,
      fullName: body.fullName,
      displayName: body.displayName,
      phone: body.phone,
    };

    let updatedCompany;
    if (!company) {
      updatedCompany = await prisma.company.create({
        data: dataPayload,
      });
    } else {
      updatedCompany = await prisma.company.update({
        where: { id: company.id },
        data: dataPayload,
      });
    }

    // Revalidate paths that depend on company data
    revalidatePath('/settings');
    revalidatePath('/', 'layout'); // revalidate entire dashboard layout if needed

    return NextResponse.json({ data: updatedCompany, error: null }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/company error:', error);
    return NextResponse.json(
      { data: null, error: { message: 'Failed to update company' } },
      { status: 500 }
    );
  }
}
