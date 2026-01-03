/**
 * SnapR API - Prepare Listing (SSE Stream)
 * =========================================
 * POST /api/listing/prepare-stream
 * 
 * Returns Server-Sent Events for real-time preparation progress
 * 
 * Events:
 * - analyzing: Photo analysis phase
 * - strategizing: Strategy building phase
 * - executing: Enhancement execution phase
 * - verifying: Quality control phase
 * - complete: Preparation finished
 * - error: Something went wrong
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prepareListing } from '@/lib/ai/listing-engine';
import { ProcessingProgress } from '@/lib/ai/listing-engine/types';

// SSE Helper - formats event for streaming
function formatSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// User-friendly messages (outcome-focused, not technical)
const PHASE_MESSAGES: Record<string, string[]> = {
  analyzing: [
    'Identifying exterior and interior photos',
    'Analyzing lighting and composition',
    'Evaluating sky and lawn conditions',
    'Detecting room types and features',
    'Scoring hero photo candidates',
  ],
  strategizing: [
    'Selecting hero photo',
    'Choosing consistent sky style',
    'Planning enhancements for consistency',
    'Determining optimal improvements',
  ],
  processing: [
    'Improving exterior lighting',
    'Balancing interior exposure',
    'Enhancing visual appeal',
    'Applying consistent color profile',
    'Optimizing for MLS standards',
  ],
  executing: [
    'Improving exterior lighting',
    'Balancing interior exposure', 
    'Enhancing visual appeal',
    'Applying consistent color profile',
  ],
  consistency_pass: [
    'Ensuring visual consistency',
    'Matching color profiles across photos',
    'Verifying listing cohesion',
  ],
  validating: [
    'Checking for visual artifacts',
    'Ensuring MLS-safe appearance',
    'Verifying consistency across photos',
    'Final quality review',
  ],
};

// Get random message for phase
function getPhaseMessage(phase: string): string {
  const messages = PHASE_MESSAGES[phase] || PHASE_MESSAGES['processing'];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Map internal phases to user-facing phases
function mapPhase(internalPhase: string): string {
  const phaseMap: Record<string, string> = {
    'analyzing': 'analyzing',
    'strategizing': 'strategizing',
    'processing': 'executing',
    'executing': 'executing',
    'consistency_pass': 'verifying',
    'validating': 'verifying',
    'completed': 'complete',
    'needs_review': 'complete',
  };
  return phaseMap[internalPhase] || internalPhase;
}

// Calculate progress percentage based on phase
function calculateProgress(phase: string, photoProgress?: { current: number; total: number }): number {
  const phaseWeights: Record<string, { start: number; end: number }> = {
    'analyzing': { start: 0, end: 25 },
    'strategizing': { start: 25, end: 35 },
    'processing': { start: 35, end: 85 },
    'executing': { start: 35, end: 85 },
    'consistency_pass': { start: 85, end: 92 },
    'validating': { start: 92, end: 100 },
    'complete': { start: 100, end: 100 },
  };

  const weight = phaseWeights[phase] || { start: 50, end: 60 };
  
  if (photoProgress && (phase === 'processing' || phase === 'executing' || phase === 'analyzing')) {
    const phaseRange = weight.end - weight.start;
    const photoPercent = photoProgress.current / photoProgress.total;
    return Math.round(weight.start + (phaseRange * photoPercent));
  }
  
  return weight.start;
}

export async function POST(request: NextRequest) {
  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(formatSSE(event, data)));
      };

      try {
        // Parse request
        const body = await request.json();
        const { listingId, options = {} } = body;

        if (!listingId) {
          send('error', { message: 'listingId is required' });
          controller.close();
          return;
        }

        // Authenticate user
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          send('error', { message: 'Unauthorized' });
          controller.close();
          return;
        }

        // Verify user owns the listing
        const { data: listing, error: listingError } = await supabase
          .from('listings')
          .select('id, user_id, title, status')
          .eq('id', listingId)
          .single();

        if (listingError || !listing) {
          send('error', { message: 'Listing not found' });
          controller.close();
          return;
        }

        if (listing.user_id !== user.id) {
          send('error', { message: 'You do not own this listing' });
          controller.close();
          return;
        }

        // Check if already preparing
        if (listing.status === 'preparing') {
          send('error', { message: 'Listing is already being prepared' });
          controller.close();
          return;
        }

        // Send initial event
        send('analyzing', {
          phase: 'analyzing',
          progress: 0,
          message: 'Starting preparation...',
          title: 'Preparing your listing',
          subtitle: 'SnapR is analyzing and preparing all photos for MLS and marketing.',
        });

        // Track last sent phase to avoid duplicates
        let lastPhase = '';
        let lastProgress = 0;

        // Progress callback
        const onProgress = (progress: ProcessingProgress) => {
          const userPhase = mapPhase(progress.currentPhase);
          const calculatedProgress = calculateProgress(progress.currentPhase, { current: progress.processedPhotos, total: progress.totalPhotos });
          
          // Only send if meaningful change
          if (userPhase !== lastPhase || calculatedProgress > lastProgress + 5) {
            lastPhase = userPhase;
            lastProgress = calculatedProgress;

            const message = progress.messages?.[0] || getPhaseMessage(progress.currentPhase);
            
            send(userPhase, {
              phase: userPhase,
              progress: calculatedProgress,
              message: message,
              photoProgress: { current: progress.processedPhotos, total: progress.totalPhotos },
            });
          }
        };

        // Run preparation
        const result = await prepareListing(
          { listingId, options },
          user.id,
          onProgress
        );

        // Send completion event
        const isSuccess = result.status !== 'failed' && result.status !== 'needs_review';
        
        send('complete', {
          phase: 'complete',
          progress: 100,
          message: isSuccess 
            ? 'Your listing is ready' 
            : 'Your listing needs attention',
          result: {
            status: result.status,
            heroPhotoId: result.heroPhotoId,
            confidenceScore: result.overallConfidence || 85,
            totalPhotos: result.totalPhotos,
            enhancedPhotos: result.successfulPhotos,
            flaggedPhotos: result.photosNeedingReview || 0,
            processingTime: result.totalProcessingTime,
          },
          title: isSuccess 
            ? 'Your listing is ready'
            : 'Your listing needs attention',
          subtitle: isSuccess
            ? 'All photos have been prepared consistently for MLS, portals, and marketing.'
            : 'Some photos may need review before publishing.',
        });

        controller.close();

      } catch (error: any) {
        console.error('[PrepareStream] Error:', error);
        
        // Send user-friendly error
        const send = (event: string, data: object) => {
          controller.enqueue(encoder.encode(formatSSE(event, data)));
        };
        
        send('error', {
          phase: 'error',
          message: 'Something went wrong. Please try again.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
        
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
