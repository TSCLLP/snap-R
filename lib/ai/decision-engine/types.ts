/**
 * SnapR Decision Engine - Canonical Types v1.2
 * Status: 🔒 LOCKED - DO NOT MODIFY WITHOUT APPROVAL
 * 
 * These types define the contract between:
 * - Vision Intelligence (input)
 * - Decision Engine (processing)
 * - Strategy Builder (output)
 * 
 * ALIGNED WITH: pseudo.ts v1.1
 * 
 * CHANGELOG:
 * v1.2 - Fixed tool governance, subType union, priority weights, cost alignment
 */

// ============================================
// PHOTO ROLE CLASSIFICATION
// ============================================

export type PhotoRole = 'hero' | 'supporting' | 'utility';

// ============================================
// DEFICIENCY TYPES
// ============================================

/**
 * Deficiency represents a single issue detected in a photo.
 * 
 * NOTE: confidence is NOT per-deficiency.
 * Per pseudo.ts v1.1 Issue 3 fix:
 * We use photo.analysisConfidence globally for all deficiencies.
 */
export interface Deficiency {
  severity: number;      // 0-100 (Critical: 80+, High: 60-79, Medium: 40-59, Low: 20-39, None: 0-19)
  coverage?: number;     // 0-100 (% of image affected, for sky/lawn)
}

export interface DeficiencyMap {
  sky?: Deficiency;
  lawn?: Deficiency;
  lighting?: Deficiency;
  clutter?: Deficiency;
  perspective?: Deficiency;
  color?: Deficiency;
  pool?: Deficiency;
}

// ============================================
// PHOTO TYPES (Strict Union - No Loose Strings)
// ============================================

/**
 * ❗ FIX ISSUE 2: subType is now a strict union.
 * This prevents edge-case bugs from loose string matching.
 */
export type PhotoType = 'exterior' | 'interior' | 'drone' | 'detail';

export type PhotoSubType = 
  // Exterior
  | 'front'
  | 'back'
  | 'side'
  | 'aerial'
  // Interior - Main
  | 'kitchen'
  | 'living'
  | 'dining'
  | 'bedroom'
  | 'bathroom'
  | 'office'
  // Interior - Utility
  | 'garage'
  | 'laundry'
  | 'storage'
  | 'basement'
  | 'attic'
  // Features
  | 'pool'
  | 'patio'
  | 'balcony'
  | 'garden'
  // Catch-all (use sparingly)
  | 'other';

// ============================================
// PHOTO ANALYSIS (Vision Intelligence Output)
// ============================================

export interface PhotoScores {
  composition: number;   // 0-100
  lighting: number;      // 0-100
  sharpness: number;     // 0-100
}

export interface PhotoAnalysis {
  photoId: string;
  photoUrl: string;
  photoType: PhotoType;
  subType: PhotoSubType;  // ❗ Now strict union
  scores: PhotoScores;
  deficiencies: DeficiencyMap;
  heroScore: number;     // 0-100
  heroReason?: string;
  
  // Feature detection (boolean only - severity is in deficiencies)
  hasSky: boolean;
  hasLawn: boolean;
  hasPool: boolean;
  hasFireplace: boolean;
  hasWindows: boolean;
  isEmpty: boolean;      // Empty room (staging candidate)
  
  // Global confidence from Vision AI
  // Per pseudo.ts v1.1: This is used for ALL deficiency downgrade decisions
  analysisConfidence: number;  // 0-1
  
  // Assigned during Phase 1 (not from Vision)
  role?: PhotoRole;
}

// ============================================
// TOOL TYPES
// ============================================

export type ToolId = 
  | 'sky-replacement'
  | 'virtual-twilight'
  | 'lawn-repair'
  | 'pool-enhance'
  | 'declutter'
  | 'virtual-staging'
  | 'fire-fireplace'
  | 'tv-screen'
  | 'lights-on'
  | 'hdr'
  | 'auto-enhance'
  | 'perspective-correction'
  | 'window-masking'
  | 'flash-fix';

/**
 * ❗ FIX ISSUE 1: Tool Governance
 * 
 * Tools fall into these categories:
 * - AUTO_ELIGIBLE: Can be auto-applied by decision engine
 * - MANUAL_ONLY: Only via manual user selection
 * - QC_RETRY: Applied during QC failure retry phase
 * - FALLBACK: Low-priority, used when no other tools apply
 */
export const AUTO_ELIGIBLE_TOOLS: ToolId[] = [
  'sky-replacement',
  'virtual-twilight',
  'lawn-repair',
  'pool-enhance',
  'declutter',
  'virtual-staging',
  'fire-fireplace',
  'hdr',
  'perspective-correction',
];

export const MANUAL_ONLY_TOOLS: ToolId[] = [
  'tv-screen',      // Too many hallucinations
  'window-masking', // Complex, user preference
];

