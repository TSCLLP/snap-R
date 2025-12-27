import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listingId } = await req.json();

    if (!listingId) {
      return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
    }
    
    // Verify user owns this listing
    const { data: listing } = await supabase
      .from('listings')
      .select('title')
      .eq('id', listingId)
      .eq('user_id', user.id)
      .single();

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const { data: photos, error } = await supabase
      .from('photos')
      .select('processed_url, raw_url, filename')
      .eq('listing_id', listingId);

    if (error || !photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos found' }, { status: 404 });
    }

    const zip = new JSZip();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const url = photo.processed_url || photo.raw_url;
      if (!url) continue;

      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const filename = photo.filename || `photo-${i + 1}.jpg`;
        zip.file(filename, blob);
      } catch (e) {
        console.error('Failed to fetch photo:', url);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const buffer = await zipBlob.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${listing.title || 'photos'}.zip"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
