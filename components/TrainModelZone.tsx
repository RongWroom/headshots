"use client";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { SubmitHandler, useForm } from "react-hook-form";
import { FaFemale, FaImages, FaMale, FaRainbow } from "react-icons/fa";
import * as z from "zod";
import { fileUploadFormSchema } from "@/types/zod";
import { upload } from "@vercel/blob/client";
import { ImageInspector } from "./ImageInspector";
import { ImageInspectionResult, aggregateCharacteristics } from "@/lib/imageInspection";

type FormInput = z.infer<typeof fileUploadFormSchema>;

interface TrainModelZoneProps {
  packSlug: string;
}

export default function TrainModelZone({ packSlug }: TrainModelZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [characteristics, setCharacteristics] = useState<ImageInspectionResult[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<FormInput>({
    resolver: zodResolver(fileUploadFormSchema),
    defaultValues: {
      name: "",
      type: "person",
    },
  });

  const onSubmit: SubmitHandler<FormInput> = async () => {
    await trainModel();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.filter(
        (file) => !files.some((f) => f.name === file.name)
      );

      if (newFiles.length + files.length > 10) {
        toast({
          title: "Too many images",
          description: "You can only upload up to 10 images in total.",
          variant: "destructive",
        });
        return;
      }

      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      const newSize = newFiles.reduce((acc, file) => acc + file.size, 0);

      if (totalSize + newSize > 4.5 * 1024 * 1024) {
        toast({
          title: "File size limit exceeded",
          description: "Total size of all images cannot exceed 4.5MB.",
          variant: "destructive",
        });
        return;
      }

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files, toast]
  );

  const handleInspectionComplete = (result: ImageInspectionResult) => {
    setCharacteristics((prev) => [...prev, result]);
  };

  const trainModel = useCallback(async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one image to train your model.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upload files and get URLs
      const uploadPromises = files.map((file) =>
        upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })
      );

      const blobs = await Promise.all(uploadPromises);
      const imageUrls = blobs.map((blob) => blob.url);

      const modelName = form.getValues("name").trim().toLowerCase().replace(/\s+/g, "-");
      const aggregatedCharacteristics = aggregateCharacteristics(characteristics);

      // Start training with Replicate
      const trainingResponse = await fetch("/api/replicate/train", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrls,
          modelName,
          trainingConfig: {
            training_steps: 1000,
            learning_rate: 1e-6,
            resolution: 768,
            ...aggregatedCharacteristics,
          },
        }),
      });

      const result = await trainingResponse.json();

      if (!trainingResponse.ok) {
        // Handle credit-related errors
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
            duration: 5000,
          });
          return;
        }
        
        throw new Error(result.error || result.message || 'Failed to start training');
      }

      // Show success message
      toast({
        title: "Training started",
        description: "Your model is being trained. You'll be notified when it's ready.",
        duration: 5000,
      });

      // Reset form
      form.reset({
        name: "",
        type: "person",
      });
      setFiles([]);
      setCharacteristics([]);
      
      // Redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Training error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start training",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [files, characteristics, form, router, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const modelType = form.watch("type");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Train New Model</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Form fields */}
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter a name for your model"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be used to identify your model.
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
                    <FormLabel>Model Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                        disabled={isLoading}
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="man" />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center">
                            <FaMale className="mr-2 h-4 w-4 text-blue-500" />
                            Male
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="woman" />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center">
                            <FaFemale className="mr-2 h-4 w-4 text-pink-500" />
                            Female
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="other" />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center">
                            <FaRainbow className="mr-2 h-4 w-4 text-purple-500" />
                            Other
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading || files.length === 0}
                  className="w-full"
                >
                  {isLoading ? "Training..." : "Train Model"}
                </Button>
              </div>
            </div>

            {/* Right column - Image upload */}
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <FaImages className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive
                      ? "Drop the files here..."
                      : "Drag & drop images here, or click to select files"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Up to 10 images, 10MB total
                  </p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Selected Images ({files.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {files.map((file, index) => (
                      <div key={index} className="relative group">
                        <ImageInspector
                          file={file}
                          type={modelType}
                          onInspectionComplete={handleInspectionComplete}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles(files.filter((_, i) => i !== index));
                            setCharacteristics(characteristics.filter((_, i) => i !== index));
                          }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