export const QC_RETRY_TOOLS: ToolId[] = [
  'auto-enhance',   // Used when structural tools fail QC
  'flash-fix',      // Used when lighting issues detected in QC
];

export const FALLBACK_TOOLS: ToolId[] = [
  'lights-on',      // Only when explicitly dark AND no other fixes
];

// ============================================
// DECISION PRIORITY
// ============================================

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * ❗ FIX ISSUE 3: Priority weights for sorting and cap preemption.
 * 
 * Priority affects:
 * - Execution order (higher priority tools run first)
 * - Cap preemption (if caps nearly full, prioritize high-priority decisions)
 * - QC retry selection (critical issues retry first)
 */
export const PRIORITY_WEIGHT: Record<DecisionPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Sort decisions by priority (descending).
 */
export function sortByPriority<T extends { priority: DecisionPriority }>(decisions: T[]): T[] {
  return [...decisions].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
}

// ============================================
// ENHANCEMENT DECISION
// ============================================

export interface EnhancementDecision {
  tool: ToolId;
  preset?: string;
  reason: string;        // Internal debugging only - never shown to user
  priority: DecisionPriority;
}

// ============================================
// PHOTO STRATEGY (Per-Photo Output)
// ============================================

export interface PhotoStrategy {
  photoId: string;
  photoUrl: string;
  role: PhotoRole;
  decisions: EnhancementDecision[];
  toolOrder: ToolId[];   // Execution order (tools applied sequentially)
  confidence: number;    // 0-100 Expected outcome confidence
  skipReason?: string;   // If no enhancements, why (for debugging)
}

// ============================================
// LISTING CAPS
// ============================================

export interface ListingCaps {
  skyReplacement: number;
  lawnRepair: number;
  declutter: number;
  virtualStaging: number;
  twilight: number;
  fireFireplace: number;
  poolEnhance: number;
}

export interface CapsUsage {
  skyReplacement: number;
  lawnRepair: number;
  declutter: number;
  virtualStaging: number;
  twilight: number;
  fireFireplace: number;
  poolEnhance: number;
}

/**
 * Calculate caps based on listing size.
 * Per pseudo.ts Phase 2.
 */
export function calculateCaps(totalPhotos: number, interiorPhotos: number, poolPhotos: number): ListingCaps {
  return {
    skyReplacement: Math.min(3, Math.ceil(totalPhotos * 0.15)),
    lawnRepair: Math.min(4, Math.ceil(totalPhotos * 0.20)),
    declutter: Math.ceil(interiorPhotos * 0.30),
    virtualStaging: 2,
    twilight: 1,
    fireFireplace: 1,
    poolEnhance: Math.min(2, poolPhotos),
  };
}

export function createEmptyCapsUsage(): CapsUsage {
  return {
    skyReplacement: 0,
    lawnRepair: 0,
    declutter: 0,
    virtualStaging: 0,
    twilight: 0,
    fireFireplace: 0,
    poolEnhance: 0,
  };
}

// ============================================
// LOCKED PRESETS (Consistency)
// ============================================

export type SkyPreset = 'soft-blue' | 'dramatic-clouds' | 'sunset' | 'clear';
export type TwilightPreset = 'blue-hour' | 'golden-hour' | 'dusk';
export type LawnPreset = 'natural' | 'vibrant' | 'golf-course';
export type HdrPreset = 'light' | 'balanced' | 'dramatic';
export type StagingPreset = 'modern' | 'traditional' | 'minimalist' | 'contemporary';
export type ColorTempPreset = 'warm' | 'neutral' | 'cool';

export interface LockedPresets {
  skyType?: SkyPreset;
  twilightTone?: TwilightPreset;
  lawnGreen?: LawnPreset;
  hdrStrength?: HdrPreset;
  stagingStyle?: StagingPreset;
  colorTemp?: ColorTempPreset;
}

// ============================================
// LISTING STRATEGY (Full Output)
// ============================================

export interface ListingStrategy {
  listingId: string;
  totalPhotos: number;
  
  // Role distribution (from Phase 1)
  heroCount: number;
  supportingCount: number;
  utilityCount: number;
  
  // Per-photo strategies (from Phase 4)
  photoStrategies: PhotoStrategy[];
  
  // Consistency (from Phase 5)
  lockedPresets: LockedPresets;
  
  // Caps (from Phase 2)
  caps: ListingCaps;
  capsUsage: CapsUsage;
  
  // Selected photos (from Phase 3)
  heroPhotoId: string;
  twilightPhotoId: string | null;  // null if no exteriors
  
  // Estimates (from Phase 6)
  estimatedTime: number;     // seconds
  estimatedCost: number;     // USD
  
