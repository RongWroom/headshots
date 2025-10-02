"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep if used, remove if not
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { SubmitHandler, useForm } from "react-hook-form";
import { FaFemale, FaImages, FaMale, FaRainbow } from "react-icons/fa";
import * as z from "zod";
import { fileUploadFormSchema } from "@/types/zod"; // Ensure this path is correct
import { upload } from "@vercel/blob/client";
import { ImageInspector } from "./ImageInspector"; // Ensure this path is correct
import { ImageInspectionResult, aggregateCharacteristics } from "@/lib/imageInspection"; // Ensure this path is correct
import { validateImageFiles, validateImageDimensions } from "@/lib/image-validation";
import TrainingStatusPoller from "./TrainingStatusPoller";

type FormInput = z.infer<typeof fileUploadFormSchema>;

interface TrainModelZoneProps {
  packSlug: string;
}

interface PackInfo {
  title: string;
  exampleImageUrls: string[];
  description?: string;
  minImages?: number;
  recommendedImages?: string;
}

const packSpecificInfo: Record<string, PackInfo> = {
  "raw-tune": {
    title: "Photography Style Training",
    description: "Train a model on your signature photography style. Upload 20-50 examples of your best headshot work to create your unique style foundation.",
    exampleImageUrls: [
      "/images/examples/style-1.jpg",
      "/images/examples/style-2.jpg",
      "/images/examples/style-3.jpg",
    ],
    minImages: 10,
    recommendedImages: "20-50 images",
  },
  "actor-headshots": {
    title: "Actor Headshots Pack",
    description: "Create professional actor headshots with a classic, compelling look. Upload 5-10 clear photos of the subject.",
    exampleImageUrls: [
      "/images/examples/actor-1.jpg",
      "/images/examples/actor-2.jpg",
      "/images/examples/actor-3.jpg",
    ],
    minImages: 5,
    recommendedImages: "5-10 images",
  },
  "corporate-headshots": {
    title: "Corporate Headshots Pack",
    description: "Generate polished corporate headshots perfect for your professional profile. Upload 5-10 clear photos of the subject.",
    exampleImageUrls: [
      "/images/examples/corporate-1.jpg",
      "/images/examples/corporate-2.jpg",
      "/images/examples/corporate-3.jpg",
    ],
    minImages: 5,
    recommendedImages: "5-10 images",
  },
};

interface ProcessedFile {
  file: File;
  url: string;
  analysis: ImageInspectionResult;
}

