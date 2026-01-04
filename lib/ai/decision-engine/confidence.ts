/**
 * SnapR Decision Engine - Confidence Scoring v1.1
 * Status: 🔒 LOCKED - DO NOT MODIFY WITHOUT APPROVAL
 * 
 * This file defines HOW we determine if a listing is "prepared" or "needs_review".
 * 
 * ALIGNED WITH: 
 * - decision-engine.spec.md
 * - pseudo.ts v1.1
 * - types.ts v1.2
 * 
 * THRESHOLDS:
 *   >= 70: PREPARED (ready to publish, may have minor flags)
 *   < 70:  NEEDS_REVIEW (manual intervention required)
 * 
 * NOTE: There is NO "prepared_minor" status. Minor issues are communicated
 * via flags array, not status. This keeps the API contract simple:
 *   - status === 'prepared' → Can publish
 *   - status === 'needs_review' → Cannot publish without review
 * 
 * CHANGELOG:
 * v1.1 - Fixed duplicate export, clarified PREPARED_MINOR, documented consistency limitation
 */

import {
  PhotoStrategy,
  PhotoAnalysis,
  ListingCaps,
  CapsUsage,
  ListingStatus,
  CONFIDENCE_THRESHOLDS,
  TOOL_METADATA,
  ToolId,
} from './types';

// ============================================
// SCORING WEIGHTS
// ============================================

/**
 * Weights for confidence score calculation.
 * Each weight represents max penalty points for that category.
 * Total max penalty = 100 (score goes from 100 to 0).
 */
const SCORING_WEIGHTS = {
  // Hero coverage: Were hero photos enhanced?
  HERO_COVERAGE: 25,
  
  // Critical deficiencies: Were severe issues addressed?
  CRITICAL_COVERAGE: 20,
  
  // Caps blocked critical: Did caps prevent fixing critical issues?
  CAPS_BLOCKED_CRITICAL: 15,
  
  // Low confidence photos: Photos with uncertain outcomes
  LOW_CONFIDENCE_PHOTOS: 10,
  
  // Tool risk accumulation: High-risk tools applied
  HIGH_RISK_TOOLS: 10,
  
  // Consistency score: Visual cohesion across listing
  CONSISTENCY: 10,
  
  // Analysis confidence: Vision AI certainty
  ANALYSIS_CONFIDENCE: 10,
} as const;

// ============================================
// MAIN CONFIDENCE CALCULATOR
// ============================================

export interface ConfidenceResult {
  score: number;              // 0-100
  status: ListingStatus;      // 'prepared' | 'needs_review' (NO 'prepared_minor')
  breakdown: ConfidenceBreakdown;
  flags: ConfidenceFlag[];    // Minor issues communicated here, not via status
}

export interface ConfidenceBreakdown {
  heroCoverage: number;       // 0-100 (higher = better)
  criticalCoverage: number;   // 0-100 (higher = better)
  capsImpact: number;         // 0-100 (lower = better, 0 = no critical blocked)
  photoConfidence: number;    // 0-100 (higher = better)
  riskScore: number;          // 0-100 (lower = better)
  consistencyScore: number;   // 0-100 (higher = better)
  analysisConfidence: number; // 0-100 (higher = better)
}

export interface ConfidenceFlag {
  type: 'warning' | 'error' | 'info';
  code: string;
  message: string;
  photoIds?: string[];
}

/**
 * calculateListingConfidence
 * 
 * Main entry point for confidence scoring.
 * 
 * @param strategies - Per-photo strategies from decision engine
 * @param analyses - Original photo analyses from Vision AI
 * @param capsUsage - How many caps were consumed
 * @param caps - Listing-level caps
 * @returns ConfidenceResult with score, status, breakdown, and flags
 */
