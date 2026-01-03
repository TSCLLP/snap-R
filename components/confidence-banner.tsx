'use client';

import { Check, AlertCircle, AlertTriangle, X, ChevronDown, Download, Share2 } from 'lucide-react';
import { useState } from 'react';

interface ConfidenceBannerProps {
  status: 'prepared' | 'needs_review' | 'draft' | 'preparing';
  confidenceScore: number;
  totalPhotos: number;
  enhancedPhotos: number;
  flaggedPhotos?: number;
  onExport?: () => void;
  onShare?: () => void;
  onDismiss?: () => void;
}

export function ConfidenceBanner({
  status,
  confidenceScore,
  totalPhotos,
  enhancedPhotos,
  flaggedPhotos = 0,
  onExport,
  onShare,
  onDismiss,
}: ConfidenceBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status === 'draft' || status === 'preparing') {
    return null;
  }

  // Determine banner style based on confidence
  const getBannerConfig = () => {
    if (status === 'needs_review' || confidenceScore < 60) {
      return {
        bg: 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20',
        border: 'border-orange-500/30',
        icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
        iconBg: 'bg-orange-500/20',
        title: 'Your listing needs attention',
        subtitle: 'Some photos may need review before publishing.',
        titleColor: 'text-orange-400',
      };
    }
    
    if (confidenceScore >= 80) {
      return {
        bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
        border: 'border-emerald-500/30',
        icon: <Check className="w-5 h-5 text-emerald-400" />,
        iconBg: 'bg-emerald-500/20',
        title: 'Your listing is ready to publish',
        subtitle: 'All photos prepared consistently for MLS and marketing.',
        titleColor: 'text-emerald-400',
      };
    }
    
    // 60-79 confidence
    return {
      bg: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20',
      border: 'border-yellow-500/30',
      icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
      iconBg: 'bg-yellow-500/20',
      title: 'Your listing is ready',
      subtitle: 'Some photos may benefit from review.',
      titleColor: 'text-yellow-400',
    };
  };

  const config = getBannerConfig();

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl overflow-hidden mb-6 transition-all duration-300`}>
      {/* Main banner */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center`}>
              {config.icon}
            </div>
            <div>
              <h3 className={`font-semibold ${config.titleColor}`}>{config.title}</h3>
              <p className="text-sm text-white/50">{config.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Confidence score badge */}
            <div className={`px-3 py-1.5 rounded-lg ${config.iconBg}`}>
              <span className="text-sm font-semibold text-white">{confidenceScore}%</span>
              <span className="text-xs text-white/50 ml-1">confidence</span>
            </div>

            {/* Quick actions */}
            {onExport && (
              <button
                onClick={onExport}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
                title="Export for MLS"
              >
                <Download className="w-4 h-4 text-white/70" />
              </button>
            )}
            
            {onShare && (
              <button
                onClick={onShare}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
                title="Share with client"
              >
                <Share2 className="w-4 h-4 text-white/70" />
              </button>
            )}

            {/* Expand/collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
            >
              <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Dismiss */}
            {onDismiss && (
              <button
                onClick={() => {
                  setDismissed(true);
                  onDismiss();
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10 pt-4 animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{totalPhotos}</div>
              <div className="text-xs text-white/50">Total Photos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{enhancedPhotos}</div>
              <div className="text-xs text-white/50">Enhanced</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${flaggedPhotos > 0 ? 'text-yellow-400' : 'text-white/30'}`}>
                {flaggedPhotos}
              </div>
              <div className="text-xs text-white/50">Need Review</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                confidenceScore >= 80 ? 'text-emerald-400' : 
                confidenceScore >= 60 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {confidenceScore}%
              </div>
              <div className="text-xs text-white/50">Confidence</div>
            </div>
          </div>

          {flaggedPhotos > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-400">
                {flaggedPhotos} photo{flaggedPhotos > 1 ? 's' : ''} flagged for review. 
                These may have minor issues that could benefit from manual adjustment.
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button 
              onClick={onExport}
              className="flex-1 py-2 bg-gradient-to-r from-[#D4A017] to-[#B8860B] text-black font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            >
              <Download className="w-4 h-4" />
              Export for MLS
            </button>
            <button 
              onClick={onShare}
              className="flex-1 py-2 bg-white/10 text-white font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share with Client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