export default function TrainModelZone({ packSlug }: TrainModelZoneProps) {
  const [currentPack, setCurrentPack] = useState<PackInfo>({
    title: "Loading Pack...",
    description: "",
    exampleImageUrls: [],
    minImages: 1,
    recommendedImages: "at least 1 image"
  });

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [characteristics, setCharacteristics] = useState<ImageInspectionResult[]>([]);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [trainingId, setTrainingId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleInspectionComplete = useCallback((result: ImageInspectionResult) => {
    setCharacteristics((prev) => [...prev, result]);
  }, []);

  useEffect(() => {
    const packData = packSpecificInfo[packSlug] || {
      title: "Unknown Headshot Pack",
      description: "Please select a valid pack.",
      exampleImageUrls: [],
      minImages: 1,
      recommendedImages: "at least 1 image"
    };
    setCurrentPack(packData);
  }, [packSlug]);

  const form = useForm<FormInput>({
    resolver: zodResolver(fileUploadFormSchema),
    defaultValues: {
      name: "",
      type: "person", // Default to person, or adjust as needed
      triggerWord: packSlug === "raw-tune" ? "" : undefined,
    },
  });

  const onSubmit: SubmitHandler<FormInput> = async () => {
    await trainModel();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        // Check if required fields are filled before allowing uploads
        const currentValues = form.getValues();
        const isRawTune = packSlug === "raw-tune";

        if (!currentValues.name || (isRawTune && !currentValues.triggerWord)) {
          const missingFields = [];
          if (!currentValues.name) missingFields.push("Model Name");
          if (isRawTune && !currentValues.triggerWord) missingFields.push("Trigger Word");

          toast({
            title: "Required fields missing",
            description: `Please fill in ${missingFields.join(" and ")} before uploading images.`,
            variant: "destructive",
          });
          return;
        }

        // Filter out duplicates first
        const newFiles = acceptedFiles.filter((file) => {
          return !files.some((f) => f.file.name === file.name && f.file.size === file.size);
        });

        if (newFiles.length === 0) {
          toast({
            title: "No new files",
            description: "All selected files are already uploaded.",
            variant: "destructive",
          });
          return;
        }

        // Check if adding these files would exceed the limit
        if (newFiles.length + files.length > 50) {
          toast({
            title: "Too many images",
            description: `You can upload up to 50 images total. Currently have ${files.length}, trying to add ${newFiles.length}.`,
            variant: "destructive",
          });
          return;
        }

        // Comprehensive validation using our utility
        const allFilesToValidate = [...files.map(f => f.file), ...newFiles];
        const validation = validateImageFiles(allFilesToValidate);

        if (!validation.isValid) {
          toast({
            title: "File Validation Failed",
            description: validation.errors.slice(0, 2).join(' ') + (validation.errors.length > 2 ? ` (and ${validation.errors.length - 2} more errors)` : ''),
            variant: "destructive",
          });
          return;
        }

        // Show warnings if any
        if (validation.warnings.length > 0) {
          toast({
            title: "Validation Warnings",
            description: validation.warnings.slice(0, 2).join(' '),
            variant: "default",
          });
        }

        // Only process the new valid files
        const validNewFiles = newFiles.filter(file =>
          validation.validFiles.some(validFile =>
            validFile.name === file.name && validFile.size === file.size
          )
        );

        if (validNewFiles.length === 0) {
          toast({
            title: "No valid files",
            description: "No new files passed validation.",
            variant: "destructive",
          });
          return;
        }


        setIsLoading(true);
        setLoadingStep('Validating image dimensions...');
        setUploadProgress({ current: 0, total: validNewFiles.length });

        // Validate image dimensions for each file
        const dimensionValidations = await Promise.all(
          validNewFiles.map(file => validateImageDimensions(file, 256, 256, 4096, 4096))
        );

        // Check for dimension validation failures
        const dimensionErrors: string[] = [];
        dimensionValidations.forEach((validation, index) => {
          if (!validation.isValid) {
            dimensionErrors.push(`${validNewFiles[index].name}: ${validation.errors.join(', ')}`);
          }
        });

        if (dimensionErrors.length > 0) {
          toast({
            title: "Image Dimension Issues",
            description: dimensionErrors.slice(0, 2).join(' ') + (dimensionErrors.length > 2 ? ` (and ${dimensionErrors.length - 2} more)` : ''),
            variant: "destructive",
          });
          setIsLoading(false);
          setLoadingStep('');
          return;
        }

        setLoadingStep('Uploading and analyzing images...');

        // Process files sequentially to show progress
        const processedFiles: ProcessedFile[] = [];
        for (let i = 0; i < validNewFiles.length; i++) {
          const file = validNewFiles[i];
          setUploadProgress({ current: i + 1, total: validNewFiles.length });
          setLoadingStep(`Processing ${file.name} (${i + 1}/${validNewFiles.length})...`);

          try {
            // First, upload the file with filename in header
            const safeFilename = file.name.replace(/\s+/g, '_').replace(/[^\w\-.]/g, '');

            console.log('Starting file upload:', file.name, 'Safe filename:', safeFilename);

            // Get model name for folder organization
            const modelName = form.getValues("name").trim().toLowerCase().replace(/\s+/g, "-") || `model-${Date.now()}`;

            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              body: file, // Send file directly
              headers: {
                'X-Filename': safeFilename,
                'X-Model-Name': modelName, // Add model name as header
                'Content-Type': file.type || 'application/octet-stream',
              },
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.json().catch(() => ({}));
              throw new Error(error.message || `Failed to upload ${file.name}`);
            }

            const { url } = await uploadResponse.json();

            // Then analyze the image
            const analysisResponse = await fetch('/api/replicate/analyze-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                imageUrl: url,
                analysisType: form.getValues('type'),
              }),
            });

            if (!analysisResponse.ok) {
              throw new Error(`Failed to analyze ${file.name}`);
            }

            const analysis = await analysisResponse.json();
            const processedFile: ProcessedFile = { file, url, analysis };
            handleInspectionComplete(analysis);
            processedFiles.push(processedFile);

          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);

            // Show specific error message based on error type
            let errorTitle = `Error processing ${file.name}`;
            let errorDescription = 'Unknown error occurred';
            let suggestions: string[] = [];

            if (error instanceof Error) {
              if (error.message.includes('Failed to upload')) {
                errorTitle = `Upload failed: ${file.name}`;
                errorDescription = 'Could not upload file to storage';
                suggestions = [
                  'Check your internet connection',
                  'Try uploading a smaller file',
                  'Refresh the page and try again'
                ];
              } else if (error.message.includes('Failed to analyze')) {
                errorTitle = `Analysis failed: ${file.name}`;
                errorDescription = 'Could not analyze the uploaded image';
                suggestions = [
                  'Ensure the file is a valid image',
                  'Try a different image format',
                  'Check if the image is corrupted'
                ];
              } else {
                errorDescription = error.message;
              }
            }

            toast({
              title: errorTitle,
              description: errorDescription + (suggestions.length > 0 ? `. Suggestions: ${suggestions.slice(0, 2).join(', ')}` : ''),
              variant: 'destructive',
            });
          }
        }

        // Update state with successfully processed files
        if (processedFiles.length > 0) {
          setFiles(prev => [...prev, ...processedFiles]);
          toast({
            title: "Upload Complete",
            description: `Successfully processed ${processedFiles.length} of ${validNewFiles.length} images.`,
            variant: "default",
          });
        }

      } catch (error) {
        console.error('Error in file drop handler:', error);
        toast({
          title: 'Error processing files',
          description: error instanceof Error ? error.message : 'Unknown error occurred during file processing',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setLoadingStep('');
        setUploadProgress({ current: 0, total: 0 });
      }
    },
    [files, toast, form, handleInspectionComplete]
  );



  const trainModel = useCallback(async () => {
    if (files.length < (currentPack.minImages || 1)) {
      toast({
        title: "Not enough images",
        description: `Please upload at least ${currentPack.minImages || 1} images for the ${currentPack.title}.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setLoadingStep('Preparing training data...');

    try {
      // Use the URLs from already uploaded files
      const imageUrls = files.map((file) => file.url);
      const modelName = form.getValues("name").trim().toLowerCase().replace(/\s+/g, "-") || `model-${Date.now()}`;
      const modelType = form.getValues("type") as 'man' | 'woman' | 'person';

      console.log('Starting model training with URLs:', imageUrls);

      setLoadingStep('Validating training configuration...');

      // Call our training API
      setLoadingStep('Starting training job...');
      const trainingResponse = await fetch('/api/runpod/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls,
          modelName,
          packSlug,
          trainingConfig: {
            trigger_word: `sks${modelName.substring(0, 4)}`,
            lora_type: "style",
            training_steps: 1000,
            subject_type: modelType === 'person' ? 'person' : modelType === 'man' ? 'male' : 'female'
          }
        }),
      });

      const result = await trainingResponse.json();

      if (!trainingResponse.ok) {
        // Handle specific error types with user-friendly messages
        if (result.code === 'INSUFFICIENT_CREDITS' || (result.message && result.message.includes("credits"))) {
          const messageWithButton = (
            <div className="flex flex-col gap-4">
              <p>You don't have enough credits to start training. Training requires credits to cover GPU usage.</p>
              <a href="/get-credits">
                <Button size="sm">Get Credits</Button>
              </a>
            </div>
          );

          toast({
            title: "Insufficient Credits",
            description: messageWithButton,
            variant: "destructive",
            duration: 15000,
          });
        } else if (result.code === 'TRAINING_MODEL_MISCONFIGURATION') {
          toast({
            title: "Training Configuration Issue",
            description: "There's a configuration issue with the training model. This is a known issue that our team is working to resolve.",
            variant: "destructive",
            duration: 10000,
          });
        } else if (result.code === 'INVALID_TRAINING_INPUT') {
          toast({
            title: "Invalid Training Data",
            description: result.message || "The uploaded images don't meet the training requirements. Please check image quality and format.",
            variant: "destructive",
            duration: 10000,
          });
        } else if (result.code === 'AUTHENTICATION_FAILED') {
          toast({
            title: "Authentication Error",
            description: "Please sign in again to continue training.",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          // Generic error with helpful suggestions
          const suggestions = [
            'Check your internet connection',
            'Try refreshing the page',
            'Contact support if the issue persists'
          ];

          toast({
            title: "Training Failed",
            description: `${result.message || 'An error occurred while starting training'}. Suggestions: ${suggestions.slice(0, 2).join(', ')}.`,
            variant: "destructive",
            duration: 10000,
          });
        }
        return;
      }

      setLoadingStep('Training job started successfully!');

      // Capture training ID for status polling
      if (result.trainingId) {
        setTrainingId(result.trainingId);
      }

      toast({
        title: "Training Started! 🎉",
        description: `Your ${currentPack.title.toLowerCase()} model "${modelName}" is now being trained. Status updates will appear automatically.`,
        duration: 8000,
      });

      // Reset form and state (but keep trainingId for polling)
      form.reset({ name: "", type: "person" });
      setFiles([]);
      setCharacteristics([]);

      // Don't redirect immediately - let user see the status poller
      // setTimeout(() => {
      //   router.push("/"); 
      // }, 2000);

    } catch (error) {
      console.error("Training error:", error);

      // Handle different types of errors with specific messages
      let errorTitle = "Training Error";
      let errorDescription = "An unknown error occurred while starting training.";
      let suggestions: string[] = [];

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorTitle = "Connection Error";
          errorDescription = "Could not connect to the training service.";
          suggestions = [
            'Check your internet connection',
            'Try again in a few moments',
            'Contact support if the issue persists'
          ];
        } else if (error.message.includes('timeout')) {
          errorTitle = "Request Timeout";
          errorDescription = "The training request took too long to process.";
          suggestions = [
            'Try again with fewer images',
            'Check your internet connection',
            'Contact support if this continues'
          ];
        } else {
          errorDescription = error.message;
          suggestions = [
            'Try refreshing the page',
            'Check that all images are valid',
            'Contact support for assistance'
          ];
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription + (suggestions.length > 0 ? ` Suggestions: ${suggestions.slice(0, 2).join(', ')}.` : ''),
        variant: "destructive",
        duration: 12000,
      });
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  }, [files, characteristics, form, router, toast, currentPack]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"]
    },
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024, // 10MB individual file limit
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const { file, errors } = rejection;
        const errorMessages = errors.map(error => {
          switch (error.code) {
            case 'file-too-large':
              return `File "${file.name}" is too large. Maximum size is 10MB.`;
            case 'file-invalid-type':
              return `File "${file.name}" has an invalid format. Only JPG, PNG, and WebP are allowed.`;
            case 'too-many-files':
              return `Too many files selected. Maximum is 50 files.`;
            default:
              return `File "${file.name}": ${error.message}`;
          }
        });

        toast({
          title: "File Upload Error",
          description: errorMessages.join(' '),
          variant: "destructive",
        });
      });
    },
  });

  const modelType = form.watch("type");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Pack Information and Examples */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">{currentPack.title}</h1>
        {currentPack.description && (
          <p className="text-lg text-muted-foreground mb-6">{currentPack.description}</p>
        )}
        {currentPack.exampleImageUrls.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Example Results:</h3>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {currentPack.exampleImageUrls.map((url, index) => (
                <div key={index} className="aspect-square relative rounded-lg overflow-hidden border shadow-md">
                  <Image
                    src={url}
                    alt={`Example ${index + 1} for ${currentPack.title}`}
                    width={300}
                    height={300}
                    priority
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left Column: Form Fields */}
            <div className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Model Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., dan-dan-signature-style"
                        {...field}
                        disabled={isLoading}
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription>
                      Give your trained model a unique name (required before upload).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Only show trigger word for photographer training */}
              {packSlug === "raw-tune" && (
                <FormField
                  control={form.control}
                  name="triggerWord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Trigger Word *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., dandanstyle"
                          {...field}
                          disabled={isLoading}
                          className="text-base"
                        />
                      </FormControl>
                      <FormDescription>
                        A unique word to activate your style (required before upload).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base">Subject Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2"
                        disabled={isLoading}
                      >
                        <FormItem className="flex items-center space-x-3">
                          <FormControl><RadioGroupItem value="man" /></FormControl>
                          <Label className="font-normal flex items-center text-base"><FaMale className="mr-2 h-5 w-5 text-blue-500" />Man</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3">
                          <FormControl><RadioGroupItem value="woman" /></FormControl>
                          <Label className="font-normal flex items-center text-base"><FaFemale className="mr-2 h-5 w-5 text-pink-500" />Woman</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3">
                          <FormControl><RadioGroupItem value="person" /></FormControl>
                          <Label className="font-normal flex items-center text-base"><FaRainbow className="mr-2 h-5 w-5 text-purple-500" />Person/Other</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isLoading || files.length < (currentPack.minImages || 1) || !form.watch("name") || (packSlug === "raw-tune" && !form.watch("triggerWord"))}
                className="w-full text-lg py-3"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>
                      {loadingStep || "Processing..."}
                      {uploadProgress.total > 0 && ` (${uploadProgress.current}/${uploadProgress.total})`}
                    </span>
                  </div>
                ) : (
                  `Train Model (${files.length}/${currentPack.recommendedImages || '10'})`
                )}
              </Button>

              {isLoading && loadingStep && (
                <div className="mt-2 text-sm text-muted-foreground text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span>{loadingStep}</span>
                  </div>
                  {uploadProgress.total > 0 && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Image Upload & Preview */}
            <div className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
              <div {...getRootProps()} className={`cursor-pointer relative ${isLoading ? 'pointer-events-none' : ''}`}>
                <input {...getInputProps()} disabled={isLoading} />
                <div
                  className={`w-full p-8 border-2 border-dashed rounded-lg text-center transition-colors relative
                    ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}
                    ${isLoading ? "opacity-50" : ""}`}
                >
                  <FaImages className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-3" />
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      <p className="font-semibold text-primary text-lg">
                        {loadingStep || "Processing..."}
                      </p>
                      {uploadProgress.total > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {uploadProgress.current} of {uploadProgress.total} files
                        </p>
                      )}
                    </div>
                  ) : isDragActive ? (
                    <p className="font-semibold text-primary text-lg">Drop images here...</p>
                  ) : (
                    <p className="text-md text-muted-foreground">
                      {packSlug === "raw-tune"
                        ? `Fill in Model Name and Trigger Word above, then drag & drop ${currentPack.recommendedImages || 'up to 50 images'} here, or click to select (max 10MB per file).`
                        : `Fill in Model Name above, then drag & drop ${currentPack.recommendedImages || 'up to 50 images'} here, or click to select (max 10MB per file).`
                      }
                    </p>
                  )}
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Selected Images: {files.length}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {files.map((file, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={file.url}
                          alt={`Preview ${index + 1}`}
                          width={100}
                          height={100}
                          priority
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles(files.filter((_, i) => i !== index));
                            setCharacteristics(characteristics.filter((_, i) => i !== index));
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                        <div className="mt-1 text-xs text-muted-foreground truncate w-24">
                          {file.file.name}
                        </div>
                        <ImageInspector
                          analysisResult={file.analysis} // Pass the analysis result from the ProcessedFile object
                          expectedType={form.watch('type')} // Pass the expected type for comparison
                        />
                      </div>
                    ))}
                  </div>
                  {files.length < (currentPack.minImages || 1) && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Please upload at least {currentPack.minImages || 1} images to enable training.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>
      </Form>

      {/* Training Status Poller - shows when training is in progress */}
      {trainingId && (
        <TrainingStatusPoller
          trainingId={trainingId}
          onComplete={() => {
            // Redirect to overview when training completes
            setTimeout(() => {
              router.push("/overview");
            }, 3000);
          }}
        />
      )}
    </div>
  );
}
