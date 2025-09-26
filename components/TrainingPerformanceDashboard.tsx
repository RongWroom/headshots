'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Zap,
  Target,
  BarChart3,
  Settings,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

interface PerformanceMetrics {
  training_duration: number;
  quality_metrics: {
    overall_quality: number;
    clip_similarity: number;
    face_recognition_score: number;
  };
  cost_per_step: number;
  steps_per_second: number;
}

interface BenchmarkResult {
  id: string;
  benchmark_id: string;
  run_date: string;
  training_time: number;
  quality_score: number;
  cost: number;
  success: boolean;
  error_message?: string;
  performance_metrics: PerformanceMetrics;
  regression_detected: boolean;
}

interface RegressionAlert {
  id: string;
  benchmark_id: string;
  metric_type: string;
  current_value: number;
  baseline_value: number;
  regression_percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  resolved_at?: string;
}

interface ProviderComparison {
  provider: string;
  average_training_time: number;
  average_quality_score: number;
  average_cost: number;
  success_rate: number;
  total_jobs: number;
  rank: number;
}

interface ParameterOptimization {
  id: string;
  provider: string;
  optimization_target: 'quality' | 'speed' | 'cost' | 'balanced';
  expected_improvement: {
    quality_improvement: number;
    speed_improvement: number;
    cost_reduction: number;
  };
  confidence_score: number;
  created_at: string;
  applied_at?: string;
}

