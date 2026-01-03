'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Loader2, AlertCircle, Download, Eye, UserCheck, X } from 'lucide-react';

interface PhotoProgress {
  current: number;
  total: number;
}

interface PrepareResult {
  status: string;
  heroPhotoId?: string;
  confidenceScore: number;
  totalPhotos: number;
  enhancedPhotos: number;
  flaggedPhotos: number;
  processingTime?: number;
}

interface PreparationOverlayProps {
  listingId: string;
  listingTitle: string;
  photos: Array<{
    id: string;
    thumbnailUrl: string;
  }>;
  onComplete: (result: PrepareResult) => void;
  onCancel: () => void;
}

type Phase = 'analyzing' | 'strategizing' | 'executing' | 'verifying' | 'complete' | 'error';

interface ActivityItem {
  id: string;
  message: string;
  timestamp: number;
}

export function PreparationOverlay({
  listingId,
  listingTitle,
  photos,
  onComplete,
  onCancel,
}: PreparationOverlayProps) {
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Starting preparation...');
  const [title, setTitle] = useState('Preparing your listing');
  const [subtitle, setSubtitle] = useState('SnapR is analyzing and preparing all photos for MLS and marketing.');
  const [photoProgress, setPhotoProgress] = useState<PhotoProgress | null>(null);
  const [analyzedPhotos, setAnalyzedPhotos] = useState<Set<number>>(new Set());
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const activityIdRef = useRef(0);

  // Add activity item
  const addActivity = (msg: string) => {
    const id = `activity-${activityIdRef.current++}`;
    setActivityFeed(prev => [...prev.slice(-4), { id, message: msg, timestamp: Date.now() }]);
  };

  // Start SSE connection
  useEffect(() => {
    const startPreparation = async () => {
      try {
        const response = await fetch('/api/listing/prepare-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId }),
        });

        if (!response.ok) {
          throw new Error('Failed to start preparation');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(currentEvent, data);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
              currentEvent = '';
            }
          }
        }
      } catch (err: any) {
        console.error('Preparation error:', err);
        setError(err.message || 'Something went wrong');
        setPhase('error');
      }
    };

    startPreparation();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [listingId]);

  // Handle SSE events
  const handleEvent = (event: string, data: any) => {
    console.log('[Overlay] Event:', event, data);

    if (data.title) setTitle(data.title);
    if (data.subtitle) setSubtitle(data.subtitle);
    if (data.progress !== undefined) setProgress(data.progress);
    if (data.message) {
      setMessage(data.message);
      addActivity(data.message);
    }

    // Update photo progress
    if (data.photoProgress) {
      setPhotoProgress(data.photoProgress);
      
      // Mark photos as analyzed/processed
      if (event === 'analyzing') {
        setAnalyzedPhotos(prev => {
          const next = new Set(prev);
          for (let i = 0; i < data.photoProgress.current; i++) {
            next.add(i);
          }
          return next;
        });
      }
      
      // Set active photo during execution
      if (event === 'executing') {
        setActivePhotoIndex(data.photoProgress.current - 1);
      }
    }

    switch (event) {
      case 'analyzing':
        setPhase('analyzing');
        break;
      case 'strategizing':
        setPhase('strategizing');
        // Mark all photos as analyzed
        setAnalyzedPhotos(new Set(photos.map((_, i) => i)));
        setActivePhotoIndex(null);
        break;
      case 'executing':
        setPhase('executing');
        break;
      case 'verifying':
        setPhase('verifying');
        setActivePhotoIndex(null);
        break;
      case 'complete':
        setPhase('complete');
        setResult(data.result);
        setActivePhotoIndex(null);
        break;
      case 'error':
        setPhase('error');
        setError(data.message || 'Something went wrong');
        break;
    }
  };

  // Phase display config
  const phaseConfig: Record<Phase, { label: string; color: string }> = {
    analyzing: { label: 'Analyzing photos', color: 'text-blue-400' },
    strategizing: { label: 'Building strategy', color: 'text-purple-400' },
    executing: { label: 'Preparing photos', color: 'text-amber-400' },
    verifying: { label: 'Verifying quality', color: 'text-emerald-400' },
    complete: { label: 'Complete', color: 'text-green-400' },
    error: { label: 'Error', color: 'text-red-400' },
  };

  // Render completion state
  if (phase === 'complete' && result) {
    const isSuccess = result.status === 'prepared' || result.confidenceScore >= 70;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="w-full max-w-lg mx-4 bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300">
          {/* Success/Warning Header */}
          <div className={`p-6 ${isSuccess ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20' : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full ${isSuccess ? 'bg-emerald-500/30' : 'bg-yellow-500/30'} flex items-center justify-center`}>
                {isSuccess ? (
                  <Check className="w-8 h-8 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-400" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <p className="text-white/60 mt-1">{subtitle}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-6 border-b border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-white">{result.enhancedPhotos}</div>
                <div className="text-sm text-white/50">Photos Prepared</div>
              </div>
              <div>
                <div className={`text-3xl font-bold ${result.confidenceScore >= 80 ? 'text-emerald-400' : result.confidenceScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.confidenceScore}%
                </div>
                <div className="text-sm text-white/50">Confidence</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">
                  {result.processingTime ? `${Math.round(result.processingTime / 1000)}s` : '--'}
                </div>
                <div className="text-sm text-white/50">Time</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 space-y-3">
            <button
              onClick={() => onComplete(result)}
              className="w-full py-3 bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-black font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            >
              <Eye className="w-5 h-5" />
              View Prepared Photos
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button className="py-3 bg-white/10 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
                <Download className="w-4 h-4" />
                Export for MLS
              </button>
              <button className="py-3 bg-white/10 text-white font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
                <UserCheck className="w-4 h-4" />
                Request Review
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (phase === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="w-full max-w-md mx-4 bg-[#1A1A1A] rounded-2xl border border-red-500/30 overflow-hidden p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Render progress state
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onCancel}
              className="p-2 text-white/40 hover:text-white/70 hover:bg-white/10 rounded-lg transition-all"
              title="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/50 text-sm">{subtitle}</p>
        </div>

        {/* Progress */}
        <div className="p-6 border-b border-white/10">
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className={`w-4 h-4 animate-spin ${phaseConfig[phase].color}`} />
            <span className={`text-sm font-medium ${phaseConfig[phase].color}`}>
              {phaseConfig[phase].label}
              {photoProgress && ` (${photoProgress.current} of ${photoProgress.total})`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-[#D4A017] to-[#B8860B] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right text-sm text-white/40">{progress}%</div>
        </div>

        {/* Photo strip */}
        <div className="p-4 border-b border-white/10 overflow-x-auto">
          <div className="flex gap-2">
            {photos.slice(0, 12).map((photo, index) => (
              <div
                key={photo.id}
                className={`relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all duration-300 ${
                  activePhotoIndex === index
                    ? 'ring-2 ring-[#D4A017] scale-110'
                    : analyzedPhotos.has(index)
                    ? 'opacity-100'
                    : 'opacity-40'
                }`}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {analyzedPhotos.has(index) && activePhotoIndex !== index && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                {activePhotoIndex === index && (
                  <div className="absolute inset-0 bg-[#D4A017]/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-[#D4A017] animate-spin" />
                  </div>
                )}
              </div>
            ))}
            {photos.length > 12 && (
              <div className="w-16 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-white/50">+{photos.length - 12}</span>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="p-4 max-h-32 overflow-y-auto">
          <div className="space-y-2">
            {activityFeed.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm text-white/60 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4A017]" />
                <span>{item.message}</span>
              </div>
            ))}
            {activityFeed.length === 0 && (
              <div className="text-sm text-white/40 italic">Starting preparation...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
