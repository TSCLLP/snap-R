import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listingId, toolId, preset } = await req.json();
    
    if (!listingId || !toolId || !preset) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Verify user owns this listing
    const { data: listing } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    
    // Get all pending photos
    const { data: photos, error } = await supabase
      .from('photos')
      .select('id')
      .eq('listing_id', listingId)
      .eq('status', 'pending');

    if (error || !photos || photos.length === 0) {
      return NextResponse.json({ error: 'No pending photos found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      photoIds: photos.map(p => p.id),
      total: photos.length 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
