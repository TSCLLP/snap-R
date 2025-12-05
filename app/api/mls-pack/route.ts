import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { imageUrls = [] } = await req.json();

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'No imageUrls provided' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Could not fetch user profile' },
        { status: 500 },
      );
    }

    const role =
      (profile.user_role as 'photographer' | 'agent' | 'broker') ||
      'photographer';

    // Photographers are NOT allowed to generate MLS packs
    if (role === 'photographer') {
      return NextResponse.json(
        {
          error: 'MLS pack is only available for agent/broker accounts',
        },
        { status: 403 },
      );
    }

    // filename structure
    const zipFileName = `MLS-PACK-${Date.now()}.zip`;
    const zipKey = `packs/${zipFileName}`;

    const archiveBuffers: Record<string, Buffer> = {};

    // Process each image into 3 variants
    for (const imageUrl of imageUrls) {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        console.warn('Failed to fetch image for MLS pack:', imageUrl);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // MLS → max 2048px width
      const mls = await sharp(buffer)
        .resize({ width: 2048 })
        .jpeg({ quality: 70 })
        .toBuffer();

      // EMAIL → lighter
      const email = await sharp(buffer)
        .resize({ width: 1200 })
        .jpeg({ quality: 55 })
        .toBuffer();

      archiveBuffers[`MLS/${Date.now()}-${Math.random()}.jpg`] = mls;
      archiveBuffers[`Email/${Date.now()}-${Math.random()}.jpg`] = email;
      archiveBuffers[`FullRes/${Date.now()}-${Math.random()}.jpg`] = buffer;
    }

    if (Object.keys(archiveBuffers).length === 0) {
      return NextResponse.json(
        { error: 'No valid images to pack' },
        { status: 400 },
      );
    }

    // Create manifest
    const manifest = {
      createdAt: new Date().toISOString(),
      totalImages: imageUrls.length,
      structure: ['MLS/', 'Email/', 'FullRes/'],
      role,
    };

    archiveBuffers['manifest.json'] = Buffer.from(
      JSON.stringify(manifest, null, 2),
    );

    // Build ZIP locally
    const zipBuffer: Buffer = await new Promise((resolve, reject) => {
      const _archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      _archive.on('data', (chunk) => chunks.push(chunk as Buffer));
      _archive.on('end', () => resolve(Buffer.concat(chunks)));
      _archive.on('error', (err) => reject(err));

      for (const [pathName, data] of Object.entries(archiveBuffers)) {
        _archive.append(data, { name: pathName });
      }

      _archive.finalize();
    });

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('raw-images')
      .upload(zipKey, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      });

    if (uploadError) {
      console.error('MLS pack upload error =>', uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    // Generate signed download URL
    const { data: signed } = await supabase.storage
      .from('raw-images')
      .createSignedUrl(zipKey, 3600);

    if (!signed?.signedUrl) {
      return NextResponse.json(
        { error: 'Could not create signed URL for pack' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      packUrl: signed.signedUrl,
      expiresIn: 3600,
      role,
    });
  } catch (err: any) {
    console.error('MLS pack error =>', err);
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 },
    );
  }
}
