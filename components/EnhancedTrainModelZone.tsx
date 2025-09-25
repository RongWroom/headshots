'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { TrainingDataValidator } from './TrainingDataValidator';
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Zap,
  Settings,
  Image as ImageIcon,
  User,
  Briefcase
} from 'lucide-react';
import { fileUploadFormSchema } from '@/types/zod';
import * as z from 'zod';

type FormInput = z.infer<typeof fileUploadFormSchema>;

interface EnhancedTrainModelZoneProps {
  packSlug: string;
}

interface PackInfo {
  title: string;
  description: string;
  exampleImageUrls: string[];
  minImages: number;
  recommendedImages: string;
  icon: React.ReactNode;
}

interface UploadedFile {
  file: File;
  url?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  preview: string;
}

interface ValidationResult {
  isReady: boolean;
  validImages: number;
  totalImages: number;
  overallQualityScore: number;
  recommendations: string[];
  errors: string[];
  warnings: string[];
  optimizedParameters: {
    recommendedSteps: number;
    recommendedLearningRate: number;
    recommendedBatchSize: number;
    qualityBoost: boolean;
  };
  estimatedTrainingTime: number;
  estimatedCost: number;
}

const packSpecificInfo: Record<string, PackInfo> = {
  'actor-headshots': {
    title: 'Actor Headshots Pack',
    description: 'Create professional actor headshots with a classic, compelling look. Upload 8-15 clear photos of the subject.',
    exampleImageUrls: ['/images/examples/actor-1.jpg', '/images/examples/actor-2.jpg', '/images/examples/actor-3.jpg'],
    minImages: 8,
    recommendedImages: '8-15 images',
    icon: <User className="h-5 w-5" />
  },
  'corporate-headshots': {
    title: 'Corporate Headshots Pack',
    description: 'Generate polished corporate headshots perfect for your professional profile. Upload 8-15 clear photos of the subject.',
    exampleImageUrls: ['/images/examples/corporate-1.jpg', '/images/examples/corporate-2.jpg', '/images/examples/corporate-3.jpg'],
    minImages: 8,
    recommendedImages: '8-15 images',
    icon: <Briefcase className="h-5 w-5" />
  }
};

