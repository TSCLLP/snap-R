import {
  skyReplacement,
  virtualTwilight,
  lawnRepair,
  declutter,
  virtualStaging,
  fireFireplace,
  tvScreen,
  lightsOn,
  windowMasking,
  colorBalance,
  poolEnhance,
  hdr,
  perspectiveCorrection,
  lensCorrection,
  autoEnhance,
} from './providers/replicate';
import { createClient } from '@/lib/supabase/server';
import { applyWatermark } from '@/lib/utils/watermark';
import { getPolicy } from '@/lib/ai/policy';

export type ToolId =
  // EXTERIOR (4)
  | 'sky-replacement'
  | 'virtual-twilight'
  | 'lawn-repair'
  | 'pool-enhance'
  // INTERIOR (6)
  | 'declutter'
  | 'virtual-staging'
  | 'fire-fireplace'
  | 'tv-screen'
  | 'lights-on'
  | 'window-masking'
  // ENHANCE (5)
  | 'hdr'
  | 'auto-enhance'
  | 'perspective-correction'
  | 'lens-correction'
  | 'color-balance';

export const TOOL_CREDITS: Record<ToolId, number> = {
  // EXTERIOR
  'sky-replacement': 1,
  'virtual-twilight': 2,
  'lawn-repair': 1,
  'pool-enhance': 1,
  // INTERIOR
  'declutter': 2,
  'virtual-staging': 3,
  'fire-fireplace': 1,
  'tv-screen': 1,
  'lights-on': 1,
  'window-masking': 2,
  // ENHANCE
  'hdr': 1,
  'auto-enhance': 1,
  'perspective-correction': 1,
  'lens-correction': 1,
  'color-balance': 1,
};

export interface EnhancementResult {
  success: boolean;
  enhancedUrl?: string;
  error?: string;
  provider?: string;
  model?: string;
  duration?: number;
}

export async function processEnhancement(
  toolId: ToolId,
  imageUrl: string,
  options: {
    preset?: string;
    prompt?: string;
    region?: string;
    userRole?: 'photographer' | 'agent' | 'broker';
  } = {},
): Promise<EnhancementResult> {
  const startTime = Date.now();

  const region = options.region || 'US';
  const role = (options.userRole ||
    'photographer') as 'photographer' | 'agent' | 'broker';

  const policy = getPolicy(region, role);

  console.log('[Router] ===================================');
  console.log('[Router] Tool:', toolId);
  console.log('[Router] Preset:', options.preset || 'none');
  console.log('[Router] Custom Prompt:', options.prompt ? 'YES' : 'NO');
  console.log('[Router] Region:', region);
  console.log('[Router] UserRole:', role);
  console.log('[Router] ToneProfile:', policy.toneProfile);
  console.log('[Router] Watermark.Staging:', policy.watermark.staging);
  console.log('[Router] ===================================');

  try {
    // Apply MLS-safe tone only when policy says mls-natural
    if (policy.toneProfile === 'mls-natural') {
      (options as any).saturationAdjust = -0.08;
      (options as any).contrastAdjust = 0.05;
      (options as any).shadowLift = 0.04;
      (options as any).whiteBalanceBias = 'cool-neutral';
    }

    let enhancedUrl: string;

    switch (toolId) {
      // ========================================
      // TOOLS WITH PRESETS (10) - pass prompt
      // ========================================

      case 'sky-replacement':
        enhancedUrl = await skyReplacement(imageUrl, options.prompt);
        break;

      case 'virtual-twilight':
        enhancedUrl = await virtualTwilight(imageUrl, options.prompt);
        break;

      case 'lawn-repair':
        enhancedUrl = await lawnRepair(imageUrl, options.prompt);
        break;

      case 'declutter':
        enhancedUrl = await declutter(imageUrl, options.prompt);
        break;

      case 'virtual-staging':
        enhancedUrl = await virtualStaging(imageUrl, options.prompt);
        break;

      case 'fire-fireplace':
        enhancedUrl = await fireFireplace(imageUrl, options.prompt);
        break;

      case 'tv-screen':
        enhancedUrl = await tvScreen(imageUrl, options.prompt);
        break;

      case 'lights-on':
        enhancedUrl = await lightsOn(imageUrl, options.prompt);
        break;

      case 'window-masking':
        enhancedUrl = await windowMasking(imageUrl, options.prompt);
        break;

      case 'color-balance':
        enhancedUrl = await colorBalance(imageUrl, options.prompt);
        break;

      // ========================================
      // TOOLS WITHOUT PRESETS (5) - one-click
      // ========================================

      case 'pool-enhance':
        enhancedUrl = await poolEnhance(imageUrl);
        break;

      case 'hdr':
        enhancedUrl = await hdr(imageUrl);
        break;

      case 'auto-enhance':
        enhancedUrl = await autoEnhance(imageUrl);
        break;

      case 'perspective-correction':
        enhancedUrl = await perspectiveCorrection(imageUrl);
        break;

      case 'lens-correction':
        enhancedUrl = await lensCorrection(imageUrl);
        break;

      default:
        throw new Error(`Unknown tool: ${toolId}`);
    }

    // Enforce watermark ONLY if policy requires it for staging
    if (
      toolId === 'virtual-staging' &&
      policy.watermark.staging === 'mandatory'
    ) {
      try {
        const processedImageResponse = await fetch(enhancedUrl);
        if (processedImageResponse.ok) {
          const imageBuffer = await processedImageResponse.arrayBuffer();
          const stampedImage = await applyWatermark(
            Buffer.from(imageBuffer),
            policy.watermark.text || 'Virtually Staged',
          );

          const newKey = `staged/${Date.now()}-staged.jpg`;
          const supabase = await createClient();
          const { error: uploadError } = await supabase.storage
            .from('raw-images')
            .upload(newKey, stampedImage, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!uploadError) {
            const { data: signedUrl } = await supabase.storage
              .from('raw-images')
              .createSignedUrl(newKey, 3600);

            if (signedUrl?.signedUrl) {
              enhancedUrl = signedUrl.signedUrl;
            }
          }
        }
      } catch (e) {
        console.warn('[Router] Watermark insert failed:', e);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Router] ✅ SUCCESS in ${(duration / 1000).toFixed(1)}s`);

    return {
      success: true,
      enhancedUrl,
      provider: 'replicate',
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `[Router] ❌ FAILED after ${(duration / 1000).toFixed(1)}s:`,
      error.message,
    );

    return {
      success: false,
      error: error.message || 'Enhancement failed',
      duration,
    };
  }
}
