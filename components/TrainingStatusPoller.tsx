"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface TrainingStatusPollerProps {
  trainingId: string;
  onStatusChange?: (status: string) => void;
  onComplete?: () => void;
}

export default function TrainingStatusPoller({ 
  trainingId, 
  onStatusChange, 
  onComplete 
}: TrainingStatusPollerProps) {
  const [isPolling, setIsPolling] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>('processing');
  const { toast } = useToast();

  useEffect(() => {
    if (!trainingId || !isPolling) return;

    const pollStatus = async () => {
      try {
        const response = await fetch('/api/runpod/poll-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trainingId })
        });

        const result = await response.json();

        if (result.success) {
          const newStatus = result.dbStatus;
          
          if (newStatus !== currentStatus) {
            setCurrentStatus(newStatus);
            onStatusChange?.(newStatus);

            if (newStatus === 'finished') {
              setIsPolling(false);
              toast({
                title: "Training Complete!",
                description: "Your model is ready. Refreshing page...",
              });
              
              // Refresh the page after a short delay
              setTimeout(() => {
                window.location.reload();
              }, 2000);
              
              onComplete?.();
            } else if (newStatus === 'failed') {
              setIsPolling(false);
              toast({
                title: "Training Failed",
                description: "There was an issue with your model training.",
                variant: "destructive"
              });
            }
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    };

    // Poll immediately, then every 30 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 30000);

    // Stop polling after 30 minutes (max training time)
    const timeout = setTimeout(() => {
      setIsPolling(false);
      clearInterval(interval);
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [trainingId, isPolling, currentStatus, onStatusChange, onComplete, toast]);

  if (!isPolling || currentStatus === 'finished') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <div>
          <p className="text-sm font-medium text-blue-800">Training in Progress</p>
          <p className="text-xs text-blue-600">Status: {currentStatus}</p>
        </div>
      </div>
    </div>
  );
}