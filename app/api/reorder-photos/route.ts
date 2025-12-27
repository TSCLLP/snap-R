import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listingId, photoOrder } = await req.json();

    if (!listingId || !photoOrder || !Array.isArray(photoOrder)) {
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

    // Update each photo's display_order
    const updates = photoOrder.map((photoId, index) => 
      supabase
        .from('photos')
        .update({ display_order: index })
        .eq('id', photoId)
        .eq('listing_id', listingId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reorder photos error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
