/**
 * Enhanced Training Status Dashboard Component
 * Displays comprehensive training status, progress, and monitoring information
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Pause,
  RotateCcw,
  TrendingUp,
  Activity,
  Zap,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface TrainingProgressInfo {
  progressPercentage: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  statusMessage: string;
  isStalled: boolean;
  currentStep: number;
  totalSteps: number;
  stepsPerSecond: number;
  averageStepTime: number;
}

interface TrainingSession {
  id: string;
  model_id: number;
  provider: string;
  status: 'pending' | 'queued' | 'training' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: number;
  total_steps?: number;
  training_started_at?: string;
  training_completed_at?: string;
  training_duration?: number;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  progressInfo?: TrainingProgressInfo;
  estimatedCompletionTime?: string;
}

interface TrainingSummary {
  total: number;
  active: number;
  completed: number;
  failed: number;
  successRate: number;
  averageTrainingTime: number | null;
}

interface TrainingHistorySummary {
  date: string;
  total_sessions: number;
  successful_sessions: number;
  failed_sessions: number;
  success_rate: number;
  average_duration: number;
}

interface TrainingDashboardProps {
  userId?: string;
  modelId?: number;
  refreshInterval?: number;
}

export default function TrainingStatusDashboard({ 
  userId, 
  modelId, 
  refreshInterval = 15000 // Reduced to 15 seconds for better real-time updates
}: TrainingDashboardProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [history, setHistory] = useState<TrainingHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('active');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch training status data
  const fetchTrainingStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (modelId) params.append('model_id', modelId.toString());
      
      const response = await fetch(`/api/training/status?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch training status');
      }

      if (modelId) {
        // Single model view
        setSessions(data.allSessions || [data.session].filter(Boolean));
      } else {
        // All sessions view
        setSessions(data.sessions || []);
        setSummary(data.summary);
        setHistory(data.history || []);
      }

      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch training status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Set up polling for real-time updates
  useEffect(() => {
    fetchTrainingStatus(true);
    
    const interval = setInterval(() => fetchTrainingStatus(false), refreshInterval);
    return () => clearInterval(interval);
  }, [modelId, refreshInterval]);

  // Filter sessions by status
  const activeSessions = sessions.filter(s => ['pending', 'queued', 'training'].includes(s.status));
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const failedSessions = sessions.filter(s => s.status === 'failed');
  const stalledSessions = activeSessions.filter(s => s.progressInfo?.isStalled);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load training status: {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => fetchTrainingStatus(true)}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with last updated info */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Training Dashboard</h2>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => fetchTrainingStatus(true)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts for stalled sessions */}
      {stalledSessions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stalledSessions.length} training session{stalledSessions.length > 1 ? 's' : ''} appear to be stalled. 
            No progress updates received recently.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">
                All time training sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Play className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.active}</div>
              <p className="text-xs text-muted-foreground">
                Currently training or queued
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Completed successfully
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.averageTrainingTime 
                  ? formatDuration(summary.averageTrainingTime)
                  : 'N/A'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Average completion time
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Training Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Training Sessions</CardTitle>
          <CardDescription>
            Monitor your training progress and status in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">
                Active ({activeSessions.length})
                {stalledSessions.length > 0 && (
                  <AlertTriangle className="h-3 w-3 ml-1 text-red-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedSessions.length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({failedSessions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active training sessions</p>
                  <p className="text-sm">Start a new training to see progress here</p>
                </div>
              ) : (
                activeSessions.map(session => (
                  <TrainingSessionCard key={session.id} session={session} />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed training sessions</p>
                </div>
              ) : (
                completedSessions.map(session => (
                  <TrainingSessionCard key={session.id} session={session} />
                ))
              )}
            </TabsContent>

            <TabsContent value="failed" className="space-y-4">
              {failedSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>No failed training sessions</p>
                  <p className="text-sm">Great job! All your training sessions completed successfully</p>
                </div>
              ) : (
                failedSessions.map(session => (
                  <TrainingSessionCard key={session.id} session={session} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Training History Chart */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Training History</CardTitle>
            <CardDescription>
              Daily training activity over the past month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.slice(0, 7).map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium w-20">
                      {new Date(day.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{day.total_sessions} sessions</span>
                        <Badge variant="outline" className="text-xs">
                          {day.success_rate.toFixed(0)}% success
                        </Badge>
                      </div>
                      <Progress 
                        value={day.success_rate} 
                        className="h-2 mt-1" 
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDuration(day.average_duration)}
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

// Enhanced individual training session card component
function TrainingSessionCard({ session }: { session: TrainingSession }) {
  const getStatusBadge = (status: string, isStalled?: boolean) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, color: 'text-gray-600' },
      queued: { variant: 'secondary' as const, icon: Clock, color: 'text-blue-600' },
      training: { variant: 'default' as const, icon: Zap, color: 'text-blue-600' },
      completed: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      cancelled: { variant: 'secondary' as const, icon: Pause, color: 'text-gray-600' }
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = isStalled ? AlertTriangle : config.icon;
    const color = isStalled ? 'text-red-500' : config.color;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${color}`} />
        {isStalled ? 'Stalled' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const progressInfo = session.progressInfo;
  const showProgress = ['training', 'queued'].includes(session.status);
  const isStalled = progressInfo?.isStalled || false;

  return (
    <Card className={isStalled ? 'border-red-200 bg-red-50/50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">Model {session.model_id}</h4>
              {getStatusBadge(session.status, isStalled)}
              <Badge variant="outline">{session.provider}</Badge>
              {session.retry_count > 0 && (
                <Badge variant="outline" className="text-xs">
                  Retry #{session.retry_count}
                </Badge>
              )}
            </div>

            {progressInfo && (
              <p className="text-sm text-muted-foreground">
                {progressInfo.statusMessage}
              </p>
            )}

            {showProgress && progressInfo && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progressInfo.progressPercentage.toFixed(1)}%</span>
                </div>
                <Progress 
                  value={progressInfo.progressPercentage} 
                  className={`h-2 ${isStalled ? 'bg-red-100' : ''}`}
                />
                
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  {progressInfo.totalSteps > 0 && (
                    <div>
                      <span className="font-medium">Steps:</span> {progressInfo.currentStep} / {progressInfo.totalSteps}
                    </div>
                  )}
                  {progressInfo.stepsPerSecond > 0 && (
                    <div>
                      <span className="font-medium">Speed:</span> {progressInfo.stepsPerSecond.toFixed(2)}/s
                    </div>
                  )}
                  {progressInfo.elapsedTime > 0 && (
                    <div>
                      <span className="font-medium">Elapsed:</span> {formatDuration(progressInfo.elapsedTime)}
                    </div>
                  )}
                  {progressInfo.estimatedTimeRemaining > 0 && (
                    <div>
                      <span className="font-medium">Remaining:</span> ~{formatDuration(progressInfo.estimatedTimeRemaining)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {session.status === 'failed' && session.error_message && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="font-medium">Training Failed</div>
                  <div className="mt-1">{session.error_message}</div>
                  {session.error_code && (
                    <div className="text-xs mt-1 opacity-75">Error Code: {session.error_code}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Started: {new Date(session.created_at).toLocaleString()}</span>
              {session.training_duration && (
                <span>Duration: {formatDuration(session.training_duration)}</span>
              )}
              {session.estimatedCompletionTime && session.status === 'training' && (
                <span>ETA: {new Date(session.estimatedCompletionTime).toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {session.status === 'failed' && (
              <Button size="sm" variant="outline">
                <RotateCcw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            {['pending', 'queued', 'training'].includes(session.status) && (
              <Button size="sm" variant="outline">
                <Pause className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility function to format duration
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}