'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, TrendingDown, RefreshCw } from 'lucide-react';

interface QualityMetrics {
  clipSimilarity: number;
  faceRecognitionScore: number;
  overallQuality: number;
  timestamp: string;
  modelId: string;
  generatedImageUrl: string;
  originalImageUrls: string[];
}

interface QualityAlert {
  id: string;
  modelId: string;
  alertType: 'low_quality' | 'retraining_needed' | 'quality_degradation';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendations: string[];
  createdAt: string;
  resolved: boolean;
}

interface QualityAssessmentResult {
  metrics: QualityMetrics;
  passesThreshold: boolean;
  recommendations: string[];
  needsRetraining: boolean;
}

interface QualityAssessmentDashboardProps {
  modelId: string;
}

export default function QualityAssessmentDashboard({ modelId }: QualityAssessmentDashboardProps) {
  const [qualityHistory, setQualityHistory] = useState<QualityMetrics[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrainingStatus, setRetrainingStatus] = useState<{
    needsRetraining: boolean;
    reason: string;
  } | null>(null);

  useEffect(() => {
    fetchQualityData();
  }, [modelId]);

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch quality history and retraining status
      const qualityResponse = await fetch(`/api/quality/assess?modelId=${modelId}`);
      if (!qualityResponse.ok) {
        throw new Error('Failed to fetch quality data');
      }
      const qualityData = await qualityResponse.json();

      setQualityHistory(qualityData.qualityHistory || []);
      setRetrainingStatus(qualityData.retrainingStatus);

      // Fetch active alerts
      const alertsResponse = await fetch(`/api/quality/monitor?modelId=${modelId}`);
      if (!alertsResponse.ok) {
        throw new Error('Failed to fetch quality alerts');
      }
      const alertsData = await alertsResponse.json();

      setActiveAlerts(alertsData.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/quality/monitor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action: 'resolve' }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve alert');
      }

      // Refresh alerts
      await fetchQualityData();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const getQualityColor = (score: number): string => {
    if (score >= 0.85) return 'text-green-600';
    if (score >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityIcon = (score: number) => {
    if (score >= 0.85) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 0.7) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'retraining_needed': return <RefreshCw className="h-4 w-4" />;
      case 'quality_degradation': return <TrendingDown className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-24 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const latestQuality = qualityHistory[0];
  const averageQuality = qualityHistory.length > 0
    ? qualityHistory.reduce((sum, q) => sum + q.overallQuality, 0) / qualityHistory.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Quality Assessment Overview
            <Button variant="outline" size="sm" onClick={fetchQualityData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            Training quality metrics and assessment results for model {modelId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latestQuality ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">CLIP Similarity</span>
                  {getQualityIcon(latestQuality.clipSimilarity)}
                </div>
                <Progress value={latestQuality.clipSimilarity * 100} className="h-2" />
                <span className={`text-sm ${getQualityColor(latestQuality.clipSimilarity)}`}>
                  {(latestQuality.clipSimilarity * 100).toFixed(1)}%
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Face Recognition</span>
                  {getQualityIcon(latestQuality.faceRecognitionScore)}
                </div>
                <Progress value={latestQuality.faceRecognitionScore * 100} className="h-2" />
                <span className={`text-sm ${getQualityColor(latestQuality.faceRecognitionScore)}`}>
                  {(latestQuality.faceRecognitionScore * 100).toFixed(1)}%
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Quality</span>
                  {getQualityIcon(latestQuality.overallQuality)}
                </div>
                <Progress value={latestQuality.overallQuality * 100} className="h-2" />
                <span className={`text-sm ${getQualityColor(latestQuality.overallQuality)}`}>
                  {(latestQuality.overallQuality * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No quality assessments available for this model.</p>
          )}

          {qualityHistory.length > 1 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Average Quality (last {qualityHistory.length} assessments)</span>
                <span className={getQualityColor(averageQuality)}>
                  {(averageQuality * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retraining Status */}
      {retrainingStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retraining Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {retrainingStatus.needsRetraining ? (
                <>
                  <Badge variant="destructive">Retraining Needed</Badge>
                  <span className="text-sm text-gray-600">{retrainingStatus.reason}</span>
                </>
              ) : (
                <>
                  <Badge variant="default">Quality Acceptable</Badge>
                  <span className="text-sm text-gray-600">{retrainingStatus.reason}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Quality Alerts ({activeAlerts.length})
            </CardTitle>
            <CardDescription>
              Active quality monitoring alerts for this model
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeAlerts.map((alert) => (
                <Alert key={alert.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {getAlertIcon(alert.alertType)}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(alert.severity) as any}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">{alert.message}</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">Recommendations:</p>
                          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                            {alert.recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality History */}
      {qualityHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality History</CardTitle>
            <CardDescription>
              Recent quality assessment results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {qualityHistory.slice(0, 5).map((quality, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getQualityIcon(quality.overallQuality)}
                      <span className="font-medium">
                        Overall: {(quality.overallQuality * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      CLIP: {(quality.clipSimilarity * 100).toFixed(1)}% | 
                      Face: {(quality.faceRecognitionScore * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(quality.timestamp).toLocaleDateString()}
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