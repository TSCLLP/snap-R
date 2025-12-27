import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { onListingStatusChange, toCampaignStatus } from '@/lib/campaigns/status-hook';

export async function POST(request: NextRequest) {
  try {
    // Auth check - get user from session, not from request body!
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = createServiceClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { listingId, newStatus } = await request.json();

    if (!listingId || !newStatus) {
      return NextResponse.json({ error: 'listingId and newStatus required' }, { status: 400 });
    }

    // Get current listing status - verify ownership
    const { data: listing, error: fetchError } = await serviceSupabase
      .from('listings')
      .select('status')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const previousStatus = listing.status;

    // Update listing status
    const { error: updateError } = await serviceSupabase
      .from('listings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Trigger campaign if applicable
    const campaignStatus = toCampaignStatus(newStatus);
    let campaignResult: { triggered: boolean; campaignId?: string; error?: string } = { triggered: false };

    if (campaignStatus) {
      campaignResult = await onListingStatusChange({
        userId: user.id,
        listingId,
        newStatus: campaignStatus,
        previousStatus: toCampaignStatus(previousStatus) || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      previousStatus,
      newStatus,
      campaign: campaignResult,
    });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
