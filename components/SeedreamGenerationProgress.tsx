'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Sparkles,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeedreamGenerationProgressProps {
  jobId: string;
  onComplete?: (outputs: Array<{ url: string; thumbnail: string }>) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  pollInterval?: number; // milliseconds, default 3000
  maxPollDuration?: number; // milliseconds, default 10 minutes
}

interface StatusResponse {
  success?: boolean;
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  estimatedTimeRemaining?: string;
  outputs?: Array<{
    url: string;
    thumbnail: string;
  }>;
  error?: string;
  errorCode?: string;
  suggestions?: string[];
  generationTime?: number;
  createdAt: string;
  completedAt?: string;
}

type GenerationPhase = 'initializing' | 'uploading' | 'processing' | 'finalizing' | 'completed' | 'failed';

export default function SeedreamGenerationProgress({
  jobId,
  onComplete,
  onError,
  onCancel,
  pollInterval = 3000,
  maxPollDuration = 10 * 60 * 1000, // 10 minutes
}: SeedreamGenerationProgressProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<GenerationPhase>('initializing');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate current phase based on progress
  const calculatePhase = useCallback((progress: number, jobStatus: string): GenerationPhase => {
    if (jobStatus === 'completed') return 'completed';
    if (jobStatus === 'failed') return 'failed';
    
    if (progress === 0) return 'initializing';
    if (progress < 20) return 'uploading';
    if (progress < 90) return 'processing';
    if (progress < 100) return 'finalizing';
    
    return 'processing';
  }, []);

  // Get phase display information
  const getPhaseInfo = (currentPhase: GenerationPhase) => {
    const phaseInfo = {
      initializing: {
        label: 'Initializing',
        description: 'Preparing your generation request...',
        icon: Loader2,
        color: 'text-blue-500',
      },
      uploading: {
        label: 'Uploading',
        description: 'Sending your images to the AI...',
        icon: Loader2,
        color: 'text-blue-500',
      },
      processing: {
        label: 'Generating',
        description: 'Creating your professional headshots...',
        icon: Sparkles,
        color: 'text-purple-500',
      },
      finalizing: {
        label: 'Finalizing',
        description: 'Almost done! Preparing your results...',
        icon: Loader2,
        color: 'text-green-500',
      },
      completed: {
        label: 'Complete',
        description: 'Your headshots are ready!',
        icon: CheckCircle,
        color: 'text-green-500',
      },
      failed: {
        label: 'Failed',
        description: 'Generation failed',
        icon: AlertCircle,
        color: 'text-red-500',
      },
    };

    return phaseInfo[currentPhase];
  };

  // Poll status endpoint
  const pollStatus = useCallback(async () => {
    if (!isPolling) return;

    try {
      const response = await fetch(`/api/seedream/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: StatusResponse = await response.json();

      // Handle rate limiting
      if (response.status === 429) {
        console.warn('Rate limited, will retry on next interval');
        return;
      }

      // Handle errors
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatus(data);
      setRetryCount(0); // Reset retry count on success
      setIsRetrying(false);

      // Update phase
      const newPhase = calculatePhase(data.progress, data.status);
      setPhase(newPhase);

      // Handle completion
      if (data.status === 'completed') {
        setIsPolling(false);
        if (data.outputs && onComplete) {
          onComplete(data.outputs);
        }
      }

      // Handle failure
      if (data.status === 'failed') {
        setIsPolling(false);
        const errorMessage = data.error || 'Generation failed';
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Status polling error:', err);
      
      // Implement retry logic with exponential backoff
      if (retryCount < 3) {
        setRetryCount((prev) => prev + 1);
        setIsRetrying(true);
        console.log(`Retrying... (${retryCount + 1}/3)`);
      } else {
        // After 3 retries, show error but keep polling
        setError('Connection issues. Still trying to fetch status...');
      }
    }
  }, [jobId, isPolling, onComplete, onError, calculatePhase, retryCount]);

  // Set up polling interval
  useEffect(() => {
    if (!isPolling) return;

    // Poll immediately
    pollStatus();

    // Set up interval
    const interval = setInterval(pollStatus, pollInterval);

    // Set up max duration timeout
    const timeout = setTimeout(() => {
      setIsPolling(false);
      setError('Generation is taking longer than expected. Please check back later.');
      if (onError) {
        onError('Generation timeout');
      }
    }, maxPollDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isPolling, pollStatus, pollInterval, maxPollDuration, onError]);

  // Track elapsed time
  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle manual retry
  const handleRetry = () => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    setIsPolling(true);
  };

  // Handle cancel
  const handleCancel = () => {
    setIsPolling(false);
    if (onCancel) {
      onCancel();
    }
  };

  const phaseInfo = getPhaseInfo(phase);
  const PhaseIcon = phaseInfo.icon;
  const progress = status?.progress || 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhaseIcon 
            className={cn(
              'h-5 w-5',
              phaseInfo.color,
              phase !== 'completed' && phase !== 'failed' && 'animate-spin'
            )} 
          />
          {phaseInfo.label}
        </CardTitle>
        <CardDescription>
          {phaseInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {phase !== 'failed' && (
          <div className="space-y-2">
            <Progress 
              value={progress} 
              className="h-3"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{progress}% complete</span>
              {status?.estimatedTimeRemaining && phase !== 'completed' && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {status.estimatedTimeRemaining} remaining
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status Information */}
        <div className="space-y-3">
          {/* Elapsed Time */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Elapsed time:</span>
            <span className="font-mono font-medium">{formatElapsedTime(elapsedTime)}</span>
          </div>

          {/* Generation Time (on completion) */}
          {phase === 'completed' && status?.generationTime && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Generation time:</span>
              <span className="font-mono font-medium">
                {Math.round(status.generationTime)}s
              </span>
            </div>
          )}

          {/* Job ID */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Job ID:</span>
            <span className="font-mono text-xs">{jobId.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Retry Indicator */}
        {isRetrying && (
          <Alert>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Connection issue detected. Retrying... ({retryCount}/3)
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && phase !== 'failed' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              {retryCount >= 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Failed State */}
        {phase === 'failed' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{status?.error || 'Generation failed'}</p>
                {status?.suggestions && status.suggestions.length > 0 && (
                  <ul className="text-sm space-y-1 mt-2">
                    {status.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Completed State */}
        {phase === 'completed' && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Your professional headshots are ready! 
              {status?.outputs && (
                <span className="font-medium ml-1">
                  ({status.outputs.length} images generated)
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Long-Running Generation Notice */}
        {elapsedTime > 120 && phase !== 'completed' && phase !== 'failed' && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              This generation is taking longer than usual. This can happen during high demand.
              Your request is still being processed.
            </AlertDescription>
          </Alert>
        )}

        {/* Cancel Button */}
        {phase !== 'completed' && phase !== 'failed' && onCancel && (
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full"
          >
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