export function calculateListingConfidence(
  strategies: PhotoStrategy[],
  analyses: PhotoAnalysis[],
  capsUsage: CapsUsage,
  caps: ListingCaps
): ConfidenceResult {
  const breakdown: ConfidenceBreakdown = {
    heroCoverage: 0,
    criticalCoverage: 0,
    capsImpact: 0,
    photoConfidence: 0,
    riskScore: 0,
    consistencyScore: 0,
    analysisConfidence: 0,
  };
  
  const flags: ConfidenceFlag[] = [];
  
  // ========================================
  // 1. HERO COVERAGE (25 points max penalty)
  // ========================================
  // Were hero photos enhanced appropriately?
  
  const heroStrategies = strategies.filter(s => s.role === 'hero');
  const heroWithEnhancements = heroStrategies.filter(s => s.decisions.length > 0);
  
  if (heroStrategies.length > 0) {
    breakdown.heroCoverage = (heroWithEnhancements.length / heroStrategies.length) * 100;
  } else {
    breakdown.heroCoverage = 100; // No heroes = nothing to enhance
  }
  
  if (breakdown.heroCoverage < 50) {
    flags.push({
      type: 'warning',
      code: 'LOW_HERO_COVERAGE',
      message: `Only ${heroWithEnhancements.length}/${heroStrategies.length} hero photos enhanced`,
      photoIds: heroStrategies
        .filter(s => s.decisions.length === 0)
        .map(s => s.photoId),
    });
  }
  
  // ========================================
  // 2. CRITICAL DEFICIENCIES (20 points max penalty)
  // ========================================
  // Were severe issues (severity >= 80) addressed?
  
  const criticalPhotos = analyses.filter(a => 
    (a.deficiencies.sky?.severity ?? 0) >= 80 ||
    (a.deficiencies.lighting?.severity ?? 0) >= 80 ||
    (a.deficiencies.perspective?.severity ?? 0) >= 80
  );
  
  const criticalAddressed = criticalPhotos.filter(a => {
    const strategy = strategies.find(s => s.photoId === a.photoId);
    return strategy && strategy.decisions.length > 0;
  });
  
  if (criticalPhotos.length > 0) {
    breakdown.criticalCoverage = (criticalAddressed.length / criticalPhotos.length) * 100;
  } else {
    breakdown.criticalCoverage = 100; // No critical issues
  }
  
  if (breakdown.criticalCoverage < 80) {
    flags.push({
      type: 'error',
      code: 'CRITICAL_DEFICIENCIES_UNADDRESSED',
      message: `${criticalPhotos.length - criticalAddressed.length} critical deficiencies not addressed`,
      photoIds: criticalPhotos
        .filter(a => !criticalAddressed.includes(a))
        .map(a => a.photoId),
    });
  }
  
  // ========================================
  // 3. CAPS IMPACT (15 points max penalty)
  // ========================================
  // Did caps block critical deficiencies?
  // Per pseudo.ts v1.1: Only penalize when critical issues were blocked
  
  const criticalBlockedByCaps = analyses.filter(a => {
    const strategy = strategies.find(s => s.photoId === a.photoId);
    if (!strategy) return false;
    
    // Check each cap type
    const hasCriticalSky = (a.deficiencies.sky?.severity ?? 0) >= 80;
    const skyCapHit = capsUsage.skyReplacement >= caps.skyReplacement;
    const skyNotApplied = !strategy.toolOrder.includes('sky-replacement');
    
    if (hasCriticalSky && skyCapHit && skyNotApplied) return true;
    
    // Add more cap checks as needed
    return false;
  });
  
  breakdown.capsImpact = criticalBlockedByCaps.length > 0 
    ? Math.min(100, criticalBlockedByCaps.length * 25) 
    : 0;
  
  if (criticalBlockedByCaps.length > 0) {
    flags.push({
      type: 'warning',
      code: 'CAPS_BLOCKED_CRITICAL',
      message: `${criticalBlockedByCaps.length} critical issues skipped due to caps`,
      photoIds: criticalBlockedByCaps.map(a => a.photoId),
    });
  }
  
  // ========================================
  // 4. PHOTO CONFIDENCE (10 points max penalty)
  // ========================================
  // How confident are we in individual photo outcomes?
  
  const avgPhotoConfidence = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + s.confidence, 0) / strategies.length
    : 100;
  
  breakdown.photoConfidence = avgPhotoConfidence;
  
  const lowConfidencePhotos = strategies.filter(s => s.confidence < 70);
  if (lowConfidencePhotos.length > 0) {
    flags.push({
      type: 'info',
      code: 'LOW_CONFIDENCE_PHOTOS',
      message: `${lowConfidencePhotos.length} photos have uncertain outcomes`,
      photoIds: lowConfidencePhotos.map(s => s.photoId),
    });
  }
  
  // ========================================
  // 5. RISK SCORE (10 points max penalty)
  // ========================================
  // How many high-risk tools were applied?
  // Uses riskLevel from TOOL_METADATA (types.ts v1.2)
  
  const allTools = strategies.flatMap(s => s.toolOrder);
  const highRiskTools = allTools.filter(t => TOOL_METADATA[t]?.riskLevel === 'high');
  const mediumRiskTools = allTools.filter(t => TOOL_METADATA[t]?.riskLevel === 'medium');
  
  // Risk score: high=10 points, medium=3 points each, max 100
  const riskPoints = (highRiskTools.length * 10) + (mediumRiskTools.length * 3);
  breakdown.riskScore = Math.min(100, riskPoints);
  
  if (highRiskTools.length > 3) {
    flags.push({
      type: 'warning',
      code: 'HIGH_RISK_TOOL_CONCENTRATION',
      message: `${highRiskTools.length} high-risk tools applied`,
    });
  }
  
  // ========================================
  // 6. CONSISTENCY SCORE (10 points max penalty)
  // ========================================
  // Will the listing look visually cohesive?
  //
  // ⚠️ V1 LIMITATION ACKNOWLEDGED:
  // This is a tool-count heuristic. It assumes more unique tools = less consistency.
  // This is sometimes true but not always (e.g., hdr + sky + lawn is fine).
  // 
  // Future versions should use:
  // - lockedPresets divergence
  // - Color histogram drift between photos
  // - Sky tone variance
  //
  // For v1, this is acceptable but known to be a weak signal.
  
  const uniqueTools = new Set(allTools);
  const toolVariety = uniqueTools.size;
  
  // Too many different tools = inconsistent look
  // Ideal: 3-6 unique tools. Penalty above 8.
  if (toolVariety <= 6) {
    breakdown.consistencyScore = 100;
  } else if (toolVariety <= 8) {
    breakdown.consistencyScore = 80;
  } else {
    breakdown.consistencyScore = Math.max(50, 100 - (toolVariety - 6) * 10);
  }
  
  // ========================================
  // 7. ANALYSIS CONFIDENCE (10 points max penalty)
  // ========================================
  // How confident was Vision AI in its analysis?
  
  const avgAnalysisConfidence = analyses.length > 0
    ? analyses.reduce((sum, a) => sum + a.analysisConfidence, 0) / analyses.length
    : 1;
  
  breakdown.analysisConfidence = avgAnalysisConfidence * 100;
  
  if (avgAnalysisConfidence < 0.7) {
    flags.push({
      type: 'warning',
      code: 'LOW_ANALYSIS_CONFIDENCE',
      message: `Average analysis confidence is ${Math.round(avgAnalysisConfidence * 100)}%`,
    });
  }
  
  // ========================================
  // CALCULATE FINAL SCORE
  // ========================================
  
  let score = 100;
  
  // Apply penalties based on weights
  score -= (100 - breakdown.heroCoverage) * (SCORING_WEIGHTS.HERO_COVERAGE / 100);
  score -= (100 - breakdown.criticalCoverage) * (SCORING_WEIGHTS.CRITICAL_COVERAGE / 100);
  score -= breakdown.capsImpact * (SCORING_WEIGHTS.CAPS_BLOCKED_CRITICAL / 100);
  score -= (100 - breakdown.photoConfidence) * (SCORING_WEIGHTS.LOW_CONFIDENCE_PHOTOS / 100);
  score -= breakdown.riskScore * (SCORING_WEIGHTS.HIGH_RISK_TOOLS / 100);
  score -= (100 - breakdown.consistencyScore) * (SCORING_WEIGHTS.CONSISTENCY / 100);
  score -= (100 - breakdown.analysisConfidence) * (SCORING_WEIGHTS.ANALYSIS_CONFIDENCE / 100);
  
  // Clamp to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // ========================================
  // DETERMINE STATUS
  // ========================================
  // 
  // ❗ FIX ISSUE 1: NO "prepared_minor" status.
  // There are only two statuses:
  //   - 'prepared': Score >= 70, can publish
  //   - 'needs_review': Score < 70, cannot publish without review
  //
  // Minor issues (score 70-84) are communicated via flags, not status.
  // This keeps the API contract simple and avoids ambiguity.
  
  let status: ListingStatus;
  if (score >= CONFIDENCE_THRESHOLDS.PREPARED_MINOR) {
    status = 'prepared';
    
    // Add info flag if score is in "minor issues" range (70-84)
    if (score < CONFIDENCE_THRESHOLDS.PREPARED) {
      flags.push({
        type: 'info',
        code: 'PREPARED_WITH_MINOR_ISSUES',
        message: `Score ${score}% - publishable but review recommended`,
      });
    }
  } else {
    status = 'needs_review';
    
    // Add error flag for needs_review
    flags.unshift({
      type: 'error',
      code: 'NEEDS_MANUAL_REVIEW',
      message: `Confidence score ${score}% below threshold. Manual review required.`,
    });
  }
  
  return {
    score,
    status,
    breakdown,
    flags,
  };
}

