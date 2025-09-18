"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface TrainingModel {
  id: string;
  name: string;
  status: 'pending' | 'training' | 'finished' | 'failed';
  progress?: number;
  error?: string;
  created_at: string;
  updated_at: string;
  training_started_at?: string;
  training_completed_at?: string;
  training_duration?: number;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  statusMessage: string;
  isActive: boolean;
  isComplete: boolean;
  canRetry: boolean;
  formattedElapsedTime?: string;
  formattedEstimatedRemaining?: string;
}

interface TrainingSummary {
  total: number;
  pending: number;
  training: number;
  finished: number;
  failed: number;
  averageTrainingTime?: number;
}

interface TrainingStatusResponse {
  models: TrainingModel[];
  summary: TrainingSummary;
}

export default function TrainingStatusDashboard() {
  const [data, setData] = useState<TrainingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchTrainingStatus = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/training/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch training status');
      }
      
      const result = await response.json();
      setData(result);
      
      if (showRefreshToast) {
        toast({
          title: "Status Updated",
          description: "Training status has been refreshed.",
        });
      }
    } catch (error) {
      console.error('Error fetching training status:', error);
      toast({
        title: "Error",
        description: "Failed to fetch training status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrainingStatus();
    
    // Auto-refresh every 30 seconds for active trainings
    const interval = setInterval(() => {
      if (data?.models.some(model => model.isActive)) {
        fetchTrainingStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [data?.models]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'training':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'finished':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'training':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'finished':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Training Status</h2>
          <div className="animate-pulse h-10 w-24 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No training data available.</p>
        <Button onClick={() => fetchTrainingStatus()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Training Status</h2>
        <Button 
          onClick={() => fetchTrainingStatus(true)} 
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Training</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{data.summary.training}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.summary.finished}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.summary.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Models List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Models</h3>
        
        {data.models.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No models found. Start by training your first model!</p>
            </CardContent>
          </Card>
        ) : (
          data.models.map((model) => (
            <Card key={model.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor(model.status)}`}>
                      {getStatusIcon(model.status)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{model.name}</CardTitle>
                      <CardDescription>{model.statusMessage}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(model.status)}>
                    {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress Bar for Training */}
                {model.status === 'training' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{model.progress || 0}%</span>
                    </div>
                    <Progress value={model.progress || 0} className="h-2" />
                  </div>
                )}

                {/* Time Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Created:</span>
                    <p>{new Date(model.created_at).toLocaleString()}</p>
                  </div>
                  
                  {model.formattedElapsedTime && (
                    <div>
                      <span className="font-medium text-gray-600">
                        {model.isActive ? 'Running for:' : 'Duration:'}
                      </span>
                      <p>{model.formattedElapsedTime}</p>
                    </div>
                  )}
                  
                  {model.formattedEstimatedRemaining && model.isActive && (
                    <div>
                      <span className="font-medium text-gray-600">Est. remaining:</span>
                      <p>{model.formattedEstimatedRemaining}</p>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {model.status === 'failed' && model.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      <strong>Error:</strong> {model.error}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {model.status === 'finished' && (
                    <Button size="sm">
                      Generate Images
                    </Button>
                  )}
                  
                  {model.canRetry && (
                    <Button size="sm" variant="outline">
                      Retry Training
                    </Button>
                  )}
                  
                  <Button size="sm" variant="ghost">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}