  // Confidence (from Phase 7)
  confidenceScore: number;   // 0-100
}

// ============================================
// CONFIDENCE THRESHOLDS
// ============================================

export const CONFIDENCE_THRESHOLDS = {
  PREPARED: 85,           // >= 85: Ready to publish
  PREPARED_MINOR: 70,     // 70-84: Prepared with minor issues
  NEEDS_REVIEW: 0,        // < 70: Needs manual review
} as const;

export type ListingStatus = 'prepared' | 'needs_review' | 'processing' | 'failed';

export function getListingStatus(confidenceScore: number): ListingStatus {
  if (confidenceScore >= CONFIDENCE_THRESHOLDS.PREPARED_MINOR) {
    return 'prepared';
  }
  return 'needs_review';
}

// ============================================
// SAFETY OVERRIDES
// ============================================

export interface SafetyOverrides {
  maxEnhancementsPerListing?: number;   // Hard cap on total tool applications
  conservativeMode?: boolean;            // Triggered by trust signals (new user, free tier)
  disabledTools?: ToolId[];              // Additional tools to disable
  costCap?: number;                      // USD max spend
}

// ============================================
// DECISION ENGINE CONFIG
// ============================================

export interface DecisionEngineConfig {
  // Role thresholds (% of listing)
  heroPercentage: number;        // Default: 0.15 (15%)
  utilityPercentage: number;     // Default: 0.20 (20%)
  
  // Severity thresholds (per spec)
  criticalThreshold: number;     // Default: 80
  highThreshold: number;         // Default: 60
  mediumThreshold: number;       // Default: 40
  lowThreshold: number;          // Default: 20
  
  // Confidence threshold for downgrade
  // Per pseudo.ts v1.1: If photo.analysisConfidence < this, downgrade all severities
  minConfidence: number;         // Default: 0.6
  
  // Property type (affects presets and caps)
  propertyType: 'residential' | 'luxury' | 'rental' | 'commercial';
  
  // Optional overrides
  overrides?: SafetyOverrides;
}

// ============================================
// DEFAULT CONFIG
// ============================================

export const DEFAULT_CONFIG: DecisionEngineConfig = {
  heroPercentage: 0.15,
  utilityPercentage: 0.20,
  criticalThreshold: 80,
  highThreshold: 60,
  mediumThreshold: 40,
  lowThreshold: 20,
  minConfidence: 0.6,
  propertyType: 'residential',
};

// ============================================
// TOOL METADATA
// ============================================

/**
 * Execution groups for parallelization and ordering.
 * - structural: Major changes (sky, twilight, staging)
 * - content: Object-level changes (declutter, fire, pool)
 * - polish: Final touches (HDR, perspective, flash)
 */
export type ExecutionGroup = 'structural' | 'content' | 'polish';

/**
 * Risk level for QC and confidence scoring.
 * - high: Can create significant artifacts
 * - medium: Moderate chance of issues
 * - low: Generally safe
 */
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolMetadata {
  id: ToolId;
  name: string;
  category: 'exterior' | 'interior' | 'enhance';
  estimatedTime: number;  // seconds
  estimatedCost: number;  // USD - ❗ SINGLE SOURCE OF TRUTH
  requiresFeature?: keyof Pick<PhotoAnalysis, 'hasSky' | 'hasLawn' | 'hasPool' | 'hasFireplace' | 'hasWindows' | 'isEmpty'>;
  capKey?: keyof ListingCaps;
  autoEligible: boolean;  // ❗ FIX ISSUE 1: Explicit governance
  executionGroup: ExecutionGroup;  // ❗ OPTIONAL IMPROVEMENT 1
  riskLevel: RiskLevel;           // ❗ OPTIONAL IMPROVEMENT 2
}

/**
 * ❗ FIX ISSUE 4: TOOL_METADATA is the SINGLE SOURCE OF TRUTH for costs.
 * pseudo.ts should reference this, not hardcode values.
 */
