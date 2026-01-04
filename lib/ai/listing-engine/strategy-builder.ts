/**
 * SnapR AI Engine V3 - Strategy Builder
 * ======================================
 * IMPLEMENTS: decision-engine/pseudo.ts v1.1
 * USES: decision-engine/types.ts v1.2
 * USES: decision-engine/confidence.ts v1.1
 * 
 * This file MUST follow the locked specs exactly.
 * Any changes here must be reflected in the spec files first.
 */

import {
  PhotoRole,
  PhotoAnalysis,
  PhotoStrategy,
  ListingStrategy,
  EnhancementDecision,
  ToolId,
  ListingCaps,
  CapsUsage,
  LockedPresets,
  DecisionEngineConfig,
  DEFAULT_CONFIG,
  TOOL_METADATA,
  calculateCaps,
  createEmptyCapsUsage,
} from '../decision-engine/types';

import {
  calculateListingConfidence,
  calculatePhotoConfidence,
} from '../decision-engine/confidence';

// Re-export for backward compatibility

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * buildListingStrategy
 * 
 * Main entry point for strategy building.
 * Implements pseudo.ts v1.1 algorithm exactly.
 */
export function buildListingStrategy(
  listingId: string,
  analyses: PhotoAnalysis[],
  config: Partial<DecisionEngineConfig> = {}
): ListingStrategy {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`\n[StrategyBuilder] ========================================`);
  console.log(`[StrategyBuilder] Building strategy for ${listingId}`);
  console.log(`[StrategyBuilder] Photos: ${analyses.length}`);
  console.log(`[StrategyBuilder] ========================================\n`);
  
  // ========================================
  // PHASE 1: CLASSIFY PHOTO ROLES
  // ========================================
  
  const totalPhotos = analyses.length;
  const heroCount = Math.ceil(totalPhotos * cfg.heroPercentage);
  const utilityCount = Math.ceil(totalPhotos * cfg.utilityPercentage);
  const supportingCount = totalPhotos - heroCount - utilityCount;
  
  const sorted = [...analyses].sort((a, b) => b.heroScore - a.heroScore);
  
  for (let i = 0; i < sorted.length; i++) {
    if (i < heroCount) {
      sorted[i].role = 'hero';
    } else if (i >= totalPhotos - utilityCount) {
      sorted[i].role = 'utility';
    } else {
      sorted[i].role = 'supporting';
    }
  }
  
  console.log(`[StrategyBuilder] Role assignment:`, {
    hero: heroCount,
    supporting: supportingCount,
    utility: utilityCount,
  });
  
  // ========================================
  // PHASE 2: CALCULATE CAPS
  // ========================================
  
  const interiorPhotos = analyses.filter(p => p.photoType === 'interior').length;
  const poolPhotos = analyses.filter(p => p.hasPool).length;
  
  const caps = calculateCaps(totalPhotos, interiorPhotos, poolPhotos);
  const capsUsage = createEmptyCapsUsage();
  
  console.log(`[StrategyBuilder] Caps:`, caps);
  
  // ========================================
  // PHASE 3: SELECT HERO & TWILIGHT PHOTOS
  // ========================================
  
  const heroPhotoId = sorted[0]?.photoId || '';
  const exteriors = sorted.filter(p => p.photoType === 'exterior');
  const twilightPhotoId = exteriors.length > 0 ? exteriors[0].photoId : null;
  
  console.log(`[StrategyBuilder] Hero photo: ${heroPhotoId}`);
  console.log(`[StrategyBuilder] Twilight photo: ${twilightPhotoId || 'none'}`);
  
  // ========================================
  // PHASE 4: BUILD PHOTO STRATEGIES
  // ========================================
  // Process in role priority order (Hero → Supporting → Utility)
  
  const orderedPhotos = [
    ...sorted.filter(p => p.role === 'hero'),
    ...sorted.filter(p => p.role === 'supporting'),
    ...sorted.filter(p => p.role === 'utility'),
  ];
  
  const photoStrategies: PhotoStrategy[] = [];
  
  for (const photo of orderedPhotos) {
    const strategy = buildPhotoStrategy(
      photo,
      twilightPhotoId,
      caps,
      capsUsage,
      cfg
    );
    photoStrategies.push(strategy);
  }
  
  // ========================================
  // PHASE 5: LOCK PRESETS
  // ========================================
  
  const lockedPresets = determineLockedPresets(photoStrategies, analyses);
  
  console.log(`[StrategyBuilder] Locked presets:`, lockedPresets);
  
  // ========================================
  // PHASE 6: CALCULATE ESTIMATES
  // ========================================
  
  const estimatedTime = calculateEstimatedTime(photoStrategies);
  const estimatedCost = calculateEstimatedCost(photoStrategies, analyses.length);
  
  // ========================================
  // PHASE 7: CALCULATE CONFIDENCE
  // ========================================
  
  const confidenceResult = calculateListingConfidence(
    photoStrategies,
    analyses,
    capsUsage,
    caps
  );
  
  console.log(`[StrategyBuilder] Confidence: ${confidenceResult.score}% (${confidenceResult.status})`);
  if (confidenceResult.flags.length > 0) {
    console.log(`[StrategyBuilder] Flags:`, confidenceResult.flags.map(f => f.code));
  }
  
  // ========================================
  // BUILD FINAL STRATEGY
  // ========================================
  
  const strategy: ListingStrategy = {
    listingId,
    totalPhotos,
    heroCount,
    supportingCount,
    utilityCount,
    photoStrategies,
    lockedPresets,
    caps,
    capsUsage,
    heroPhotoId,
    twilightPhotoId,
    estimatedTime,
    estimatedCost,
    confidenceScore: confidenceResult.score,
  };
  
  console.log(`\n${getStrategySummary(strategy)}\n`);
  
  return strategy;
}

