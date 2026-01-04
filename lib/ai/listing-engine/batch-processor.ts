/**
 * SnapR AI Engine V3 - Batch Processor
 * =====================================
 * Executes enhancements with:
 * - Locked presets for consistency
 * - Multi-pass twilight for superior quality
 * - Window balancing for interiors
 * 
 * ALIGNED WITH: decision-engine/types.ts v1.2
 * 
 * IMPORTANT: This is an EXECUTION engine, not a DECISION engine.
 * - It does NOT decide quality (confidence.ts does that)
 * - It does NOT force enhancements (strategy-builder.ts decides that)
 * - It ONLY executes what the strategy specifies
 */

import {
  PhotoStrategy,
  ListingStrategy,
  LockedPresets,
  ToolId,
} from '../decision-engine/types';
import { ProcessingProgress } from './types';
import { processEnhancement } from '../router';
import { getLockedPrompt } from './preset-locker';
import { multiPassTwilight } from './multi-pass-twilight';
import { balanceWindowExposure } from './window-masking';
import { autoEnhance } from '../providers/autoenhance';
import { createClient } from '@/lib/supabase/server';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  maxConcurrency: 3,
  maxRetries: 2,
  retryDelayMs: 2000,
  toolTimeoutMs: 120000,
  batchDelayMs: 500,
  useMultiPassTwilight: true,
  useWindowBalancing: true,
  maxConsecutiveFailures: 5,
};

// ============================================
// TYPES (Execution-focused)
// ============================================

export type ExecutionStatus = 'success' | 'partial' | 'failed' | 'skipped';

export interface PhotoExecutionResult {
  photoId: string;
  originalUrl: string;
  enhancedUrl: string | null;
  toolsApplied: ToolId[];
  toolsAttempted: ToolId[];
  executionStatus: ExecutionStatus;
  executionErrors: string[];
  processingTimeMs: number;
}

export interface BatchExecutionResult {
  listingId: string;
  totalPhotos: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  skippedCount: number;
  photoResults: PhotoExecutionResult[];
  totalProcessingTimeMs: number;
  abortReason?: string;
}

interface ProcessingContext {
  listingId: string;
  userId: string;
  lockedPresets: LockedPresets;
  twilightPhotoId: string | null;
  onProgress?: (progress: ProcessingProgress) => void;
  plan?: 'free' | 'starter' | 'pro' | 'enterprise';
  costCap?: number;
}

// ============================================
// MAIN BATCH PROCESSOR
// ============================================

export async function processListingBatch(
  strategy: ListingStrategy,
  context: Omit<ProcessingContext, 'twilightPhotoId'>
): Promise<BatchExecutionResult> {
  console.log(`[BatchProcessor] Starting batch for listing ${strategy.listingId}`);
  console.log(`[BatchProcessor] ${strategy.photoStrategies.length} photos`);
  
  const startTime = Date.now();
  const photoResults: PhotoExecutionResult[] = [];
  const supabase = await createClient();
  
  const fullContext: ProcessingContext = {
    ...context,
    twilightPhotoId: strategy.twilightPhotoId,
  };
  
  let consecutiveFailures = 0;
  let abortReason: string | undefined;
  
  const photosWithUrls = await getSignedUrls(strategy.photoStrategies, supabase);
  
  for (let i = 0; i < photosWithUrls.length; i += CONFIG.maxConcurrency) {
    if (consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
      abortReason = `Circuit breaker: ${consecutiveFailures} consecutive failures`;
      console.error(`[BatchProcessor] ${abortReason}`);
      break;
    }
    
    const batch = photosWithUrls.slice(i, i + CONFIG.maxConcurrency);
    
    if (fullContext.onProgress) {
      fullContext.onProgress({
        listingId: fullContext.listingId,
        status: 'processing',
        currentPhase: 'Enhancing photos',
        totalPhotos: strategy.totalPhotos,
        analyzedPhotos: strategy.totalPhotos,
        processedPhotos: photoResults.length,
        estimatedTimeRemaining: estimateRemainingTime(strategy, photoResults.length),
        startedAt: new Date(startTime).toISOString(),
        messages: [`Processing photos ${i + 1} to ${Math.min(i + CONFIG.maxConcurrency, photosWithUrls.length)}`],
      });
    }
    
    const batchResults = await Promise.all(
      batch.map(photo => processPhotoExecution(photo, fullContext, supabase))
    );
    photoResults.push(...batchResults);
    
    for (const result of batchResults) {
      if (result.executionStatus === 'failed') {
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }
    }
    
    if (i + CONFIG.maxConcurrency < photosWithUrls.length) {
      await delay(CONFIG.batchDelayMs);
    }
  }
  
  return {
    listingId: strategy.listingId,
    totalPhotos: strategy.totalPhotos,
    successCount: photoResults.filter(r => r.executionStatus === 'success').length,
    partialCount: photoResults.filter(r => r.executionStatus === 'partial').length,
    failedCount: photoResults.filter(r => r.executionStatus === 'failed').length,
    skippedCount: photoResults.filter(r => r.executionStatus === 'skipped').length,
    photoResults,
    totalProcessingTimeMs: Date.now() - startTime,
    abortReason,
  };
}

