/**
 * SnapR AI Engine V3 - Listing Engine
 * =====================================
 * Main orchestrator for listing-level photo preparation
 * 
 * ALIGNED WITH: decision-engine/types.ts v1.2
 * 
 * V3 PRINCIPLES:
 * - Strategy builder decides presets (not orchestrator)
 * - Confidence score decides final status
 * - Execution reports facts, not quality judgments
 * - photo-intelligence outputs V3 PhotoAnalysis directly (no adapter)
 */

import { createClient } from '@/lib/supabase/server';
import { analyzePhotos } from './photo-intelligence';
import { buildListingStrategy, getStrategySummary } from './strategy-builder';
import { processListingBatch, orderByPriority, PhotoExecutionResult } from './batch-processor';
import { analyzeConsistency, getConsistencyReport } from './consistency';
import { validateResults, getValidationReport, quickValidate } from './quality-validator';
import { CONFIDENCE_THRESHOLDS } from '../decision-engine/types';
import {
  ListingProcessingResult,
  ProcessingProgress,
  ProcessingStatus,
  PrepareListingRequest,
  PrepareListingResponse,
} from './types';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  maxPhotos: 50,
  totalTimeoutMs: 600000, // 10 minutes
  enableFullValidation: false,
  enableConsistencyPass: true,
};

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function prepareListing(
  request: PrepareListingRequest,
  userId: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ListingProcessingResult> {
  const { listingId, options = {} } = request;
  const startTime = Date.now();
  
  console.log(`\n[ListingEngine] ========================================`);
  console.log(`[ListingEngine] PREPARE LISTING (V3): ${listingId}`);
  console.log(`[ListingEngine] ========================================\n`);
  
  const supabase = await createClient();
  
  try {
    await updateListingStatus(supabase, listingId, 'preparing');
    
    // ========================================
    // PHASE 1: FETCH PHOTOS
    // ========================================
    reportProgress(onProgress, listingId, 'analyzing', 'Fetching photos...', startTime);
    
    const photos = await fetchListingPhotos(supabase, listingId);
    
    if (photos.length === 0) {
      throw new Error('No photos found for this listing');
    }
    
    if (photos.length > CONFIG.maxPhotos) {
      console.warn(`[ListingEngine] Limiting to ${CONFIG.maxPhotos} photos`);
      photos.splice(CONFIG.maxPhotos);
    }
    
    console.log(`[ListingEngine] Found ${photos.length} photos`);
    
    // ========================================
    // PHASE 2: ANALYZE PHOTOS (GPT-4 Vision)
    // ========================================
    // V3: photo-intelligence now outputs PhotoAnalysis directly
    reportProgress(onProgress, listingId, 'analyzing', `Analyzing ${photos.length} photos with SnapR...`, startTime, { total: photos.length, analyzed: 0, processed: 0 });
    
    const analyses = await analyzePhotos(photos, {
      maxConcurrency: options.prioritizeSpeed ? 8 : 5,
    });
    
    console.log(`[ListingEngine] Analysis complete`);
    
    // ========================================
    // PHASE 3: BUILD STRATEGY
    // ========================================
    reportProgress(onProgress, listingId, 'strategizing', 'Building enhancement strategy...', startTime, { total: photos.length, analyzed: photos.length, processed: 0 });
    
    const strategy = buildListingStrategy(listingId, analyses);
    const lockedPresets = strategy.lockedPresets;
    
    console.log(`[ListingEngine] Strategy built:`, {
      confidence: strategy.confidenceScore,
      heroPhoto: strategy.heroPhotoId,
      twilightPhoto: strategy.twilightPhotoId,
      presets: {
        sky: lockedPresets.skyType,
        twilight: lockedPresets.twilightTone,
        staging: lockedPresets.stagingStyle,
      },
    });
    
    console.log(`\n${getStrategySummary(strategy)}\n`);
    
    // ========================================
    // PHASE 4: PROCESS PHOTOS
    // ========================================
    reportProgress(onProgress, listingId, 'processing', 'Enhancing photos...', startTime, { total: photos.length, analyzed: photos.length, processed: 0 });
    
    strategy.photoStrategies = orderByPriority(strategy.photoStrategies);
    
    const batchResult = await processListingBatch(strategy, {
      listingId,
      userId,
      lockedPresets,
      onProgress,
    });
    
    const photoResults = batchResult.photoResults;
    
    console.log(`[ListingEngine] Processing complete: ${batchResult.successCount}/${batchResult.totalPhotos} successful`);
    
    // ========================================
    // PHASE 5: CONSISTENCY PASS (Legacy)
    // ========================================
    // TEMP: Legacy adapter for consistency analyzer
    // TODO: Replace analyzeConsistency with V3-native version
    if (CONFIG.enableConsistencyPass) {
      reportProgress(onProgress, listingId, 'consistency_pass', 'Verifying consistency...', startTime, { total: photos.length, analyzed: photos.length, processed: photoResults.length });
      
      const legacyResults = photoResults.map(r => ({
        ...r,
        success: r.executionStatus === 'success' || r.executionStatus === 'partial',
        confidence: r.executionStatus === 'success' ? 90 : r.executionStatus === 'partial' ? 70 : 50,
        needsReview: r.executionStatus === 'failed' || r.executionErrors.length > 0,
      }));
      
      const consistency = await analyzeConsistency(legacyResults);
      console.log(`\n${getConsistencyReport(consistency.metrics, consistency.adjustments, consistency.consistencyScore)}\n`);
    }
    
    // ========================================
    // PHASE 6: VALIDATION (Legacy)
    // ========================================
    // TEMP: Legacy adapter for quality validator
    // TODO: Replace with V3-native validation
    reportProgress(onProgress, listingId, 'validating', 'Validating results...', startTime, { total: photos.length, analyzed: photos.length, processed: photoResults.length });
    
    const legacyForValidation = photoResults.map(r => ({
      photoId: r.photoId,
      originalUrl: r.originalUrl,
      enhancedUrl: r.enhancedUrl,
      toolsApplied: r.toolsApplied,
      success: r.executionStatus === 'success' || r.executionStatus === 'partial',
      error: r.executionErrors.length > 0 ? r.executionErrors[0] : undefined,
      confidence: r.executionStatus === 'success' ? 90 : r.executionStatus === 'partial' ? 70 : 50,
      processingTime: r.processingTimeMs,
      needsReview: r.executionStatus === 'failed' || r.executionErrors.length > 0,
    }));
    
    let validations;
    if (CONFIG.enableFullValidation) {
      validations = await validateResults(legacyForValidation);
    } else {
      validations = legacyForValidation.map(r => quickValidate(r));
    }
    
    console.log(`\n${getValidationReport(validations)}\n`);
    
    // ========================================
    // PHASE 7: FINALIZE
    // ========================================
    const successfulPhotos = batchResult.successCount + batchResult.partialCount;
    const failedPhotos = batchResult.failedCount;
    const photosNeedingReview = validations.filter(v => v.needsReview).length;
    
    // V3: Confidence score from strategy determines final status
    const confidenceScore = strategy.confidenceScore;
    
    let finalStatus: ProcessingStatus;
    if (confidenceScore >= CONFIDENCE_THRESHOLDS.PREPARED) {
      finalStatus = 'completed';
    } else if (confidenceScore >= CONFIDENCE_THRESHOLDS.PREPARED_MINOR) {
      finalStatus = 'needs_review';
    } else {
      finalStatus = 'failed';
    }
    
    await finalizeListing(supabase, listingId, {
      status: finalStatus === 'completed' ? 'prepared' : finalStatus,
      heroPhotoId: strategy.heroPhotoId,
      confidence: confidenceScore,
      toolsApplied: countToolsApplied(photoResults),
      lockedPresets: {
        sky: lockedPresets.skyType || 'soft-blue',
        twilight: lockedPresets.twilightTone || 'blue-hour',
        staging: lockedPresets.stagingStyle || 'modern',
      },
    });
    
    const totalTime = Date.now() - startTime;
    
    console.log(`\n[ListingEngine] ========================================`);
    console.log(`[ListingEngine] COMPLETE: ${finalStatus.toUpperCase()}`);
    console.log(`[ListingEngine] Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`[ListingEngine] Success: ${successfulPhotos}/${photoResults.length}`);
    console.log(`[ListingEngine] Confidence: ${confidenceScore}%`);
    console.log(`[ListingEngine] Presets: sky=${lockedPresets.skyType}, twilight=${lockedPresets.twilightTone}`);
    console.log(`[ListingEngine] ========================================\n`);
    
    return {
      listingId,
      status: finalStatus,
      heroPhotoId: strategy.heroPhotoId,
      photoResults: legacyForValidation,
      totalPhotos: photoResults.length,
      successfulPhotos,
      failedPhotos,
      photosNeedingReview,
      overallConfidence: confidenceScore,
      totalProcessingTime: totalTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
    };
    
  } catch (error: any) {
    console.error(`[ListingEngine] FAILED:`, error.message);
    
    await updateListingStatus(supabase, listingId, 'failed');
    
    return {
      listingId,
      status: 'failed',
      heroPhotoId: null,
      photoResults: [],
      totalPhotos: 0,
      successfulPhotos: 0,
      failedPhotos: 0,
      photosNeedingReview: 0,
      overallConfidence: 0,
      totalProcessingTime: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchListingPhotos(
  supabase: any,
  listingId: string
): Promise<Array<{ id: string; url: string }>> {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, raw_url')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch photos: ${error.message}`);
  }
  
  if (!photos || photos.length === 0) {
    return [];
  }
  
  const photosWithUrls: Array<{ id: string; url: string }> = [];
  
  for (const photo of photos) {
    const { data } = await supabase.storage
      .from('raw-images')
      .createSignedUrl(photo.raw_url, 3600);
    
    if (data?.signedUrl) {
      photosWithUrls.push({
        id: photo.id,
        url: data.signedUrl,
      });
    }
  }
  
  return photosWithUrls;
}

async function updateListingStatus(
  supabase: any,
  listingId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);
  
  if (error) {
    console.error(`[ListingEngine] Failed to update status:`, error.message);
  }
}

