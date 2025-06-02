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
    },
  });

  const onSubmit: SubmitHandler<FormInput> = async () => {
    await trainModel();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        const newFiles = acceptedFiles.filter(
          (file) => !files.some((f) => f.file.name === file.name && f.file.size === file.size)
        );

        if (newFiles.length + files.length > 10) {
          toast({
            title: "Too many images",
            description: "You can only upload up to 10 images in total.",
            variant: "destructive",
          });
          return;
        }

        const totalSize = files.reduce((acc, file) => acc + file.file.size, 0);
        const newSize = newFiles.reduce((acc, file) => acc + file.size, 0);

        if (totalSize + newSize > 10 * 1024 * 1024) {
          toast({
            title: "File size limit exceeded",
            description: "Total size of all images cannot exceed 10MB.",
            variant: "destructive",
          });
          return;
        }


        setIsLoading(true);
        const processedFiles: (ProcessedFile | null)[] = await Promise.all(
          newFiles.map(async (file) => {
            try {
              // First, upload the file
              const formData = new FormData();
              formData.append('file', file);
              
              const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });

              if (!uploadResponse.ok) {
                const error = await uploadResponse.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to upload file');
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
                throw new Error('Failed to analyze image');
              }

              const analysis = await analysisResponse.json();
              const processedFile: ProcessedFile = { file, url, analysis };
              handleInspectionComplete(analysis);
              return processedFile;
            } catch (error) {
              console.error(`Error processing file ${file.name}:`, error);
              toast({
                title: `Error processing ${file.name}`,
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
              });
              return null;
            }
          })
        );

        // Filter out any failed uploads and update state
        const successfulFiles = processedFiles.filter((file): file is ProcessedFile => file !== null);
        setFiles(prev => [...prev, ...successfulFiles]);

      } catch (error) {
        console.error('Error in file drop handler:', error);
        toast({
          title: 'Error processing files',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
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

    try {
      // Upload files and get URLs
      const uploadPromises = files.map((item) => // Changed 'file' to 'item' to avoid confusion with the 'file' property of ProcessedFile
        upload(item.file.name, item.file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })
      );

      const blobs = await Promise.all(uploadPromises);
      const imageUrls = blobs.map((blob) => blob.url);
      const modelName = form.getValues("name").trim().toLowerCase().replace(/\s+/g, "-") || `model-${Date.now()}`;
      const modelType = form.getValues("type") as 'man' | 'woman' | 'person';

      // Call our new training API
      const trainingResponse = await fetch('/api/replicate/train', {
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
        if (result.message && result.message.includes("credits")) {
          const messageWithButton = (
            <div className="flex flex-col gap-4">
              {result.message}
              <a href="/get-credits">
                <Button size="sm">Get Credits</Button>
              </a>
            </div>
          );
          
          toast({
            title: "Insufficient Credits",
            description: messageWithButton,
            variant: "destructive",
            duration: 10000,
          });
        } else {
          throw new Error(result.error?.message || 'Failed to start training');
        }
        return;
      }

      toast({
        title: "Training started!",
        description: "Your model is being trained. You'll be notified when it's ready.",
        duration: 5000,
      });

      form.reset({ name: "", type: "person" });
      setFiles([]);
      setCharacteristics([]);
      router.push("/"); // Or to a "training in progress" page

    } catch (error) {
      console.error("Training error:", error);
      toast({
        title: "Training Error",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [files, characteristics, form, router, toast, currentPack]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 10,
    maxSize: 4.5 * 1024 * 1024, // Individual file size limit can also be set here if desired
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
                    <FormLabel className="text-base">Your Model Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., MyProHeadshots"
                        {...field}
                        disabled={isLoading}
                        className="text-base"
                      />
                    </FormControl>
                    <FormDescription>
                      Give your trained model a unique name. If blank, one will be generated.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                disabled={isLoading || files.length < (currentPack.minImages || 1)}
                className="w-full text-lg py-3"
                size="lg"
              >
                {isLoading ? "Processing..." : `Train Model (${files.length}/${currentPack.recommendedImages || '10'})`}
              </Button>
            </div>

            {/* Right Column: Image Upload & Preview */}
            <div className="space-y-6 p-6 border rounded-lg shadow-sm bg-card">
              <div {...getRootProps()} className="cursor-pointer">
                <input {...getInputProps()} />
                <div
                  className={`w-full p-8 border-2 border-dashed rounded-lg text-center transition-colors
                    ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}`}
                >
                  <FaImages className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-3" />
                  {isDragActive ? (
                    <p className="font-semibold text-primary text-lg">Drop images here...</p>
                  ) : (
                    <p className="text-md text-muted-foreground">
                      Drag & drop {currentPack.recommendedImages || 'up to 10 images'} here, or click to select (max 4.5MB total).
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
    </div>
  );
}