// ============================================
// QUICK CONFIDENCE CHECK
// ============================================

/**
 * Quick check without full breakdown.
 * Use for progress updates and early termination.
 */
export function quickConfidenceCheck(strategies: PhotoStrategy[]): number {
  if (strategies.length === 0) return 100;
  
  const avgConfidence = strategies.reduce((sum, s) => sum + s.confidence, 0) / strategies.length;
  const heroStrategies = strategies.filter(s => s.role === 'hero');
  const heroEnhanced = heroStrategies.filter(s => s.decisions.length > 0).length;
  const heroCoverage = heroStrategies.length > 0 
    ? (heroEnhanced / heroStrategies.length) * 100 
    : 100;
  
  return Math.round((avgConfidence * 0.6) + (heroCoverage * 0.4));
}

// ============================================
// NEEDS REVIEW REASONS
// ============================================

export type NeedsReviewReason = 
  | 'critical_deficiencies_unaddressed'
  | 'low_hero_coverage'
  | 'caps_blocked_critical'
  | 'low_analysis_confidence'
  | 'high_risk_concentration'
  | 'multiple_qc_failures';

/**
 * Get human-readable explanation for needs_review status.
 */
export function getNeedsReviewExplanation(flags: ConfidenceFlag[]): string {
  const errorFlags = flags.filter(f => f.type === 'error');
  const warningFlags = flags.filter(f => f.type === 'warning');
  
  if (errorFlags.length > 0) {
    return errorFlags[0].message;
  }
  
  if (warningFlags.length > 0) {
    return `${warningFlags.length} issues detected: ${warningFlags[0].message}`;
  }
  
  return 'Manual review recommended for quality assurance.';
}

