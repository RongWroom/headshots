'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
import SeedreamUploadZone from './SeedreamUploadZone';
import SeedreamCustomizationUI from './SeedreamCustomizationUI';
import SeedreamStyleSelector from './SeedreamStyleSelector';
import SeedreamGenerationProgress from './SeedreamGenerationProgress';
import { SeedreamCustomizations, UploadedImage } from '@/types/seedream';

type WorkflowStep = 'upload' | 'customize' | 'style' | 'generating' | 'results';

interface SeedreamWorkflowProps {
  onComplete?: (outputs: Array<{ url: string; thumbnail: string }>) => void;
}

export default function SeedreamWorkflow({ onComplete }: SeedreamWorkflowProps) {
  // Step management
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');

  // Upload state
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Customization state
  const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  });

  // Style state
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  // Generation state
  const [jobId, setJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Results state
  const [outputs, setOutputs] = useState<Array<{ url: string; thumbnail: string }>>([]);

  // Handle upload completion
  const handleUploadComplete = (id: string, images: UploadedImage[]) => {
    setUploadId(id);
    setUploadedImages(images);
    setCurrentStep('customize');
  };

  // Handle customization completion
  const handleCustomizationNext = () => {
    setCurrentStep('style');
  };

  // Handle style selection
  const handleStyleSelect = (styleId: string) => {
    setSelectedStyleId(styleId);
  };

  // Handle generation start
  const handleStartGeneration = async () => {
    if (!uploadId || !selectedStyleId) {
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/seedream/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId,
          styleId: selectedStyleId,
          numOutputs: 4, // Seedream-4 max is 4 outputs
          customizations,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to start generation');
      }

      setJobId(data.jobId);
      setCurrentStep('generating');
    } catch (error) {
      console.error('Generation start error:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to start generation'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle generation completion
  const handleGenerationComplete = (generatedOutputs: Array<{ url: string; thumbnail: string }>) => {
    setOutputs(generatedOutputs);
    setCurrentStep('results');
    if (onComplete) {
      onComplete(generatedOutputs);
    }
  };

  // Handle generation error
  const handleGenerationError = (error: string) => {
    setGenerationError(error);
  };

  // Handle starting over
  const handleStartOver = () => {
    setCurrentStep('upload');
    setUploadId(null);
    setUploadedImages([]);
    setCustomizations({
      removeJewelry: false,
      removeGlasses: false,
      removePiercings: false,
      cleanBackground: false,
    });
    setSelectedStyleId(null);
    setJobId(null);
    setOutputs([]);
    setGenerationError(null);
  };

  // Render progress indicator
  const renderProgressIndicator = () => {
    const steps = [
      { id: 'upload', label: 'Upload Photos', completed: uploadId !== null },
      { id: 'customize', label: 'Customize', completed: currentStep !== 'upload' },
      { id: 'style', label: 'Select Style', completed: selectedStyleId !== null },
      { id: 'generating', label: 'Generate', completed: currentStep === 'results' },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${
                      step.completed
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={`
                    text-xs mt-2 font-medium
                    ${
                      step.completed || currentStep === step.id
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-1 mx-2
                    ${step.completed ? 'bg-green-500' : 'bg-gray-200'}
                  `}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      {currentStep !== 'results' && renderProgressIndicator()}

      {/* Error Display */}
      {generationError && (
        <Alert variant="destructive">
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Upload */}
      {currentStep === 'upload' && (
        <SeedreamUploadZone
          onUploadComplete={handleUploadComplete}
          maxFiles={5}
          minFiles={1}
        />
      )}

      {/* Step 2: Customize */}
      {currentStep === 'customize' && (
        <div className="space-y-6">
          {/* Upload Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Photos Uploaded
              </CardTitle>
              <CardDescription>
                {uploadedImages.length} image(s) ready for generation
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Customization UI */}
          <SeedreamCustomizationUI
            customizations={customizations}
            onCustomizationsChange={setCustomizations}
          />

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep('upload')}>
              Back to Upload
            </Button>
            <Button onClick={handleCustomizationNext} className="flex-1">
              Continue to Style Selection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Style Selection */}
      {currentStep === 'style' && (
        <div className="space-y-6">
          {/* Style Selector */}
          <SeedreamStyleSelector
            selectedStyleId={selectedStyleId}
            onStyleSelect={handleStyleSelect}
          />

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep('customize')}>
              Back to Customize
            </Button>
            <Button
              onClick={handleStartGeneration}
              disabled={!selectedStyleId || isGenerating}
              className="flex-1"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Starting Generation...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Professional Headshots
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Generating */}
      {currentStep === 'generating' && jobId && (
        <SeedreamGenerationProgress
          jobId={jobId}
          onComplete={handleGenerationComplete}
          onError={handleGenerationError}
        />
      )}

      {/* Step 5: Results */}
      {currentStep === 'results' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Generation Complete!
              </CardTitle>
              <CardDescription>
                Your {outputs.length} professional headshot{outputs.length !== 1 ? 's are' : ' is'} ready
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {outputs.map((output, index) => (
                  <div key={index} className="space-y-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border relative group">
                      <img
                        src={output.url}
                        alt={`Headshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Download button overlay */}
                      <a
                        href={output.url}
                        download={`headshot-${index + 1}.jpg`}
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <Button size="sm" variant="secondary">
                          Download
                        </Button>
                      </a>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Headshot {index + 1}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <Button onClick={handleStartOver} variant="outline" className="flex-1">
                  Generate More Headshots
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    // Download all images
                    outputs.forEach((output, index) => {
                      const link = document.createElement('a');
                      link.href = output.url;
                      link.download = `headshot-${index + 1}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    });
                  }}
                >
                  Download All ({outputs.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
