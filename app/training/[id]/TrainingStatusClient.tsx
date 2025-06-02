'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type TrainingStatus = {
  id: string;
  status: 'processing' | 'succeeded' | 'failed';
  progress: number;
  modelName: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export default function TrainingStatusClient({ trainingId }: { trainingId: string }) {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [training, setTraining] = useState<TrainingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Check authentication and get user ID
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          router.push('/auth/signin?redirectedFrom=' + encodeURIComponent(`/training/${trainingId}`));
          return;
        }
        
        setUserId(session.user.id);
      } catch (err) {
        console.error('Auth error:', err);
        setError('Failed to verify authentication');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [trainingId, router, supabase]);

  // Fetch training status
  useEffect(() => {
    if (!userId) return;

    const fetchTrainingStatus = async () => {
      try {
        // This would be a real API call in your app
        // const response = await fetch(`/api/training/${trainingId}?userId=${userId}`);
        // const data = await response.json();
        
        // Simulated response
        const mockTraining: TrainingStatus = {
          id: trainingId,
          status: 'processing',
          progress: 45, // This would come from your API
          modelName: 'Your Model',
          startedAt: new Date().toISOString(),
        };
        
        setTraining(mockTraining);
        setIsLoading(false);
        
        // Set up polling in a real app
        // const interval = setInterval(fetchTrainingStatus, 5000);
        // return () => clearInterval(interval);
      } catch (err) {
        console.error('Error fetching training status:', err);
        setError('Failed to load training status');
        setIsLoading(false);
      }
    };

    fetchTrainingStatus();
  }, [userId, trainingId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Training not found</h1>
        <p>The requested training could not be found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-6">
          {training.status === 'succeeded' 
            ? 'Training Complete!' 
            : training.status === 'failed'
            ? 'Training Failed'
            : 'Training in Progress'}
        </h1>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Model: {training.modelName}</h2>
            <p className="text-gray-600">Training ID: {training.id}</p>
            <p className="text-gray-600">
              Started: {new Date(training.startedAt).toLocaleString()}
              {training.completedAt && (
                <span className="ml-4">
                  Completed: {new Date(training.completedAt).toLocaleString()}
                </span>
              )}
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <span className={`font-medium capitalize ${
                training.status === 'succeeded' ? 'text-green-600' : 
                training.status === 'failed' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {training.status}
              </span>
            </div>
            
            {training.status === 'processing' && (
              <div className="pt-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${training.progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1 text-right">
                  {training.progress}% complete
                </p>
              </div>
            )}
            
            {training.status === 'failed' && training.error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
                <p className="font-bold">Error</p>
                <p>{training.error}</p>
              </div>
            )}
          </div>
          
          <div className={`p-4 rounded-md border ${
            training.status === 'succeeded' 
              ? 'bg-green-50 border-green-200' 
              : training.status === 'failed'
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <h3 className="font-medium mb-2 ${
              training.status === 'succeeded' 
                ? 'text-green-800' 
                : training.status === 'failed'
                ? 'text-red-800'
                : 'text-blue-800'
            }">
              {training.status === 'succeeded' 
                ? 'Training Complete!'
                : training.status === 'failed'
                ? 'Training Failed'
                : 'What\'s happening now?'}
            </h3>
            <p className={
              training.status === 'succeeded' 
                ? 'text-green-700' 
                : training.status === 'failed'
                ? 'text-red-700'
                : 'text-blue-700'
            }>
              {training.status === 'succeeded' 
                ? 'Your AI model has been successfully trained! You can now use it to generate images.'
                : training.status === 'failed'
                ? 'There was an error during training. Please try again or contact support if the problem persists.'
                : 'Your AI model is being trained. This may take several minutes. You can safely close this page and check back later.'}
            </p>
          </div>
          
          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {training.status === 'processing' 
                ? 'We\'ll send you an email when training is complete.'
                : training.status === 'succeeded'
                ? 'Your model is ready to use!'
                : 'Please try again or contact support.'}
            </p>
            
            {training.status === 'succeeded' && (
              <button
                onClick={() => router.push('/generate')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Generate Images
              </button>
            )}
            
            {training.status === 'failed' && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 