// ============================================
// PHOTO-LEVEL CONFIDENCE
// ============================================

/**
 * Calculate confidence for a single photo.
 * Used during strategy building.
 */
export function calculatePhotoConfidence(
  decisions: { tool: ToolId; priority: string }[],
  analysisConfidence: number,
  role: string
): number {
  if (decisions.length === 0) return 100; // No changes = no risk
  
  let confidence = analysisConfidence * 100;
  
  // Deduct for each tool based on risk level
  for (const decision of decisions) {
    const metadata = TOOL_METADATA[decision.tool];
    if (metadata) {
      switch (metadata.riskLevel) {
        case 'high':
          confidence -= 8;
          break;
        case 'medium':
          confidence -= 4;
          break;
        case 'low':
          confidence -= 2;
          break;
      }
    }
  }
  
  // Role-based adjustment
  if (role === 'supporting') {
    confidence += 5; // Supporting photos get lighter treatment
  } else if (role === 'utility') {
    confidence += 10; // Utility photos get minimal treatment
  }
  
  return Math.max(50, Math.min(100, Math.round(confidence)));
}

// ============================================
// EXPORTS
// ============================================

// Only export what this module uniquely defines.
// CONFIDENCE_THRESHOLDS is imported from types.ts - do NOT re-export to avoid confusion.
export { SCORING_WEIGHTS };
