/**
 * SnapR AI Engine V3 - Preset Locker
 * ===================================
 * Ensures consistent presets across entire listing
 * 
 * ALIGNED WITH: decision-engine/types.ts v1.2
 */

import {
  LockedPresets,
  SkyPreset,
  TwilightPreset,
  LawnPreset,
  StagingPreset,
  ColorTempPreset,
  ToolId,
} from '../decision-engine/types';

// Re-export for backward compatibility

// ============================================
// PRESET PROMPT DEFINITIONS
// ============================================

const SKY_PROMPTS: Record<SkyPreset, string> = {
  'soft-blue': 'Replace ONLY the sky with a perfectly clear bright blue sky with minimal clouds. Crisp, clean real estate photography look. Do NOT change the house, trees, lawn, or anything else.',
  'dramatic-clouds': 'Replace ONLY the sky with dramatic white fluffy cumulus clouds against a deep vivid blue sky. Eye-catching real estate photography. Do NOT change the house, trees, lawn, or anything else.',
  'sunset': 'Replace ONLY the sky with a beautiful golden sunset - warm orange and pink colors at the horizon fading to soft blue above. Do NOT change the house, trees, lawn, or anything else.',
  'clear': 'Replace ONLY the sky with a clean clear blue sky. Simple and professional. Do NOT change the house, trees, lawn, or anything else.',
};

const TWILIGHT_PROMPTS: Record<TwilightPreset, string> = {
  'blue-hour': 'Transform into BLUE HOUR. Make the sky a rich DEEP BLUE color - no orange, no pink, just beautiful deep blue twilight. All windows should glow with bright warm YELLOW light creating contrast against the blue sky. Cool blue atmosphere with warm window glow.',
  'golden-hour': 'Transform into GOLDEN HOUR twilight. The sky should show warm ORANGE and PINK sunset colors with golden light. Add bright warm yellow light glowing from every window. The scene should feel cozy and inviting with golden warm tones.',
  'dusk': 'Transform into early dusk with purple-orange sky at horizon, soft twilight beginning, warm glow starting in windows. Keep house structure exactly the same.',
};

const LAWN_PROMPTS: Record<LawnPreset, string> = {
  'natural': 'Enhance the lawn to look healthy natural green grass. Fix any brown patches or bare spots. Keep it realistic and natural looking.',
  'vibrant': 'Transform lawn into vibrant healthy green grass. Richer color than natural but still believable.',
  'golf-course': 'Transform into perfectly manicured vibrant emerald green grass like a golf course. Flawless and lush.',
};

const STAGING_PROMPTS: Record<StagingPreset, string> = {
  'modern': 'Stage with modern contemporary furniture - clean lines, neutral gray and white tones, minimal decor, sleek design. Professional real estate staging.',
  'traditional': 'Stage with traditional elegant furniture - warm wood tones, rich fabrics, classic timeless style. Comfortable and inviting.',
  'minimalist': 'Stage with minimalist furniture - very sparse, essential pieces only, maximum open space, Zen-like simplicity.',
  'contemporary': 'Stage with contemporary furniture - current trends, interesting textures, balanced mix of comfort and style.',
};

const HDR_PROMPTS = {
  'light': 'Apply subtle HDR enhancement - slight shadow lift, minimal highlight recovery. Natural look.',
  'balanced': 'Apply balanced HDR enhancement - lift shadows moderately, recover highlights, improve overall dynamic range.',
  'dramatic': 'Apply strong HDR enhancement - significant shadow lift, dramatic highlight recovery, punchy contrast.',
};

const DECLUTTER_PROMPTS = {
  'light': 'Remove only small clutter like papers, cups, remotes, and small personal items from surfaces. Keep furniture and decor.',
  'moderate': 'Remove clutter, personal items, and excess decorations from all surfaces, counters, and floors. Keep furniture but create a cleaner, more spacious look.',
  'full': 'Remove ALL loose items, decorations, and personal belongings. Create a minimalist, model-home appearance. Keep only essential furniture.',
};

// ============================================
// GET LOCKED PROMPT
// ============================================

/**
 * Get the prompt for a specific tool based on locked presets
 */
export function getLockedPrompt(
  toolId: ToolId | string,
  presets: LockedPresets
): string | undefined {
  switch (toolId) {
    case 'sky-replacement':
      return presets.skyType ? SKY_PROMPTS[presets.skyType] : SKY_PROMPTS['soft-blue'];
      
    case 'virtual-twilight':
      return presets.twilightTone ? TWILIGHT_PROMPTS[presets.twilightTone] : TWILIGHT_PROMPTS['blue-hour'];
      
    case 'lawn-repair':
      return presets.lawnGreen ? LAWN_PROMPTS[presets.lawnGreen] : LAWN_PROMPTS['natural'];
      
    case 'virtual-staging':
      return presets.stagingStyle ? STAGING_PROMPTS[presets.stagingStyle] : STAGING_PROMPTS['modern'];
      
    case 'hdr':
      return presets.hdrStrength ? HDR_PROMPTS[presets.hdrStrength] : HDR_PROMPTS['balanced'];
      
    case 'declutter':
      return DECLUTTER_PROMPTS['moderate']; // Default moderate
      
    default:
      return undefined;
  }
}

// ============================================
// DETERMINE LOCKED PRESETS (Legacy Support)
// ============================================

/**
 * Legacy function - now handled by strategy-builder.ts
 * Kept for backward compatibility with existing code.
 */
export function determineLockedPresets(analyses: any[]): LockedPresets {
  console.log('[PresetLocker] Using legacy preset determination...');
  
  // Basic defaults - strategy-builder now handles intelligent preset selection
  return {
    skyType: 'soft-blue',
    twilightTone: 'blue-hour',
    lawnGreen: 'natural',
    hdrStrength: 'balanced',
    stagingStyle: 'modern',
    colorTemp: 'neutral',
  };
}
