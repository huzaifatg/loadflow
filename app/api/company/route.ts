import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { data: null, error: { message: 'Company name is required' } },
        { status: 400 }
      );
    }

    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: body.name.trim(),
      },
    });

    return NextResponse.json({ data: updatedCompany, error: null }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/company error:', error);
    return NextResponse.json(
      { data: null, error: { message: 'Failed to update company' } },
      { status: 500 }
    );
  }
}