// ============================================
// SINGLE PHOTO EXECUTOR
// ============================================

async function processPhotoExecution(
  photo: PhotoStrategy & { signedUrl: string },
  context: ProcessingContext,
  supabase: any
): Promise<PhotoExecutionResult> {
  const startTime = Date.now();
  let currentUrl = photo.signedUrl;
  const appliedTools: ToolId[] = [];
  const executionErrors: string[] = [];
  
  const isTwilightTarget = photo.photoId === context.twilightPhotoId;
  
  if (photo.toolOrder.length === 0) {
    return {
      photoId: photo.photoId,
      originalUrl: photo.signedUrl,
      enhancedUrl: null,
      toolsApplied: [],
      toolsAttempted: [],
      executionStatus: 'skipped',
      executionErrors: [],
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // AutoEnhance: Only if in toolOrder or premium plan
  const shouldAutoEnhance =
    photo.toolOrder.includes('auto-enhance') ||
    context.plan === 'pro' ||
    context.plan === 'enterprise';
  
  if (shouldAutoEnhance) {
    try {
      const autoEnhancedUrl = await autoEnhance(currentUrl, {
        enhance_type: "property",
        hdr: true,
        denoise: true,
        white_balance: true,
        sharpen: true,
      });
      if (autoEnhancedUrl) {
        currentUrl = autoEnhancedUrl;
        appliedTools.push('auto-enhance');
      }
    } catch (error: any) {
      executionErrors.push(`auto-enhance: ${error.message}`);
    }
  }
  
  const toolsToProcess = photo.toolOrder.filter(t => t !== 'auto-enhance');
  
  for (const tool of toolsToProcess) {
    try {
      let result: { success: boolean; enhancedUrl?: string; error?: string };
      
      if (tool === 'virtual-twilight' && CONFIG.useMultiPassTwilight && isTwilightTarget) {
        try {
          const twilightResult = await multiPassTwilight(currentUrl, {
            preset: context.lockedPresets.twilightTone || 'blue-hour',
            enhanceWindowGlow: true,
            glowIntensity: 'medium',
          });
          result = { success: twilightResult.success, enhancedUrl: twilightResult.url };
        } catch {
          result = await applyToolWithPresets(currentUrl, tool, context.lockedPresets);
        }
      } else if (tool === 'window-masking' && CONFIG.useWindowBalancing) {
        try {
          const balanceResult = await balanceWindowExposure(currentUrl, {
            showOutdoorView: true,
            viewType: 'sky',
          });
          result = { success: balanceResult.balanced, enhancedUrl: balanceResult.url };
        } catch (error: any) {
          result = { success: false, error: error.message };
        }
      } else {
        result = await applyToolWithPresets(currentUrl, tool, context.lockedPresets);
      }
      
      if (result.success && result.enhancedUrl) {
        currentUrl = result.enhancedUrl;
        appliedTools.push(tool);
      } else {
        executionErrors.push(`${tool}: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      executionErrors.push(`${tool}: ${error.message}`);
    }
  }
  
  let finalUrl = currentUrl;
  if (appliedTools.length > 0 && currentUrl !== photo.signedUrl) {
    try {
      finalUrl = await saveEnhancedPhoto(currentUrl, photo.photoId, context.listingId, context.userId, supabase);
    } catch (error: any) {
      executionErrors.push(`save: ${error.message}`);
    }
  }
  
  let executionStatus: ExecutionStatus;
  if (appliedTools.length === photo.toolOrder.length) {
    executionStatus = 'success';
  } else if (appliedTools.length > 0) {
    executionStatus = 'partial';
  } else {
    executionStatus = 'failed';
  }
  
  return {
    photoId: photo.photoId,
    originalUrl: photo.signedUrl,
    enhancedUrl: appliedTools.length > 0 ? finalUrl : null,
    toolsApplied: appliedTools,
    toolsAttempted: photo.toolOrder,
    executionStatus,
    executionErrors,
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================
// HELPERS
// ============================================

async function applyToolWithPresets(
  imageUrl: string,
  tool: ToolId,
  presets: LockedPresets,
  attempt = 1
): Promise<{ success: boolean; enhancedUrl?: string; error?: string }> {
  try {
    const lockedPrompt = getLockedPrompt(tool, presets);
    const result = await withTimeout(
      processEnhancement(tool, imageUrl, { prompt: lockedPrompt }),
      CONFIG.toolTimeoutMs,
      `${tool} timeout`
    );
    return { success: result.success, enhancedUrl: result.enhancedUrl, error: result.error };
  } catch (error: any) {
    if (attempt < CONFIG.maxRetries) {
      await delay(CONFIG.retryDelayMs);
      return applyToolWithPresets(imageUrl, tool, presets, attempt + 1);
    }
    return { success: false, error: error.message || 'Enhancement failed' };
  }
}

async function getSignedUrls(strategies: PhotoStrategy[], supabase: any): Promise<(PhotoStrategy & { signedUrl: string })[]> {
  const results: (PhotoStrategy & { signedUrl: string })[] = [];
  for (const strategy of strategies) {
    const { data } = await supabase.storage.from('raw-images').createSignedUrl(strategy.photoUrl, 3600);
    results.push({ ...strategy, signedUrl: data?.signedUrl || strategy.photoUrl });
  }
  return results;
}

async function saveEnhancedPhoto(enhancedUrl: string, photoId: string, listingId: string, userId: string, supabase: any): Promise<string> {
  const response = await fetch(enhancedUrl);
  if (!response.ok) throw new Error('Failed to fetch enhanced image');
  
  const buffer = await response.arrayBuffer();
  const storagePath = `enhanced/${userId}/${listingId}/${photoId}-prepared.jpg`;
  
  const { error: uploadError } = await supabase.storage.from('raw-images').upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
  
  await supabase.from('photos').update({ processed_url: storagePath, status: 'completed', variant: 'prepared', updated_at: new Date().toISOString() }).eq('id', photoId);
  
  const { data } = await supabase.storage.from('raw-images').createSignedUrl(storagePath, 3600);
  return data?.signedUrl || enhancedUrl;
}

function estimateRemainingTime(strategy: ListingStrategy, processedCount: number): number {
  const remaining = strategy.totalPhotos - processedCount;
  const avgTimePerPhoto = strategy.estimatedTime / strategy.totalPhotos;
  return Math.round(remaining * avgTimePerPhoto);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export function orderByPriority(strategies: PhotoStrategy[]): PhotoStrategy[] {
  const roleOrder = { hero: 0, supporting: 1, utility: 2 };
  return [...strategies].sort((a, b) => {
    const roleA = roleOrder[a.role] ?? 1;
    const roleB = roleOrder[b.role] ?? 1;
    if (roleA !== roleB) return roleA - roleB;
    return b.toolOrder.length - a.toolOrder.length;
  });
}
