import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['rajesh@boujeeprojects.com', 'admin@snap-r.com'];

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: users } = await serviceSupabase
      .from('profiles')
      .select('id, email, full_name, plan, credits, created_at')
      .order('created_at', { ascending: false });

    const csv = [
      'ID,Email,Name,Plan,Credits,Created At',
      ...(users || []).map(u => 
        `${u.id},${u.email},${u.full_name || ''},${u.plan || 'free'},${u.credits || 0},${u.created_at}`
      )
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=snapr-users-${new Date().toISOString().split('T')[0]}.csv`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