export default function EnhancedTrainModelZone({ packSlug }: EnhancedTrainModelZoneProps) {
  const [currentPack, setCurrentPack] = useState<PackInfo>(packSpecificInfo[packSlug] || {
    title: 'Unknown Pack',
    description: 'Please select a valid pack.',
    exampleImageUrls: [],
    minImages: 8,
    recommendedImages: '8-15 images',
    icon: <ImageIcon className="h-5 w-5" />
  });

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'validate' | 'train'>('upload');

  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormInput>({
    resolver: zodResolver(fileUploadFormSchema),
    defaultValues: {
      name: '',
      type: 'person'
    }
  });

  useEffect(() => {
    const packData = packSpecificInfo[packSlug];
    if (packData) {
      setCurrentPack(packData);
    }
  }, [packSlug]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Check file limits
    if (uploadedFiles.length + acceptedFiles.length > 20) {
      toast({
        title: 'Too many files',
        description: 'Maximum 20 images allowed',
        variant: 'destructive'
      });
      return;
    }

    // Create preview URLs and add to uploaded files
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      preview: URL.createObjectURL(file)
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Start batch upload
    await uploadFiles(newFiles);
  }, [uploadedFiles]);

  const uploadFiles = async (filesToUpload: UploadedFile[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const modelName = form.getValues('name').trim() || `model-${Date.now()}`;
      
      // Convert files to base64 for batch upload
      const filesData = await Promise.all(
        filesToUpload.map(async (uploadFile) => {
          const buffer = await uploadFile.file.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          
          return {
            name: uploadFile.file.name,
            data: base64,
            type: uploadFile.file.type
          };
        })
      );

      // Update status to uploading
      setUploadedFiles(prev => 
        prev.map(file => 
          filesToUpload.includes(file) 
            ? { ...file, status: 'uploading' as const }
            : file
        )
      );

      // Batch upload with validation
      const response = await fetch('/api/upload/training-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: filesData,
          modelName,
          options: {
            requireFaceDetection: true,
            enableEnhancement: true,
            enableDeduplication: true,
            qualityThreshold: 0.6
          }
        })
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update file statuses based on results
      setUploadedFiles(prev => 
        prev.map(file => {
          if (filesToUpload.includes(file)) {
            const wasUploaded = result.uploadSummary.uploadedUrls.length > 0;
            return {
              ...file,
              status: wasUploaded ? 'uploaded' as const : 'error' as const,
              url: wasUploaded ? result.uploadSummary.uploadedUrls[0] : undefined,
              error: wasUploaded ? undefined : 'Upload failed'
            };
          }
          return file;
        })
      );

      // Set validation results
      if (result.validation) {
        setValidationResult({
          isReady: result.validation.isReady,
          validImages: result.validation.validImages,
          totalImages: result.validation.totalImages,
          overallQualityScore: result.validation.overallQualityScore,
          recommendations: result.recommendations || [],
          errors: result.errors || [],
          warnings: result.warnings || [],
          optimizedParameters: result.optimization.recommendedParameters,
          estimatedTrainingTime: result.optimization.estimatedTrainingTime,
          estimatedCost: result.optimization.estimatedCost
        });

        if (result.validation.isReady) {
          setCurrentStep('validate');
        }
      }

      toast({
        title: 'Upload completed',
        description: `${result.uploadSummary.uploadedFiles} files uploaded and validated`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Upload error:', error);
      
      // Mark files as error
      setUploadedFiles(prev => 
        prev.map(file => 
          filesToUpload.includes(file) 
            ? { ...file, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
            : file
        )
      );

      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 20,
    disabled: isUploading
  });

  const onSubmit: SubmitHandler<FormInput> = async (data) => {
    if (!validationResult?.isReady) {
      toast({
        title: 'Training not ready',
        description: 'Please upload and validate your images first',
        variant: 'destructive'
      });
      return;
    }

    setIsTraining(true);
    setCurrentStep('train');

    try {
      // Start training with optimized parameters
      const trainingResponse = await fetch('/api/runpod/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelName: data.name,
          imageUrls: uploadedFiles
            .filter(f => f.status === 'uploaded' && f.url)
            .map(f => f.url),
          packSlug,
          optimizedParameters: validationResult.optimizedParameters
        })
      });

      if (!trainingResponse.ok) {
        throw new Error('Training failed to start');
      }

      const trainingResult = await trainingResponse.json();

      toast({
        title: 'Training started',
        description: `Model "${data.name}" is now training. Estimated time: ${validationResult.estimatedTrainingTime} minutes`,
        variant: 'default'
      });

      // Redirect to training status page
      router.push(`/training/${trainingResult.id}`);

    } catch (error) {
      console.error('Training error:', error);
      
      toast({
        title: 'Training failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsTraining(false);
    }
  };

  const getStepStatus = (step: string) => {
    if (currentStep === step) return 'current';
    if (
      (step === 'upload' && uploadedFiles.length > 0) ||
      (step === 'validate' && validationResult?.isReady) ||
      (step === 'train' && isTraining)
    ) {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Pack Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentPack.icon}
            {currentPack.title}
          </CardTitle>
          <CardDescription>{currentPack.description}</CardDescription>
        </CardHeader>
      </Card>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            {['upload', 'validate', 'train'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 
                  ${getStepStatus(step) === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                    getStepStatus(step) === 'current' ? 'bg-blue-500 border-blue-500 text-white' :
                    'bg-gray-100 border-gray-300 text-gray-500'}
                `}>
                  {getStepStatus(step) === 'completed' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span className="ml-2 text-sm font-medium capitalize">{step}</span>
                {index < 2 && <div className="w-16 h-0.5 bg-gray-300 mx-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Model Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a unique name for your model" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-row space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="person" id="person" />
                          <label htmlFor="person">Person</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="style" id="style" />
                          <label htmlFor="style">Style</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Training Images
              </CardTitle>
              <CardDescription>
                Upload {currentPack.recommendedImages} for best results. Images will be automatically validated and optimized.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                  ${isUploading ? 'pointer-events-none opacity-50' : ''}
                `}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">
                  {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to select files (JPEG, PNG, WebP)
                </p>
                <Button type="button" variant="outline" disabled={isUploading}>
                  Select Images
                </Button>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-gray-600 mt-2">
                    Uploading and validating images...
                  </p>
                </div>
              )}

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Uploaded Images ({uploadedFiles.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={file.preview}
                            alt={file.file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        
                        {/* Status Badge */}
                        <div className="absolute top-2 left-2">
                          {file.status === 'uploaded' && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ready
                            </Badge>
                          )}
                          {file.status === 'uploading' && (
                            <Badge variant="default" className="bg-blue-500">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                              Uploading
                            </Badge>
                          )}
                          {file.status === 'error' && (
                            <Badge variant="destructive">
                              <X className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* File Name */}
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          {file.file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validationResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Validation Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {validationResult.validImages}
                    </div>
                    <div className="text-sm text-gray-600">Valid Images</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {(validationResult.overallQualityScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Quality Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {validationResult.estimatedTrainingTime}m
                    </div>
                    <div className="text-sm text-gray-600">Est. Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      ${validationResult.estimatedCost.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Est. Cost</div>
                  </div>
                </div>

                {validationResult.recommendations.length > 0 && (
                  <Alert className="mb-4">
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

                {validationResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <X className="h-4 w-4" />
                    <AlertTitle>Issues Found</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {validationResult.errors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Training Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                type="submit"
                className="w-full"
                disabled={!validationResult?.isReady || isTraining}
                size="lg"
              >
                {isTraining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting Training...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Training ({validationResult?.validImages || 0} images)
                  </>
                )}
              </Button>
              
              {validationResult && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  Estimated training time: {validationResult.estimatedTrainingTime} minutes • 
                  Cost: ${validationResult.estimatedCost.toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}