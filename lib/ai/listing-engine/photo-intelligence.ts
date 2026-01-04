/**
 * SnapR AI Engine V3 - Photo Intelligence
 * ========================================
 * Uses GPT-4 Vision to analyze photos and classify them
 * 
 * OUTPUTS: PhotoAnalysis from decision-engine/types.ts (V3 format)
 */

import OpenAI from 'openai';
import {
  PhotoAnalysis,
  PhotoType,
  PhotoSubType,
  DeficiencyMap,
} from '../decision-engine/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const ANALYSIS_VERSION = '3.0.0';

// ============================================
// ANALYSIS PROMPT
// ============================================

const ANALYSIS_PROMPT = `You are a professional real estate photo analyst. Analyze this property photo and determine what enhancements it needs.

ANALYZE THE FOLLOWING:

1. PHOTO TYPE - Classify the main type:
   - exterior (any outside view of the property)
   - interior (any inside room)
   - drone (aerial shot)
   - detail (close-up of feature)

2. PHOTO SUBTYPE - Be more specific:
   - For exterior: front, back, side, pool, patio
   - For interior: kitchen, living, dining, bedroom, bathroom, office, garage, laundry, other
   - For drone: aerial
   - For detail: other

3. SKY ANALYSIS (if exterior/drone):
   - Is sky visible? 
   - Sky quality score 0-100 where: 0=perfect blue sky, 50=decent, 100=terrible (blown out/ugly)
   - Coverage: percentage of image that is sky (0-100)

4. LAWN ANALYSIS (if visible):
   - Lawn quality score 0-100 where: 0=lush green, 50=okay, 100=dead/brown
   - Coverage: percentage of image that is lawn (0-100)

5. LIGHTING ANALYSIS:
   - Lighting quality score 0-100 where: 0=perfect, 50=decent, 100=very dark or harsh flash
   - Issues: dark, overexposed, mixed lighting, flash harsh

6. CLUTTER ANALYSIS (if interior):
   - Clutter severity 0-100 where: 0=clean, 50=some items, 100=very cluttered

7. PERSPECTIVE ANALYSIS:
   - Are vertical lines straight? Score 0-100 where 0=perfect, 100=badly tilted

8. QUALITY SCORES:
   - Composition: 0-100 (100=excellent)
   - Lighting: 0-100 (100=perfect lighting)
   - Sharpness: 0-100 (100=tack sharp)

9. SPECIAL FEATURES:
   - Has visible windows? (for twilight potential)
   - Is room empty/unfurnished?
   - Has pool visible?
   - Has fireplace?

10. HERO POTENTIAL:
    - Score 0-100 for listing cover photo potential
    - Reason why (1 sentence)

11. ANALYSIS CONFIDENCE:
    - How confident are you in this analysis? 0-100

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "photoType": "exterior",
  "subType": "front",
  "deficiencies": {
    "sky": { "severity": 80, "coverage": 35 },
    "lawn": { "severity": 60, "coverage": 25 },
    "lighting": { "severity": 20 },
    "clutter": { "severity": 0 },
    "perspective": { "severity": 10 }
  },
  "scores": {
    "composition": 85,
    "lighting": 80,
    "sharpness": 90
  },
  "hasSky": true,
  "hasLawn": true,
  "hasPool": false,
  "hasFireplace": false,
  "hasWindows": true,
  "isEmpty": false,
  "heroScore": 82,
  "heroReason": "Strong front exterior with good composition",
  "analysisConfidence": 90
}`;

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

export async function analyzePhoto(
  photoId: string,
  photoUrl: string
): Promise<PhotoAnalysis> {
  console.log(`[PhotoIntelligence] Analyzing photo: ${photoId}`);
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: photoUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4 Vision');
    }

    // Parse the JSON response
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const analysis = JSON.parse(cleanContent);
    
    const duration = Date.now() - startTime;
    console.log(`[PhotoIntelligence] Analysis complete in ${duration}ms`);

    return normalizeAnalysis(photoId, photoUrl, analysis);
  } catch (error: any) {
    console.error(`[PhotoIntelligence] Analysis failed:`, error.message);
    return getDefaultAnalysis(photoId, photoUrl, error.message);
  }
}

// ============================================
// BATCH ANALYSIS
// ============================================