async function finalizeListing(
  supabase: any,
  listingId: string,
  data: {
    status: string;
    heroPhotoId: string | null;
    confidence: number;
    toolsApplied: Record<string, number>;
    lockedPresets: { sky: string; twilight: string; staging: string };
  }
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({
      status: data.status,
      hero_photo_id: data.heroPhotoId,
      prepared_at: data.status === 'prepared' ? new Date().toISOString() : null,
      preparation_metadata: {
        confidence: data.confidence,
        toolsApplied: data.toolsApplied,
        lockedPresets: data.lockedPresets,
        preparedAt: new Date().toISOString(),
        engineVersion: '3.0.0',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);
  
  if (error) {
    console.error(`[ListingEngine] Failed to finalize listing:`, error.message);
  }
}

function countToolsApplied(
  results: PhotoExecutionResult[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const result of results) {
    for (const tool of result.toolsApplied) {
      counts[tool] = (counts[tool] || 0) + 1;
    }
  }
  
  return counts;
}

function reportProgress(
  onProgress: ((progress: ProcessingProgress) => void) | undefined,
  listingId: string,
  status: ProcessingStatus,
  message: string,
  startTime: number,
  photoStats?: { total: number; analyzed: number; processed: number }
): void {
  if (onProgress) {
    onProgress({
      listingId,
      status,
      currentPhase: message,
      totalPhotos: photoStats?.total || 0,
      analyzedPhotos: photoStats?.analyzed || 0,
      processedPhotos: photoStats?.processed || 0,
      estimatedTimeRemaining: 0,
      startedAt: new Date(startTime).toISOString(),
      messages: [message],
    });
  }
}

// ============================================
// API RESPONSE BUILDER
// ============================================

export function buildPrepareResponse(
  result: ListingProcessingResult
): PrepareListingResponse {
  if (result.status === 'failed') {
    return {
      success: false,
      listingId: result.listingId,
      status: result.status,
      message: result.error || 'Preparation failed',
      error: result.error,
    };
  }
  
  let message: string;
  switch (result.status) {
    case 'completed':
      message = `Successfully prepared ${result.successfulPhotos} photos`;
      break;
    case 'needs_review':
      message = `Preparation complete, ${result.photosNeedingReview} photos need review`;
      break;
    default:
      message = `Preparation ${result.status}`;
  }
  
  return {
    success: true,
    listingId: result.listingId,
    status: result.status,
    message,
    estimatedTime: Math.round(result.totalProcessingTime / 1000),
  };
}

// ============================================
// EXPORTS
// ============================================

export * from './types';
export { analyzePhoto, analyzePhotos } from './photo-intelligence';
export { buildListingStrategy, getStrategySummary } from './strategy-builder';
export { validateResult, validateResults } from './quality-validator';
export { multiPassTwilight } from './multi-pass-twilight';
export { balanceWindowExposure, detectWindows } from './window-masking';