export default function TrainingPerformanceDashboard() {
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [regressionAlerts, setRegressionAlerts] = useState<RegressionAlert[]>([]);
  const [providerComparisons, setProviderComparisons] = useState<ProviderComparison[]>([]);
  const [optimizations, setOptimizations] = useState<ParameterOptimization[]>([]);
  const [isRunningBenchmarks, setIsRunningBenchmarks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load regression alerts
      const alertsResponse = await fetch('/api/training/regression-alerts');
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setRegressionAlerts(alertsData.data?.alerts || []);
      }

      // Load performance report for provider comparisons
      const reportResponse = await fetch('/api/training/performance-reports');
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        setProviderComparisons(reportData.data?.provider_comparisons || []);
      }

      // Load parameter optimizations
      const optimizationsResponse = await fetch('/api/training/performance-optimization?provider=runpod');
      if (optimizationsResponse.ok) {
        const optimizationsData = await optimizationsResponse.json();
        setOptimizations(optimizationsData.data || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const runBenchmarks = async () => {
    try {
      setIsRunningBenchmarks(true);
      setError(null);

      const response = await fetch('/api/training/performance-benchmarking?action=run');
      const data = await response.json();

      if (response.ok && data.success) {
        setBenchmarkResults(data.data);
        // Reload dashboard data to get updated alerts and comparisons
        await loadDashboardData();
      } else {
        setError(data.error || 'Failed to run benchmarks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run benchmarks');
    } finally {
      setIsRunningBenchmarks(false);
    }
  };

  const resolveAlert = async (alertId: string, action: 'resolve' | 'acknowledge') => {
    try {
      const response = await fetch('/api/training/regression-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertId,
          action,
          resolutionNotes: `${action} via dashboard`
        })
      });

      if (response.ok) {
        // Remove the alert from the list
        setRegressionAlerts(prev => prev.filter(alert => alert.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const applyOptimization = async (optimizationId: string) => {
    try {
      const response = await fetch('/api/training/performance-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optimizationId,
          notes: 'Applied via dashboard'
        })
      });

      if (response.ok) {
        // Mark optimization as applied
        setOptimizations(prev => 
          prev.map(opt => 
            opt.id === optimizationId 
              ? { ...opt, applied_at: new Date().toISOString() }
              : opt
          )
        );
      }
    } catch (err) {
      console.error('Failed to apply optimization:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading performance dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor training performance, detect regressions, and optimize parameters
          </p>
        </div>
        <Button 
          onClick={runBenchmarks} 
          disabled={isRunningBenchmarks}
          className="flex items-center gap-2"
        >
          {isRunningBenchmarks ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running Benchmarks...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Benchmarks
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regressionAlerts.filter(alert => !alert.resolved_at).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {regressionAlerts.filter(alert => alert.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {providerComparisons.length > 0 
                ? (providerComparisons.reduce((sum, p) => sum + p.average_quality_score, 0) / providerComparisons.length).toFixed(3)
                : '0.000'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Across all providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Training Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {providerComparisons.length > 0 
                ? formatDuration(providerComparisons.reduce((sum, p) => sum + p.average_training_time, 0) / providerComparisons.length)
                : '0m 0s'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Across all providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimizations Available</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {optimizations.filter(opt => !opt.applied_at).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready to apply
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Regression Alerts</TabsTrigger>
          <TabsTrigger value="providers">Provider Comparison</TabsTrigger>
          <TabsTrigger value="optimizations">Parameter Optimization</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmark Results</TabsTrigger>
        </TabsList>

        {/* Regression Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regression Alerts</CardTitle>
              <CardDescription>
                Performance regressions detected in recent benchmark runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {regressionAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">No active regression alerts</p>
                  <p className="text-muted-foreground">All performance metrics are within expected ranges</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {regressionAlerts.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{alert.metric_type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => resolveAlert(alert.id, 'acknowledge')}
                          >
                            Acknowledge
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => resolveAlert(alert.id, 'resolve')}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Value:</span>
                          <div className="font-medium">{alert.current_value.toFixed(4)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Baseline:</span>
                          <div className="font-medium">{alert.baseline_value.toFixed(4)}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Regression:</span>
                          <div className="font-medium text-red-600">
                            {(alert.regression_percentage * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Detected: {new Date(alert.detected_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Provider Comparison Tab */}
        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Performance Comparison</CardTitle>
              <CardDescription>
                Compare training performance across different providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {providerComparisons.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No provider data available</p>
                  <p className="text-muted-foreground">Run benchmarks to see provider comparisons</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {providerComparisons.map((provider) => (
                    <div key={provider.provider} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-medium capitalize">{provider.provider}</h3>
                          <Badge variant="outline">Rank #{provider.rank}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Success Rate</div>
                          <div className="text-lg font-medium">
                            {(provider.success_rate * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Avg Training Time</div>
                          <div className="font-medium">{formatDuration(provider.average_training_time)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Avg Quality Score</div>
                          <div className="font-medium">{provider.average_quality_score.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Avg Cost</div>
                          <div className="font-medium">{formatCurrency(provider.average_cost)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Total Jobs</div>
                          <div className="font-medium">{provider.total_jobs}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parameter Optimization Tab */}
        <TabsContent value="optimizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Optimizations</CardTitle>
              <CardDescription>
                AI-generated recommendations to improve training performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optimizations.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No optimizations available</p>
                  <p className="text-muted-foreground">Generate optimizations based on historical data</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {optimizations.map((optimization) => (
                    <div key={optimization.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-medium capitalize">{optimization.provider}</h3>
                          <Badge variant="outline">{optimization.optimization_target}</Badge>
                          <Badge variant="secondary">
                            {(optimization.confidence_score * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                        {!optimization.applied_at && (
                          <Button 
                            size="sm"
                            onClick={() => applyOptimization(optimization.id)}
                          >
                            Apply Optimization
                          </Button>
                        )}
                        {optimization.applied_at && (
                          <Badge className="bg-green-500">Applied</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Quality Improvement</div>
                          <div className="font-medium text-green-600">
                            +{(optimization.expected_improvement.quality_improvement * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Speed Improvement</div>
                          <div className="font-medium text-blue-600">
                            +{(optimization.expected_improvement.speed_improvement * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Cost Reduction</div>
                          <div className="font-medium text-orange-600">
                            -{(optimization.expected_improvement.cost_reduction * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-muted-foreground">
                        Created: {new Date(optimization.created_at).toLocaleString()}
                        {optimization.applied_at && (
                          <span> • Applied: {new Date(optimization.applied_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Benchmark Results Tab */}
        <TabsContent value="benchmarks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Benchmark Results</CardTitle>
              <CardDescription>
                Latest automated benchmark test results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {benchmarkResults.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No benchmark results</p>
                  <p className="text-muted-foreground">Run benchmarks to see performance data</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {benchmarkResults.map((result) => (
                    <div key={result.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={result.success ? "default" : "destructive"}>
                            {result.success ? "Success" : "Failed"}
                          </Badge>
                          {result.regression_detected && (
                            <Badge variant="destructive">Regression Detected</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(result.run_date).toLocaleString()}
                        </div>
                      </div>
                      
                      {result.success ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Training Time</div>
                            <div className="font-medium">{formatDuration(result.training_time)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Quality Score</div>
                            <div className="font-medium">{result.quality_score.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Cost</div>
                            <div className="font-medium">{formatCurrency(result.cost)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Steps/Second</div>
                            <div className="font-medium">
                              {result.performance_metrics.steps_per_second.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-red-600">
                          Error: {result.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}