export async function analyzePhotos(
  photos: Array<{ id: string; url: string }>,
  options: { maxConcurrency?: number } = {}
): Promise<PhotoAnalysis[]> {
  const { maxConcurrency = 5 } = options;
  const results: PhotoAnalysis[] = [];
  
  console.log(`[PhotoIntelligence] Analyzing ${photos.length} photos (concurrency: ${maxConcurrency})`);
  const startTime = Date.now();

  for (let i = 0; i < photos.length; i += maxConcurrency) {
    const batch = photos.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(photo => analyzePhoto(photo.id, photo.url));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    console.log(`[PhotoIntelligence] Progress: ${results.length}/${photos.length}`);
    
    if (i + maxConcurrency < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[PhotoIntelligence] All ${photos.length} photos analyzed in ${(duration / 1000).toFixed(1)}s`);

  return results;
}

// ============================================
// NORMALIZATION (Raw GPT → V3 PhotoAnalysis)
// ============================================

function normalizeAnalysis(
  photoId: string,
  photoUrl: string,
  raw: any
): PhotoAnalysis {
  // Build deficiencies map
  const deficiencies: DeficiencyMap = {};
  
  if (raw.deficiencies?.sky?.severity > 0) {
    deficiencies.sky = {
      severity: clamp(raw.deficiencies.sky.severity, 0, 100),
      coverage: clamp(raw.deficiencies.sky.coverage || 0, 0, 100),
    };
  }
  
  if (raw.deficiencies?.lawn?.severity > 0) {
    deficiencies.lawn = {
      severity: clamp(raw.deficiencies.lawn.severity, 0, 100),
      coverage: clamp(raw.deficiencies.lawn.coverage || 0, 0, 100),
    };
  }
  
  if (raw.deficiencies?.lighting?.severity > 0) {
    deficiencies.lighting = {
      severity: clamp(raw.deficiencies.lighting.severity, 0, 100),
    };
  }
  
  if (raw.deficiencies?.clutter?.severity > 0) {
    deficiencies.clutter = {
      severity: clamp(raw.deficiencies.clutter.severity, 0, 100),
    };
  }
  
  if (raw.deficiencies?.perspective?.severity > 0) {
    deficiencies.perspective = {
      severity: clamp(raw.deficiencies.perspective.severity, 0, 100),
    };
  }

  return {
    photoId,
    photoUrl,
    photoType: validatePhotoType(raw.photoType),
    subType: validateSubType(raw.subType),
    scores: {
      composition: clamp(raw.scores?.composition || 70, 0, 100),
      lighting: clamp(raw.scores?.lighting || 70, 0, 100),
      sharpness: clamp(raw.scores?.sharpness || 70, 0, 100),
    },
    deficiencies,
    heroScore: clamp(raw.heroScore || 50, 0, 100),
    heroReason: raw.heroReason || '',
    hasSky: Boolean(raw.hasSky),
    hasLawn: Boolean(raw.hasLawn),
    hasPool: Boolean(raw.hasPool),
    hasFireplace: Boolean(raw.hasFireplace),
    hasWindows: Boolean(raw.hasWindows),
    isEmpty: Boolean(raw.isEmpty),
    analysisConfidence: clamp(raw.analysisConfidence || 70, 0, 100) / 100, // Convert to 0-1
  };
}

function getDefaultAnalysis(
  photoId: string,
  photoUrl: string,
  errorReason: string
): PhotoAnalysis {
  return {
    photoId,
    photoUrl,
    photoType: 'detail',
    subType: 'other',
    scores: {
      composition: 50,
      lighting: 50,
      sharpness: 50,
    },
    deficiencies: {},
    heroScore: 30,
    heroReason: `Analysis failed: ${errorReason}`,
    hasSky: false,
    hasLawn: false,
    hasPool: false,
    hasFireplace: false,
    hasWindows: false,
    isEmpty: false,
    analysisConfidence: 0.3, // Low confidence due to failure
  };
}

// ============================================
// VALIDATORS
// ============================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validatePhotoType(value: any): PhotoType {
  const valid: PhotoType[] = ['exterior', 'interior', 'drone', 'detail'];
  return valid.includes(value) ? value : 'detail';
}

function validateSubType(value: any): PhotoSubType {
  const valid: PhotoSubType[] = [
    'front', 'back', 'side', 'pool', 'patio', 'aerial',
    'kitchen', 'living', 'dining', 'bedroom', 'bathroom',
    'office', 'garage', 'laundry', 'other'
  ];
  return valid.includes(value) ? value : 'other';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function isExterior(photoType: PhotoType): boolean {
  return photoType === 'exterior' || photoType === 'drone';
}

export function isInterior(photoType: PhotoType): boolean {
  return photoType === 'interior';
}

export function getPhotoTypeLabel(photoType: PhotoType, subType: PhotoSubType): string {
  const subLabels: Record<PhotoSubType, string> = {
    front: 'Front Exterior',
    back: 'Back Exterior',
    side: 'Side Exterior',
    pool: 'Pool',
    patio: 'Patio',
    aerial: 'Aerial View',
    kitchen: 'Kitchen',
    living: 'Living Room',
    dining: 'Dining Room',
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
    office: 'Office',
    garage: 'Garage',
    laundry: 'Laundry',
    storage: 'Storage',
    basement: 'Basement',
    attic: 'Attic',
    balcony: 'Balcony',
    garden: 'Garden',
    other: 'Photo',
  };
  return subLabels[subType] || 'Photo';
}