// ============================================
// PHOTO STRATEGY BUILDER
// ============================================

function buildPhotoStrategy(
  photo: PhotoAnalysis,
  twilightPhotoId: string | null,
  caps: ListingCaps,
  capsUsage: CapsUsage,
  cfg: DecisionEngineConfig
): PhotoStrategy {
  const decisions: EnhancementDecision[] = [];
  const toolOrder: ToolId[] = [];
  const role = photo.role || 'supporting';
  
  // -----------------------------------------
  // STEP 4.1: APPLY CONFIDENCE DOWNGRADE
  // -----------------------------------------
  
  const adjustedDeficiencies = applyConfidenceDowngrade(
    photo.deficiencies,
    photo.analysisConfidence,
    cfg.minConfidence
  );
  
  // -----------------------------------------
  // CHECK IF TWILIGHT TARGET
  // -----------------------------------------
  // Twilight and sky replacement are MUTUALLY EXCLUSIVE
  
  const isTwilightTarget = photo.photoId === twilightPhotoId;
  
  // -----------------------------------------
  // STEP 4.2: VIRTUAL TWILIGHT (Check FIRST)
  // -----------------------------------------
  
  if (
    isTwilightTarget &&
    capsUsage.twilight < caps.twilight
  ) {
    decisions.push({
      tool: 'virtual-twilight',
      reason: `Designated twilight photo, highest exterior heroScore`,
      priority: 'high',
    });
    toolOrder.push('virtual-twilight');
    capsUsage.twilight++;
  }
  
  // -----------------------------------------
  // STEP 4.3: SKY REPLACEMENT
  // -----------------------------------------
  // NOT twilight target (mutual exclusion)
  
  if (
    !isTwilightTarget &&
    role === 'hero' &&
    photo.hasSky &&
    adjustedDeficiencies.sky &&
    adjustedDeficiencies.sky.severity >= cfg.highThreshold &&
    (adjustedDeficiencies.sky.coverage ?? 0) >= 20 &&
    capsUsage.skyReplacement < caps.skyReplacement
  ) {
    decisions.push({
      tool: 'sky-replacement',
      reason: `Hero exterior, sky severity ${adjustedDeficiencies.sky.severity}, coverage ${adjustedDeficiencies.sky.coverage}%`,
      priority: 'high',
    });
    toolOrder.push('sky-replacement');
    capsUsage.skyReplacement++;
  }
  
  // -----------------------------------------
  // STEP 4.4: LAWN REPAIR
  // -----------------------------------------
  
  if (
    role !== 'utility' &&
    photo.hasLawn &&
    adjustedDeficiencies.lawn &&
    adjustedDeficiencies.lawn.severity >= cfg.mediumThreshold &&
    (adjustedDeficiencies.lawn.coverage ?? 0) >= 15 &&
    capsUsage.lawnRepair < caps.lawnRepair
  ) {
    decisions.push({
      tool: 'lawn-repair',
      reason: `Lawn severity ${adjustedDeficiencies.lawn.severity}, coverage ${adjustedDeficiencies.lawn.coverage}%`,
      priority: 'medium',
    });
    toolOrder.push('lawn-repair');
    capsUsage.lawnRepair++;
  }
  
  // -----------------------------------------
  // STEP 4.5: POOL ENHANCE
  // -----------------------------------------
  
  if (
    photo.hasPool &&
    role !== 'utility' &&
    adjustedDeficiencies.pool &&
    adjustedDeficiencies.pool.severity >= cfg.mediumThreshold &&
    capsUsage.poolEnhance < caps.poolEnhance
  ) {
    decisions.push({
      tool: 'pool-enhance',
      reason: `Pool detected, severity ${adjustedDeficiencies.pool.severity}`,
      priority: 'medium',
    });
    toolOrder.push('pool-enhance');
    capsUsage.poolEnhance++;
  }
  
  // -----------------------------------------
  // STEP 4.6: DECLUTTER
  // -----------------------------------------
  // NOT bathroom (personal items expected)
  
  const isBathroom = photo.subType === 'bathroom';
  
  if (
    role !== 'utility' &&
    !isBathroom &&
    adjustedDeficiencies.clutter &&
    adjustedDeficiencies.clutter.severity >= 50 &&
    capsUsage.declutter < caps.declutter
  ) {
    decisions.push({
      tool: 'declutter',
      reason: `Clutter severity ${adjustedDeficiencies.clutter.severity}`,
      priority: 'medium',
    });
    toolOrder.push('declutter');
    capsUsage.declutter++;
  }
  
  // -----------------------------------------
  // STEP 4.7: VIRTUAL STAGING
  // -----------------------------------------
  
  if (
    role === 'hero' &&
    photo.isEmpty &&
    capsUsage.virtualStaging < caps.virtualStaging
  ) {
    decisions.push({
      tool: 'virtual-staging',
      reason: `Empty room, hero photo`,
      priority: 'high',
    });
    toolOrder.push('virtual-staging');
    capsUsage.virtualStaging++;
  }
  
  // -----------------------------------------
  // STEP 4.8: FIRE IN FIREPLACE
  // -----------------------------------------
  
  if (
    photo.hasFireplace &&
    role !== 'utility' &&
    capsUsage.fireFireplace < caps.fireFireplace
  ) {
    decisions.push({
      tool: 'fire-fireplace',
      reason: `Fireplace detected`,
      priority: 'low',
    });
    toolOrder.push('fire-fireplace');
    capsUsage.fireFireplace++;
  }
  
  // -----------------------------------------
  // STEP 4.9: HDR
  // -----------------------------------------
  // NOTE: Auto-enhance is UI/manual only.
  // Decision engine always uses HDR for deterministic results.
  
  if (
    adjustedDeficiencies.lighting &&
    adjustedDeficiencies.lighting.severity >= cfg.lowThreshold
  ) {
    const strength = role === 'hero' ? 'balanced' : 'light';
    decisions.push({
      tool: 'hdr',
      reason: `Lighting severity ${adjustedDeficiencies.lighting.severity}, strength: ${strength}`,
      priority: 'low',
    });
    toolOrder.push('hdr');
  }
  
  // -----------------------------------------
  // STEP 4.10: PERSPECTIVE CORRECTION
  // -----------------------------------------
  
  if (
    role !== 'utility' &&
    adjustedDeficiencies.perspective &&
    adjustedDeficiencies.perspective.severity >= cfg.highThreshold
  ) {
    decisions.push({
      tool: 'perspective-correction',
      reason: `Perspective severity ${adjustedDeficiencies.perspective.severity}`,
      priority: 'medium',
    });
    toolOrder.push('perspective-correction');
  }
  
  // -----------------------------------------
  // STEP 4.11: TV SCREEN - DISABLED
  // -----------------------------------------
  // NEVER auto-apply. Manual tool only.
  // Too many false positives from Vision AI.
  
  // -----------------------------------------
  // BUILD PHOTO STRATEGY
  // -----------------------------------------
  
  const skipReason = decisions.length === 0
    ? determineSkipReason(photo)
    : undefined;
  
  const confidence = calculatePhotoConfidence(
    decisions,
    photo.analysisConfidence,
    role
  );
  
  return {
    photoId: photo.photoId,
    photoUrl: photo.photoUrl,
    role,
    decisions,
    toolOrder,
    confidence,
    skipReason,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function applyConfidenceDowngrade(
  deficiencies: PhotoAnalysis['deficiencies'],
  photoConfidence: number,
  minConfidence: number
): PhotoAnalysis['deficiencies'] {
  const adjusted: PhotoAnalysis['deficiencies'] = {};
  
  for (const key of Object.keys(deficiencies) as Array<keyof typeof deficiencies>) {
    if (deficiencies[key]) {
      adjusted[key] = { ...deficiencies[key]! };
      
      if (photoConfidence < minConfidence) {
        adjusted[key]!.severity = Math.max(0, adjusted[key]!.severity - 20);
      }
    }
  }
  
  return adjusted;
}

function determineSkipReason(photo: PhotoAnalysis): string {
  if (photo.role === 'utility') {
    return 'Utility photo - minimal processing by design';
  }
  if (photo.analysisConfidence < 0.5) {
    return 'Low analysis confidence - skipped to avoid errors';
  }
  return 'No significant deficiencies detected';
}

function determineLockedPresets(
  strategies: PhotoStrategy[],
  analyses: PhotoAnalysis[]
): LockedPresets {
  const presets: LockedPresets = {};
  
  const firstSky = strategies.find(s =>
    s.decisions.some(d => d.tool === 'sky-replacement')
  );
  if (firstSky) {
    const analysis = analyses.find(a => a.photoId === firstSky.photoId);
    if (analysis) {
      presets.skyType = determineSkyPreset(analysis);
    }
  }
  
  const twilight = strategies.find(s =>
    s.decisions.some(d => d.tool === 'virtual-twilight')
  );
  if (twilight) {
    presets.twilightTone = 'blue-hour';
  }
  
  const firstLawn = strategies.find(s =>
    s.decisions.some(d => d.tool === 'lawn-repair')
  );
  if (firstLawn) {
    presets.lawnGreen = 'natural';
  }
  
  presets.hdrStrength = 'balanced';
  presets.stagingStyle = 'modern';
  
  return presets;
}

function determineSkyPreset(analysis: PhotoAnalysis): LockedPresets['skyType'] {
  if (analysis.scores.lighting >= 70) return 'soft-blue';
  if (analysis.scores.composition >= 80) return 'dramatic-clouds';
  return 'clear';
}

function calculateEstimatedTime(strategies: PhotoStrategy[]): number {
  let totalTime = 0;
  
  for (const strategy of strategies) {
    for (const tool of strategy.toolOrder) {
      totalTime += TOOL_METADATA[tool]?.estimatedTime ?? 5;
    }
  }
  
  totalTime += strategies.length * 3;
  
  return totalTime;
}

function calculateEstimatedCost(strategies: PhotoStrategy[], photoCount: number): number {
  let totalCost = 0;
  
  for (const strategy of strategies) {
    for (const tool of strategy.toolOrder) {
      totalCost += TOOL_METADATA[tool]?.estimatedCost ?? 0.05;
    }
  }
  
  totalCost += photoCount * 0.02;
  totalCost += photoCount * 0.01;
  
  return Math.round(totalCost * 100) / 100;
}

// ============================================
// STRATEGY SUMMARY
// ============================================

export function getStrategySummary(strategy: ListingStrategy): string {
  const lines: string[] = [];
  
  lines.push(`📊 Listing Strategy Summary`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`Total Photos: ${strategy.totalPhotos}`);
  lines.push(`Roles: ${strategy.heroCount} hero, ${strategy.supportingCount} supporting, ${strategy.utilityCount} utility`);
  lines.push(`Hero Photo: ${strategy.heroPhotoId || 'None'}`);
  lines.push(`Twilight Photo: ${strategy.twilightPhotoId || 'None'}`);
  lines.push(`Estimated Time: ${Math.round(strategy.estimatedTime / 60)} min`);
  lines.push(`Estimated Cost: $${strategy.estimatedCost.toFixed(2)}`);
  lines.push(`Confidence: ${strategy.confidenceScore}%`);
  lines.push(``);
  
  lines.push(`📦 Caps Usage:`);
  lines.push(`   Sky: ${strategy.capsUsage.skyReplacement}/${strategy.caps.skyReplacement}`);
  lines.push(`   Lawn: ${strategy.capsUsage.lawnRepair}/${strategy.caps.lawnRepair}`);
  lines.push(`   Twilight: ${strategy.capsUsage.twilight}/${strategy.caps.twilight}`);
  lines.push(`   Declutter: ${strategy.capsUsage.declutter}/${strategy.caps.declutter}`);
  lines.push(`   Staging: ${strategy.capsUsage.virtualStaging}/${strategy.caps.virtualStaging}`);
  lines.push(``);
  
  const toolCounts: Record<string, number> = {};
  strategy.photoStrategies.forEach(ps => {
    ps.toolOrder.forEach(tool => {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
  });
  
  lines.push(`🔧 Tools to Apply:`);
  Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tool, count]) => {
      lines.push(`   ${tool}: ${count} photos`);
    });
  
  const skipped = strategy.photoStrategies.filter(ps => ps.skipReason);
  if (skipped.length > 0) {
    lines.push(``);
    lines.push(`⏭️ Skipped: ${skipped.length} photos`);
  }
  
  return lines.join('\n');
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

export function orderByPriority(strategies: PhotoStrategy[]): PhotoStrategy[] {
  const roleOrder: Record<PhotoRole, number> = {
    hero: 0,
    supporting: 1,
    utility: 2,
  };
  
  return [...strategies].sort((a, b) => {
    const roleA = roleOrder[a.role] ?? 1;
    const roleB = roleOrder[b.role] ?? 1;
    return roleA - roleB;
  });
}
