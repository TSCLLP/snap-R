/**
 * SnapR Decision Engine - Pseudo-Code v1.1
 * Status: 🔒 LOCKED - DO NOT MODIFY WITHOUT APPROVAL
 * 
 * This file defines the ALGORITHM, not implementation.
 * It bridges product logic → engineering reality.
 * 
 * The actual implementation in strategy-builder.ts MUST follow this exactly.
 * 
 * CHANGELOG:
 * v1.1 - Fixed twilight/sky collision, ordering, confidence, cost model
 */

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * buildListingStrategy(listingId, photoAnalyses, config)
 * 
 * INPUT:
 *   - listingId: string
 *   - photoAnalyses: PhotoAnalysis[] (from Vision Intelligence)
 *   - config: DecisionEngineConfig (thresholds, property type, overrides)
 * 
 * OUTPUT:
 *   - ListingStrategy (complete enhancement plan)
 * 
 * ALGORITHM:
 */

function buildListingStrategy(listingId, photoAnalyses, config) {
  
  // ========================================
  // PHASE 1: CLASSIFY PHOTO ROLES
  // ========================================
  // 
  // NOT all photos are equal.
  // Assign: hero (15%), supporting (65%), utility (20%)
  
  const totalPhotos = photoAnalyses.length;
  const heroCount = Math.ceil(totalPhotos * config.heroPercentage);      // ~15%
  const utilityCount = Math.ceil(totalPhotos * config.utilityPercentage); // ~20%
  const supportingCount = totalPhotos - heroCount - utilityCount;         // ~65%
  
  // Sort by heroScore DESCENDING
  const sorted = photoAnalyses.sort((a, b) => b.heroScore - a.heroScore);
  
  // Assign roles
  for (let i = 0; i < sorted.length; i++) {
    if (i < heroCount) {
      sorted[i].role = 'hero';
    } else if (i >= totalPhotos - utilityCount) {
      sorted[i].role = 'utility';
    } else {
      sorted[i].role = 'supporting';
    }
  }
  
  // ========================================
  // PHASE 2: CALCULATE CAPS
  // ========================================
  //
  // Caps prevent over-processing and cost explosion.
  // Scale with listing size.
  
  const interiorPhotos = photoAnalyses.filter(p => p.photoType === 'interior').length;
  const poolPhotos = photoAnalyses.filter(p => p.hasPool).length;
  
  const caps = {
    skyReplacement: Math.min(3, Math.ceil(totalPhotos * 0.15)),
    lawnRepair: Math.min(4, Math.ceil(totalPhotos * 0.20)),
    declutter: Math.ceil(interiorPhotos * 0.30),
    virtualStaging: 2,
    twilight: 1,
    fireFireplace: 1,
    poolEnhance: Math.min(2, poolPhotos),
  };
  
  // Track usage
  const capsUsage = {
    skyReplacement: 0,
    lawnRepair: 0,
    declutter: 0,
    virtualStaging: 0,
    twilight: 0,
    fireFireplace: 0,
    poolEnhance: 0,
  };
  
  // ========================================
  // PHASE 3: SELECT HERO & TWILIGHT PHOTOS
  // ========================================
  //
  // Hero = highest heroScore overall
  // Twilight = highest heroScore EXTERIOR (only 1)
  
  const heroPhotoId = sorted[0].photoId;
  
  const exteriors = sorted.filter(p => p.photoType === 'exterior');
  const twilightPhotoId = exteriors.length > 0 ? exteriors[0].photoId : null;
  
  // ========================================
  // PHASE 4: BUILD PHOTO STRATEGIES
  // ========================================
  //
  // For each photo, determine which tools to apply.
  // Logic: role × severity × caps × confidence
  //
  // ❗ CRITICAL: Process in priority order (Hero → Supporting → Utility)
  // This ensures caps are consumed by most important photos first.
  
  const photoStrategies = [];
  
  // ❗ FIX ISSUE 2: Process in role priority order
  const orderedPhotos = [
    ...sorted.filter(p => p.role === 'hero'),
    ...sorted.filter(p => p.role === 'supporting'),
    ...sorted.filter(p => p.role === 'utility'),
  ];
  
  for (const photo of orderedPhotos) {
    const decisions = [];
    const toolOrder = [];
    
    // -----------------------------------------
    // STEP 4.1: APPLY CONFIDENCE DOWNGRADE
    // -----------------------------------------
    // If AI confidence < minConfidence, downgrade severity by one level.
    // 
    // ❗ FIX ISSUE 3: Use photo.analysisConfidence globally
    // Each deficiency does NOT have its own confidence.
    // We use the photo-level analysisConfidence for all deficiencies.
    
    const adjustedDeficiencies = applyConfidenceDowngrade(
      photo.deficiencies, 
      photo.analysisConfidence,
      config.minConfidence
    );
    
    // -----------------------------------------
    // ❗ FIX ISSUE 1: Check if this is twilight photo FIRST
    // Twilight and sky replacement are MUTUALLY EXCLUSIVE.
    // If twilight is applied, sky replacement is NEVER applied to same photo.
    // -----------------------------------------
    
    const isTwilightTarget = photo.photoId === twilightPhotoId;
    
    // -----------------------------------------
    // STEP 4.2: VIRTUAL TWILIGHT (Check FIRST)
    // -----------------------------------------
    // Rules:
    //   - ONLY the designated twilight photo
    //   - Only 1 per listing
    //   - cap not exceeded
    //   - MUTUAL EXCLUSION: If twilight applied, skip sky replacement
    
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
    // Rules:
    //   - role === 'hero' ONLY
    //   - sky.severity >= 60
    //   - sky.coverage >= 20%
    //   - cap not exceeded
    //   - ❗ NOT a twilight target (mutual exclusion)
    
    if (
      !isTwilightTarget &&  // ❗ FIX ISSUE 1: Mutual exclusion
      photo.role === 'hero' &&
      photo.hasSky &&
      adjustedDeficiencies.sky &&
      adjustedDeficiencies.sky.severity >= config.highThreshold &&
      adjustedDeficiencies.sky.coverage >= 20 &&
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
    // Rules:
    //   - role !== 'utility'
    //   - lawn.severity >= 40
    //   - lawn.coverage >= 15%
    //   - cap not exceeded
    
    if (
      photo.role !== 'utility' &&
      photo.hasLawn &&
      adjustedDeficiencies.lawn &&
      adjustedDeficiencies.lawn.severity >= config.mediumThreshold &&
      adjustedDeficiencies.lawn.coverage >= 15 &&
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
    // Rules:
    //   - hasPool === true
    //   - role !== 'utility'
    //   - cap not exceeded
    
    if (
      photo.hasPool &&
      photo.role !== 'utility' &&
      adjustedDeficiencies.pool &&
      adjustedDeficiencies.pool.severity >= config.mediumThreshold &&
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
    // Rules:
    //   - role !== 'utility'
    //   - clutter.severity >= 50
    //   - NOT bathroom (personal items expected)
    //   - cap not exceeded
    
    const isBathroom = photo.subType === 'bathroom';
    
    if (
      photo.role !== 'utility' &&
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
    // Rules:
    //   - role === 'hero' ONLY
    //   - room is empty
    //   - cap not exceeded
    
    if (
      photo.role === 'hero' &&
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
    // Rules:
    //   - hasFireplace === true
    //   - role !== 'utility'
    //   - cap not exceeded
    
    if (
      photo.hasFireplace &&
      photo.role !== 'utility' &&
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
    // STEP 4.9: HDR / AUTO-ENHANCE
    // -----------------------------------------
    // Rules:
    //   - Apply to ALL photos (light touch)
    //   - No cap
    //   - Adjust strength based on role
    
    if (adjustedDeficiencies.lighting && adjustedDeficiencies.lighting.severity >= config.lowThreshold) {
      const strength = photo.role === 'hero' ? 'balanced' : 'light';
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
    // Rules:
    //   - perspective.severity >= 60
    //   - role !== 'utility'
    
    if (
      photo.role !== 'utility' &&
      adjustedDeficiencies.perspective &&
      adjustedDeficiencies.perspective.severity >= config.highThreshold
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
    // NEVER auto-apply. Too many hallucinations.
    // Manual tool only.
    
    // -----------------------------------------
    // BUILD PHOTO STRATEGY
    // -----------------------------------------
    
    const skipReason = decisions.length === 0 
      ? determineSkipReason(photo) 
      : undefined;
    
    photoStrategies.push({
      photoId: photo.photoId,
      photoUrl: photo.photoUrl,
      role: photo.role,
      decisions,
      toolOrder,
      confidence: calculatePhotoConfidence(decisions, photo),
      skipReason,
    });
  }
  
  // ========================================
  // PHASE 5: LOCK PRESETS
  // ========================================
  //
  // First tool application determines preset.
  // All subsequent uses MUST match.
  
  const lockedPresets = determineLockedPresets(photoStrategies, photoAnalyses);
  
  // ========================================
  // PHASE 6: CALCULATE ESTIMATES
  // ========================================
  
  const estimatedTime = calculateEstimatedTime(photoStrategies);
  const estimatedCost = calculateEstimatedCost(photoStrategies);
  
  // ========================================
  // PHASE 7: CALCULATE CONFIDENCE SCORE
  // ========================================
  //
  // Determines: "prepared" vs "needs_review"
  
  const confidenceScore = calculateListingConfidence(
    photoStrategies,
    photoAnalyses,
    capsUsage,
    caps
  );
  
  // ========================================
  // RETURN COMPLETE STRATEGY
  // ========================================
  
  return {
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
    confidenceScore,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * applyConfidenceDowngrade(deficiencies, photoConfidence, minConfidence)
 * 
 * ❗ FIX ISSUE 3: Use photo-level confidence globally.
 * If photo.analysisConfidence < minConfidence, downgrade ALL severities.
 * 
 * This prevents hallucination-driven over-processing.
 */
function applyConfidenceDowngrade(deficiencies, photoConfidence, minConfidence) {
  const adjusted = {};
  
  for (const key of Object.keys(deficiencies)) {
    if (deficiencies[key]) {
      adjusted[key] = { ...deficiencies[key] };
      
      // Apply global photo confidence to downgrade
      if (photoConfidence < minConfidence) {
        // Downgrade by ~20 points (one severity level)
        adjusted[key].severity = Math.max(0, adjusted[key].severity - 20);
      }
    }
  }
  
  return adjusted;
}

/**
 * determineSkipReason(photo)
 * 
 * If no enhancements applied, explain why (for debugging).
 */
function determineSkipReason(photo) {
  if (photo.role === 'utility') {
    return 'Utility photo - minimal processing by design';
  }
  if (photo.analysisConfidence < 0.5) {
    return 'Low analysis confidence - skipped to avoid errors';
  }
  return 'No significant deficiencies detected';
}

/**
 * calculatePhotoConfidence(decisions, photo)
 * 
 * Expected outcome confidence for this photo.
 */
function calculatePhotoConfidence(decisions, photo) {
  if (decisions.length === 0) return 100; // No changes = no risk
  
  let confidence = photo.analysisConfidence * 100;
  
  // Deduct for each tool (risk of artifacts)
  confidence -= decisions.length * 5;
  
  // Higher base for supporting (less aggressive)
  if (photo.role === 'supporting') confidence += 5;
  
  return Math.max(50, Math.min(100, confidence));
}

/**
 * calculateListingConfidence(strategies, analyses, usage, caps)
 * 
 * Overall listing confidence score.
 * Determines "prepared" vs "needs_review".
 * 
 * Thresholds:
 *   >= 85: Prepared
 *   70-84: Prepared (minor issues)
 *   < 70:  Needs Review
 * 
 * ❗ FIX ISSUE 5: Only penalize caps when critical deficiencies were blocked.
 */
function calculateListingConfidence(strategies, analyses, usage, caps) {
  let score = 100;
  
  // 1. Hero coverage (were hero deficiencies addressed?)
  const heroStrategies = strategies.filter(s => s.role === 'hero');
  const heroWithEnhancements = heroStrategies.filter(s => s.decisions.length > 0);
  const heroCoverage = heroWithEnhancements.length / Math.max(1, heroStrategies.length);
  score -= (1 - heroCoverage) * 20;
  
  // 2. Critical deficiencies addressed
  const criticalDeficiencies = analyses.filter(a => 
    (a.deficiencies.sky?.severity >= 80) ||
    (a.deficiencies.lighting?.severity >= 80)
  );
  const criticalAddressed = criticalDeficiencies.filter(a => 
    strategies.find(s => s.photoId === a.photoId && s.decisions.length > 0)
  );
  const criticalCoverage = criticalDeficiencies.length > 0 
    ? criticalAddressed.length / criticalDeficiencies.length 
    : 1;
  score -= (1 - criticalCoverage) * 15;
  
  // ❗ FIX ISSUE 5: Only penalize caps when critical deficiencies exist AND were blocked
  // Caps doing their job correctly should NOT lower confidence.
  const criticalBlockedByCaps = analyses.filter(a => {
    const strategy = strategies.find(s => s.photoId === a.photoId);
    const hasCriticalSky = a.deficiencies.sky?.severity >= 80;
    const skyCapHit = usage.skyReplacement >= caps.skyReplacement;
    const skyNotApplied = !strategy?.toolOrder.includes('sky-replacement');
    
    // Only penalize if: critical deficiency exists AND cap blocked it
    return hasCriticalSky && skyCapHit && skyNotApplied;
  });
  
  score -= criticalBlockedByCaps.length * 5;
  
  // 3. Low confidence photos penalty
  const lowConfidencePhotos = strategies.filter(s => s.confidence < 70).length;
  score -= lowConfidencePhotos * 2;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * determineLockedPresets(strategies, analyses)
 * 
 * Lock presets from first application for consistency.
 */
function determineLockedPresets(strategies, analyses) {
  const presets = {};
  
  // Find first sky replacement and lock style
  const firstSky = strategies.find(s => 
    s.decisions.some(d => d.tool === 'sky-replacement')
  );
  if (firstSky) {
    const analysis = analyses.find(a => a.photoId === firstSky.photoId);
    presets.skyType = determineSkyPreset(analysis);
  }
  
  // Find twilight and lock tone
  const twilight = strategies.find(s => 
    s.decisions.some(d => d.tool === 'virtual-twilight')
  );
  if (twilight) {
    presets.twilightTone = 'blue-hour'; // Default
  }
  
  // Find lawn repair and lock green level
  const firstLawn = strategies.find(s => 
    s.decisions.some(d => d.tool === 'lawn-repair')
  );
  if (firstLawn) {
    presets.lawnGreen = 'natural'; // Conservative default
  }
  
  // HDR strength based on property type
  presets.hdrStrength = 'balanced';
  
  // Staging style
  presets.stagingStyle = 'modern';
  
  return presets;
}

/**
 * determineSkyPreset(analysis)
 */
function determineSkyPreset(analysis) {
  // Based on time of day, composition, property type
  if (analysis.scores.lighting >= 70) return 'soft-blue';
  if (analysis.scores.composition >= 80) return 'dramatic-clouds';
  return 'clear';
}

/**
 * calculateEstimatedTime(strategies)
 * 
 * Estimate processing time in seconds.
 */
function calculateEstimatedTime(strategies) {
  const TOOL_TIMES = {
    'sky-replacement': 8,
    'virtual-twilight': 12,
    'lawn-repair': 6,
    'pool-enhance': 6,
    'declutter': 8,
    'virtual-staging': 15,
    'fire-fireplace': 5,
    'hdr': 4,
    'auto-enhance': 4,
    'perspective-correction': 5,
    'window-masking': 10,
  };
  
  let totalTime = 0;
  for (const strategy of strategies) {
    for (const tool of strategy.toolOrder) {
      totalTime += TOOL_TIMES[tool] || 5;
    }
  }
  
  // Add analysis + QC overhead
  totalTime += strategies.length * 3;
  
  return totalTime;
}

/**
 * calculateEstimatedCost(strategies)
 * 
 * ❗ FIX ISSUE 4: Cost is TOOL-DRIVEN only.
 * Do NOT assume per-photo AutoEnhance cost.
 * Only count costs for tools actually applied.
 */
function calculateEstimatedCost(strategies) {
  const TOOL_COSTS = {
    'sky-replacement': 0.05,
    'virtual-twilight': 0.08,
    'lawn-repair': 0.05,
    'pool-enhance': 0.05,
    'declutter': 0.06,
    'virtual-staging': 0.10,
    'fire-fireplace': 0.04,
    'hdr': 0.03,
    'auto-enhance': 0.15,  // AutoEnhance.ai when explicitly applied
    'perspective-correction': 0.04,
    'window-masking': 0.06,
  };
  
  let totalCost = 0;
  
  // ❗ FIX: Only count tools actually in toolOrder
  for (const strategy of strategies) {
    for (const tool of strategy.toolOrder) {
      totalCost += TOOL_COSTS[tool] || 0.05;
    }
  }
  
  // Vision analysis cost (GPT-4o Vision per photo)
  totalCost += strategies.length * 0.02;
  
  // QC validation cost (GPT-4o Vision per photo)
  totalCost += strategies.length * 0.01;
  
  return Math.round(totalCost * 100) / 100;
}

// ============================================
// EXPORTS (for documentation only)
// ============================================

export {
  buildListingStrategy,
  applyConfidenceDowngrade,
  calculateListingConfidence,
  determineLockedPresets,
};
