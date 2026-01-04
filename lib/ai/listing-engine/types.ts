/**
 * SnapR AI Engine V3 - Listing Engine Types
 * ==========================================
 * Types for orchestration, execution, and API responses
 * 
 * NOTE: PhotoAnalysis, PhotoStrategy, ListingStrategy are in decision-engine/types.ts
 */

// ============================================
// PROCESSING STATUS
// ============================================

export type ProcessingStatus = 
  | 'analyzing'
  | 'strategizing'
  | 'processing'
  | 'consistency_pass'
  | 'validating'
  | 'completed'
  | 'needs_review'
  | 'failed';

// ============================================
// PROCESSING PROGRESS (SSE Updates)
// ============================================

export interface ProcessingProgress {
  listingId: string;
  status: ProcessingStatus;
  currentPhase: string;
  totalPhotos: number;
  analyzedPhotos: number;
  processedPhotos: number;
  currentPhotoId?: string;
  currentTool?: string;
  estimatedTimeRemaining: number;
  startedAt: string;
  messages: string[];
}

// ============================================
// PHOTO PROCESSING RESULT (Legacy)
// ============================================

export interface PhotoProcessingResult {
  photoId: string;
  originalUrl: string;
  enhancedUrl: string | null;
  toolsApplied: string[];
  success: boolean;
  error?: string;
  confidence: number;
  processingTime: number;
  needsReview: boolean;
}

// ============================================
// LISTING PROCESSING RESULT
// ============================================

export interface ListingProcessingResult {
  listingId: string;
  status: ProcessingStatus;
  heroPhotoId: string | null;
  photoResults: PhotoProcessingResult[];
  totalPhotos: number;
  successfulPhotos: number;
  failedPhotos: number;
  photosNeedingReview: number;
  overallConfidence: number;
  totalProcessingTime: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

// ============================================
// CONSISTENCY METRICS
// ============================================

export interface ConsistencyMetrics {
  averageBrightness: number;
  averageContrast: number;
  averageWarmth: number;
  averageSaturation: number;
}

export interface ConsistencyAdjustment {
  photoId: string;
  brightness: number;
  contrast: number;
  warmth: number;
  saturation: number;
}

// ============================================
// VALIDATION TYPES
// ============================================

export interface ValidationResult {
  photoId: string;
  isValid: boolean;
  confidence: number;
  needsReview: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'quality' | 'artifacts' | 'inconsistency' | 'incomplete';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface PrepareListingRequest {
  listingId: string;
  options?: {
    prioritizeSpeed?: boolean;
    enhancementLevel?: 'basic' | 'standard' | 'premium';
  };
}

export interface PrepareListingResponse {
  success: boolean;
  listingId: string;
  status: ProcessingStatus;
  message: string;
  estimatedTime?: number;
  error?: string;
}

export interface ListingStatusResponse {
  listingId: string;
  status: ProcessingStatus;
  progress?: ProcessingProgress;
  result?: ListingProcessingResult;
}
