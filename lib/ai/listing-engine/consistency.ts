/**
 * SnapR AI Engine V3 - Consistency Pass
 * ======================================
 * Ensures visual consistency across all listing photos
 * 
 * ALIGNED WITH: V3 types - uses PhotoExecutionResult directly
 */

import { PhotoExecutionResult } from './batch-processor';
import { ConsistencyMetrics, ConsistencyAdjustment } from './types';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  brightnessThreshold: 15,
  contrastThreshold: 10,
  warmthThreshold: 10,
  saturationThreshold: 10,
  maxBrightnessAdjust: 20,
  maxContrastAdjust: 15,
  maxWarmthAdjust: 15,
  maxSaturationAdjust: 15,
};

// ============================================
// MAIN CONSISTENCY FUNCTION
// ============================================

export async function analyzeConsistency(
  results: PhotoExecutionResult[]
): Promise<{
  metrics: ConsistencyMetrics;
  adjustments: ConsistencyAdjustment[];
  isConsistent: boolean;
  consistencyScore: number;
}> {
  console.log(`[Consistency] Analyzing ${results.length} photos`);
  
  // Filter to only successful results
  const successfulResults = results.filter(r => 
    (r.executionStatus === 'success' || r.executionStatus === 'partial') && r.enhancedUrl
  );
  
  if (successfulResults.length < 2) {
    return {
      metrics: getDefaultMetrics(),
      adjustments: [],
      isConsistent: true,
      consistencyScore: 100,
    };
  }
  
  const metrics = estimateMetrics(successfulResults);
  const adjustments = calculateAdjustments(successfulResults, metrics);
  const consistencyScore = calculateConsistencyScore(adjustments);
  
  console.log(`[Consistency] Score: ${consistencyScore}%, ${adjustments.length} adjustments recommended`);
  
  return {
    metrics,
    adjustments,
    isConsistent: consistencyScore >= 85,
    consistencyScore,
  };
}

// ============================================
// METRIC ESTIMATION
// ============================================

function getDefaultMetrics(): ConsistencyMetrics {
  return {
    averageBrightness: 50,
    averageContrast: 50,
    averageWarmth: 50,
    averageSaturation: 50,
  };
}

function estimateMetrics(results: PhotoExecutionResult[]): ConsistencyMetrics {
  let totalBrightness = 0;
  let totalContrast = 0;
  let totalWarmth = 0;
  let totalSaturation = 0;
  
  for (const result of results) {
    let brightness = 50;
    let contrast = 50;
    let warmth = 50;
    let saturation = 50;
    
    for (const tool of result.toolsApplied) {
      switch (tool) {
        case 'hdr':
        case 'auto-enhance':
          brightness += 5;
          contrast += 10;
          saturation += 5;
          break;
        case 'virtual-twilight':
          brightness -= 15;
          warmth += 15;
          saturation += 5;
          break;
        case 'sky-replacement':
          brightness += 5;
          saturation += 5;
          break;
        case 'lights-on':
          brightness += 10;
          warmth += 10;
          break;
        case 'flash-fix':
          brightness -= 5;
          contrast += 5;
          break;
      }
    }
    
    totalBrightness += clamp(brightness, 0, 100);
    totalContrast += clamp(contrast, 0, 100);
    totalWarmth += clamp(warmth, 0, 100);
    totalSaturation += clamp(saturation, 0, 100);
  }
  
  const count = results.length;
  
  return {
    averageBrightness: Math.round(totalBrightness / count),
    averageContrast: Math.round(totalContrast / count),
    averageWarmth: Math.round(totalWarmth / count),
    averageSaturation: Math.round(totalSaturation / count),
  };
}

// ============================================
// ADJUSTMENT CALCULATION
// ============================================

function calculateAdjustments(
  results: PhotoExecutionResult[],
  targetMetrics: ConsistencyMetrics
): ConsistencyAdjustment[] {
  const adjustments: ConsistencyAdjustment[] = [];
  
  for (const result of results) {
    if (result.executionStatus === 'failed') continue;
    
    const photoMetrics = estimateSinglePhotoMetrics(result);
    
    const brightnessAdj = calculateSingleAdjustment(
      photoMetrics.brightness,
      targetMetrics.averageBrightness,
      CONFIG.brightnessThreshold,
      CONFIG.maxBrightnessAdjust
    );
    
    const contrastAdj = calculateSingleAdjustment(
      photoMetrics.contrast,
      targetMetrics.averageContrast,
      CONFIG.contrastThreshold,
      CONFIG.maxContrastAdjust
    );
    
    const warmthAdj = calculateSingleAdjustment(
      photoMetrics.warmth,
      targetMetrics.averageWarmth,
      CONFIG.warmthThreshold,
      CONFIG.maxWarmthAdjust
    );
    
    const saturationAdj = calculateSingleAdjustment(
      photoMetrics.saturation,
      targetMetrics.averageSaturation,
      CONFIG.saturationThreshold,
      CONFIG.maxSaturationAdjust
    );
    
    if (brightnessAdj !== 0 || contrastAdj !== 0 || warmthAdj !== 0 || saturationAdj !== 0) {
      adjustments.push({
        photoId: result.photoId,
        brightness: brightnessAdj,
        contrast: contrastAdj,
        warmth: warmthAdj,
        saturation: saturationAdj,
      });
    }
  }
  
  return adjustments;
}

