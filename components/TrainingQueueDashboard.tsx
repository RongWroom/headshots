'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Clock, 
  Users, 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';
import {
  TrainingQueueEntry,
  QueueDashboardData,
  UserRateLimit,
  ProviderStatus
} from '../types/training-queue';

interface TrainingQueueDashboardProps {
  userId?: string;
  refreshInterval?: number;
}

export default function TrainingQueueDashboard({ 
  userId, 
  refreshInterval = 30000 
}: TrainingQueueDashboardProps) {
  const [dashboardData, setDashboardData] = useState<QueueDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/training/queue', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const cancelTrainingJob = async (queueEntryId: string) => {
    try {
      const response = await fetch(`/api/training/queue/${queueEntryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to cancel training job');
      }

      // Refresh data after cancellation
      await fetchDashboardData();
    } catch (err) {
      console.error('Error cancelling training job:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel training job');
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up auto-refresh
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Pause className="h-4 w-4 text-gray-500" />;
      case 'processing':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const formatTimeUntilReset = (resetTime: string) => {
    const now = new Date();
    const reset = new Date(resetTime);
    const diff = reset.getTime() - now.getTime();
    
    if (diff <= 0) return 'Now';
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading queue dashboard: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={fetchDashboardData}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return <div>No data available</div>;
  }

  const activeJobs = dashboardData.user_queue_entries.filter(
    entry => ['queued', 'processing'].includes(entry.status)
  );

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Queue Dashboard</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchDashboardData}
          disabled={refreshing}
        >
          <RotateCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Queue Position</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.queue_status.queue_position || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.queue_status.total_queued} total queued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Wait</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.queue_status.estimated_wait_time 
                ? formatDuration(dashboardData.queue_status.estimated_wait_time)
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.queue_status.total_processing} processing now
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.queue_metrics.completed_today}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.queue_metrics.failed_today} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeJobs.length}</div>
            <p className="text-xs text-muted-foreground">
              Your active training jobs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
          <CardDescription>Your current usage limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboardData.user_rate_limits.map((limit: UserRateLimit) => (
              <div key={limit.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium capitalize">
                    {limit.limit_type} Limit
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {limit.current_usage} / {limit.limit_value}
                  </span>
                </div>
                <Progress 
                  value={(limit.current_usage / limit.limit_value) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Resets in {formatTimeUntilReset(limit.reset_time)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider Status */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
          <CardDescription>Current capacity and health of training providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboardData.queue_status.provider_status.map((provider: ProviderStatus) => (
              <div key={provider.provider} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium capitalize">{provider.provider}</h4>
                  <Badge variant={provider.health_score > 0.8 ? 'default' : 'secondary'}>
                    {Math.round(provider.health_score * 100)}%
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Available Capacity:</span>
                    <span>{provider.available_capacity}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current Load:</span>
                    <span>{Math.round(provider.current_load * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Processing:</span>
                    <span>{formatDuration(provider.estimated_processing_time)}</span>
                  </div>
                  <Progress value={provider.current_load * 100} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Training Jobs</CardTitle>
            <CardDescription>Your currently queued and processing jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeJobs.map((job: TrainingQueueEntry) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">Model #{job.model_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.provider} • Priority {job.priority}
                        {job.queue_position && ` • Position ${job.queue_position}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                    {job.estimated_duration && (
                      <span className="text-sm text-muted-foreground">
                        ~{formatDuration(job.estimated_duration)}
                      </span>
                    )}
                    {job.status === 'queued' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelTrainingJob(job.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Completions */}
      {dashboardData.recent_completions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Completions</CardTitle>
            <CardDescription>Your recently completed training jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.recent_completions.slice(0, 5).map((job: TrainingQueueEntry) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">Model #{job.model_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.provider} • Completed {new Date(job.completion_time!).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                    {job.actual_start_time && job.completion_time && (
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(new Date(job.completion_time).getTime() - new Date(job.actual_start_time).getTime())}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}