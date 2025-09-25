'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  Image as ImageIcon,
  Zap,
  Settings,
  BarChart3
} from 'lucide-react';

interface ValidationResult {
  isValid: boolean;
  totalImages: number;
  validImages: number;
  processedImages: Array<{
    isValid: boolean;
    originalImagePath: string;
    processedImagePath?: string;
    metadata: {
      originalSize: { width: number; height: number };
      processedSize: { width: number; height: number };
      fileSize: number;
      format: string;
    };
    qualityMetrics: {
      sharpness: number;
      brightness: number;
      contrast: number;
      colorfulness: number;
      overallScore: number;
    };
    faceDetection: {
      facesDetected: number;
      primaryFace?: {
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
      };
    };
    preprocessing: {
      wasResized: boolean;
      wasEnhanced: boolean;
      wasCropped: boolean;
      appliedFilters: string[];
    };
    errors: string[];
    warnings: string[];
  }>;
  duplicatesRemoved: number;
  lowQualityRemoved: number;
  noFaceRemoved: number;
  overallQualityScore: number;
  recommendations: string[];
  errors: string[];
  warnings: string[];
}

interface TrainingDataValidatorProps {
  imageUrls: string[];
  onValidationComplete?: (result: ValidationResult) => void;
  className?: string;
}

export function TrainingDataValidator({ 
  imageUrls, 
  onValidationComplete,
  className = '' 
}: TrainingDataValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);

  const validateTrainingData = useCallback(async () => {
    if (imageUrls.length === 0) return;

    setIsValidating(true);
    setValidationProgress(0);
    setValidationResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setValidationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/validate/training-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls,
          options: {
            requireFaceDetection: true,
            enableEnhancement: true,
            enableDeduplication: true,
            qualityThreshold: 0.6
          }
        }),
      });

      clearInterval(progressInterval);
      setValidationProgress(100);

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Validation failed');
      }

      setValidationResult(data.data);
      onValidationComplete?.(data.data);

    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        totalImages: imageUrls.length,
        validImages: 0,
        processedImages: [],
        duplicatesRemoved: 0,
        lowQualityRemoved: 0,
        noFaceRemoved: 0,
        overallQualityScore: 0,
        recommendations: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      });
    } finally {
      setIsValidating(false);
    }
  }, [imageUrls, onValidationComplete]);

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 0.8) return <Badge variant="default" className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 0.6) return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Validation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Training Data Validation
          </CardTitle>
          <CardDescription>
            Validate and optimize your training images for best results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {imageUrls.length} images ready for validation
            </div>
            <Button 
              onClick={validateTrainingData}
              disabled={isValidating || imageUrls.length === 0}
              className="flex items-center gap-2"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Validating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Validate Images
                </>
              )}
            </Button>
          </div>

          {isValidating && (
            <div className="mt-4">
              <Progress value={validationProgress} className="w-full" />
              <p className="text-sm text-gray-600 mt-2">
                Processing images... {validationProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <div className="space-y-6">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Validation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {validationResult.validImages}
                  </div>
                  <div className="text-sm text-gray-600">Valid Images</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {validationResult.totalImages - validationResult.validImages}
                  </div>
                  <div className="text-sm text-gray-600">Rejected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {validationResult.duplicatesRemoved}
                  </div>
                  <div className="text-sm text-gray-600">Duplicates</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getQualityColor(validationResult.overallQualityScore)}`}>
                    {(validationResult.overallQualityScore * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600">Quality Score</div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Quality</span>
                {getQualityBadge(validationResult.overallQualityScore)}
              </div>
              <Progress 
                value={validationResult.overallQualityScore * 100} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          {/* Recommendations */}
          {validationResult.recommendations.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Recommendations</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {validationResult.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {validationResult.errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detailed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validationResult.processedImages.map((image, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Image {index + 1}
                        </span>
                        {image.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {getQualityBadge(image.qualityMetrics.overallScore)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Resolution</div>
                        <div className="text-gray-600">
                          {image.metadata.originalSize.width}×{image.metadata.originalSize.height}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Faces</div>
                        <div className="text-gray-600 flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {image.faceDetection.facesDetected}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Quality</div>
                        <div className={getQualityColor(image.qualityMetrics.overallScore)}>
                          {(image.qualityMetrics.overallScore * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Processing</div>
                        <div className="text-gray-600">
                          {image.preprocessing.appliedFilters.length} filters
                        </div>
                      </div>
                    </div>

                    {image.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        <strong>Errors:</strong> {image.errors.join(', ')}
                      </div>
                    )}

                    {image.warnings.length > 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-700">
                        <strong>Warnings:</strong> {image.warnings.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}