function estimateSinglePhotoMetrics(result: PhotoExecutionResult): {
  brightness: number;
  contrast: number;
  warmth: number;
  saturation: number;
} {
  let brightness = 50;
  let contrast = 50;
  let warmth = 50;
  let saturation = 50;
  
  for (const tool of result.toolsApplied) {
    switch (tool) {
      case 'hdr':
      case 'auto-enhance':
        brightness += 5;
        contrast += 10;
        saturation += 5;
        break;
      case 'virtual-twilight':
        brightness -= 15;
        warmth += 15;
        saturation += 5;
        break;
      case 'sky-replacement':
        brightness += 5;
        saturation += 5;
        break;
      case 'lights-on':
        brightness += 10;
        warmth += 10;
        break;
    }
  }
  
  return {
    brightness: clamp(brightness, 0, 100),
    contrast: clamp(contrast, 0, 100),
    warmth: clamp(warmth, 0, 100),
    saturation: clamp(saturation, 0, 100),
  };
}

function calculateSingleAdjustment(
  current: number,
  target: number,
  threshold: number,
  maxAdjust: number
): number {
  const diff = target - current;
  
  if (Math.abs(diff) < threshold) {
    return 0;
  }
  
  const adjustment = Math.sign(diff) * Math.min(Math.abs(diff), maxAdjust);
  return Math.round(adjustment);
}

// ============================================
// CONSISTENCY SCORING
// ============================================

function calculateConsistencyScore(adjustments: ConsistencyAdjustment[]): number {
  if (adjustments.length === 0) {
    return 100;
  }
  
  let totalMagnitude = 0;
  
  for (const adj of adjustments) {
    totalMagnitude += Math.abs(adj.brightness);
    totalMagnitude += Math.abs(adj.contrast);
    totalMagnitude += Math.abs(adj.warmth);
    totalMagnitude += Math.abs(adj.saturation);
  }
  
  const avgMagnitude = totalMagnitude / (adjustments.length * 4);
  const score = Math.max(0, 100 - (avgMagnitude * 5));
  
  return Math.round(score);
}

// ============================================
// UTILITY
// ============================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getConsistencyReport(
  metrics: ConsistencyMetrics,
  adjustments: ConsistencyAdjustment[],
  score: number
): string {
  const lines: string[] = [];
  
  lines.push(`🎨 Consistency Report`);
  lines.push(`─────────────────────`);
  lines.push(`Score: ${score}%`);
  lines.push(``);
  lines.push(`Target Metrics:`);
  lines.push(`  Brightness: ${metrics.averageBrightness}`);
  lines.push(`  Contrast: ${metrics.averageContrast}`);
  lines.push(`  Warmth: ${metrics.averageWarmth}`);
  lines.push(`  Saturation: ${metrics.averageSaturation}`);
  lines.push(``);
  
  if (adjustments.length === 0) {
    lines.push(`✓ All photos are visually consistent`);
  } else {
    lines.push(`Adjustments Recommended: ${adjustments.length} photos`);
    for (const adj of adjustments.slice(0, 5)) {
      const parts: string[] = [];
      if (adj.brightness !== 0) parts.push(`B:${adj.brightness > 0 ? '+' : ''}${adj.brightness}`);
      if (adj.contrast !== 0) parts.push(`C:${adj.contrast > 0 ? '+' : ''}${adj.contrast}`);
      if (adj.warmth !== 0) parts.push(`W:${adj.warmth > 0 ? '+' : ''}${adj.warmth}`);
      if (adj.saturation !== 0) parts.push(`S:${adj.saturation > 0 ? '+' : ''}${adj.saturation}`);
      lines.push(`  ${adj.photoId}: ${parts.join(', ')}`);
    }
    if (adjustments.length > 5) {
      lines.push(`  ... and ${adjustments.length - 5} more`);
    }
  }
  
  return lines.join('\n');
}