export const TOOL_METADATA: Record<ToolId, ToolMetadata> = {
  'sky-replacement': {
    id: 'sky-replacement',
    name: 'Sky Replacement',
    category: 'exterior',
    estimatedTime: 8,
    estimatedCost: 0.05,
    requiresFeature: 'hasSky',
    capKey: 'skyReplacement',
    autoEligible: true,
    executionGroup: 'structural',
    riskLevel: 'medium',
  },
  'virtual-twilight': {
    id: 'virtual-twilight',
    name: 'Virtual Twilight',
    category: 'exterior',
    estimatedTime: 12,
    estimatedCost: 0.08,
    capKey: 'twilight',
    autoEligible: true,
    executionGroup: 'structural',
    riskLevel: 'high',
  },
  'lawn-repair': {
    id: 'lawn-repair',
    name: 'Lawn Repair',
    category: 'exterior',
    estimatedTime: 6,
    estimatedCost: 0.05,
    requiresFeature: 'hasLawn',
    capKey: 'lawnRepair',
    autoEligible: true,
    executionGroup: 'content',
    riskLevel: 'low',
  },
  'pool-enhance': {
    id: 'pool-enhance',
    name: 'Pool Enhancement',
    category: 'exterior',
    estimatedTime: 6,
    estimatedCost: 0.05,
    requiresFeature: 'hasPool',
    capKey: 'poolEnhance',
    autoEligible: true,
    executionGroup: 'content',
    riskLevel: 'low',
  },
  'declutter': {
    id: 'declutter',
    name: 'Declutter',
    category: 'interior',
    estimatedTime: 8,
    estimatedCost: 0.06,
    capKey: 'declutter',
    autoEligible: true,
    executionGroup: 'content',
    riskLevel: 'medium',
  },
  'virtual-staging': {
    id: 'virtual-staging',
    name: 'Virtual Staging',
    category: 'interior',
    estimatedTime: 15,
    estimatedCost: 0.10,
    requiresFeature: 'isEmpty',
    capKey: 'virtualStaging',
    autoEligible: true,
    executionGroup: 'structural',
    riskLevel: 'high',
  },
  'fire-fireplace': {
    id: 'fire-fireplace',
    name: 'Fire in Fireplace',
    category: 'interior',
    estimatedTime: 5,
    estimatedCost: 0.04,
    requiresFeature: 'hasFireplace',
    capKey: 'fireFireplace',
    autoEligible: true,
    executionGroup: 'content',
    riskLevel: 'low',
  },
  'tv-screen': {
    id: 'tv-screen',
    name: 'TV Screen Replace',
    category: 'interior',
    estimatedTime: 5,
    estimatedCost: 0.04,
    autoEligible: false,  // ❗ MANUAL ONLY - too many hallucinations
    executionGroup: 'content',
    riskLevel: 'high',
  },
  'lights-on': {
    id: 'lights-on',
    name: 'Lights On',
    category: 'interior',
    estimatedTime: 5,
    estimatedCost: 0.04,
    autoEligible: false,  // ❗ FALLBACK - only when explicitly dark
    executionGroup: 'content',
    riskLevel: 'medium',
  },
  'hdr': {
    id: 'hdr',
    name: 'HDR Enhancement',
    category: 'enhance',
    estimatedTime: 4,
    estimatedCost: 0.03,
    autoEligible: true,
    executionGroup: 'polish',
    riskLevel: 'low',
  },
  'auto-enhance': {
    id: 'auto-enhance',
    name: 'Auto Enhance',
    category: 'enhance',
    estimatedTime: 4,
    estimatedCost: 0.10,  // ❗ FIX ISSUE 4: Aligned with AutoEnhance.ai pricing
    autoEligible: false,  // ❗ QC_RETRY - used when structural tools fail
    executionGroup: 'polish',
    riskLevel: 'low',
  },
  'perspective-correction': {
    id: 'perspective-correction',
    name: 'Perspective Correction',
    category: 'enhance',
    estimatedTime: 5,
    estimatedCost: 0.04,
    autoEligible: true,
    executionGroup: 'polish',
    riskLevel: 'medium',
  },
  'window-masking': {
    id: 'window-masking',
    name: 'Window Masking',
    category: 'interior',
    estimatedTime: 10,
    estimatedCost: 0.06,
    requiresFeature: 'hasWindows',
    autoEligible: false,  // ❗ MANUAL ONLY - complex, user preference
    executionGroup: 'content',
    riskLevel: 'medium',
  },
  'flash-fix': {
    id: 'flash-fix',
    name: 'Flash Fix',
    category: 'enhance',
    estimatedTime: 4,
    estimatedCost: 0.03,
    autoEligible: false,  // ❗ QC_RETRY - used when lighting issues in QC
    executionGroup: 'polish',
    riskLevel: 'low',
  },
};

// ============================================
// HELPER: Get tool cost from metadata
// ============================================

export function getToolCost(toolId: ToolId): number {
  return TOOL_METADATA[toolId]?.estimatedCost ?? 0.05;
}

export function getToolTime(toolId: ToolId): number {
  return TOOL_METADATA[toolId]?.estimatedTime ?? 5;
}

/**
 * Calculate total cost for a list of tools.
 * Uses TOOL_METADATA as single source of truth.
 */
export function calculateToolsCost(tools: ToolId[]): number {
  return tools.reduce((sum, tool) => sum + getToolCost(tool), 0);
}

/**
 * Calculate total time for a list of tools.
 */
export function calculateToolsTime(tools: ToolId[]): number {
  return tools.reduce((sum, tool) => sum + getToolTime(tool), 0);
}
