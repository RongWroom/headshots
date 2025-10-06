'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { UploadedImage } from '@/types/seedream';

interface UploadedFile {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  blobUrl?: string;
}

interface SeedreamUploadZoneProps {
  onUploadComplete?: (uploadId: string, images: UploadedImage[]) => void;
  maxFiles?: number;
  minFiles?: number;
}

export default function SeedreamUploadZone({
  onUploadComplete,
  maxFiles = 5,
  minFiles = 1
}: SeedreamUploadZoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  // Validate file on client side
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Only JPEG, PNG, and WebP are allowed.`
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is 10MB.`
      };
    }

    return { valid: true };
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((rejection) => {
          const { file, errors } = rejection;
          const errorMessages = errors.map((error: any) => {
            switch (error.code) {
              case 'file-too-large':
                return `File "${file.name}" is too large. Maximum size is 10MB.`;
              case 'file-invalid-type':
                return `File "${file.name}" has an invalid format. Only JPEG, PNG, and WebP are allowed.`;
              case 'too-many-files':
                return `Too many files selected. Maximum is ${maxFiles} files.`;
              default:
                return `File "${file.name}": ${error.message}`;
            }
          });

          toast({
            title: 'File Upload Error',
            description: errorMessages.join(' '),
            variant: 'destructive'
          });
        });
        return;
      }

      // Check if adding these files would exceed the limit
      if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
        toast({
          title: 'Too many files',
          description: `You can upload up to ${maxFiles} images. Currently have ${uploadedFiles.length}.`,
          variant: 'destructive'
        });
        return;
      }

      // Filter out duplicates
      const newFiles = acceptedFiles.filter((file) => {
        return !uploadedFiles.some(
          (f) => f.file.name === file.name && f.file.size === file.size
        );
      });

      if (newFiles.length === 0) {
        toast({
          title: 'No new files',
          description: 'All selected files are already uploaded.',
          variant: 'destructive'
        });
        return;
      }

      // Validate each file
      const validatedFiles: UploadedFile[] = [];
      for (const file of newFiles) {
        const validation = validateFile(file);
        if (!validation.valid) {
          toast({
            title: `Invalid file: ${file.name}`,
            description: validation.error,
            variant: 'destructive'
          });
          continue;
        }

        validatedFiles.push({
          file,
          preview: URL.createObjectURL(file),
          status: 'pending'
        });
      }

      if (validatedFiles.length === 0) {
        return;
      }

      // Add files to state with 'pending' status (don't upload yet)
      setUploadedFiles((prev) => [...prev, ...validatedFiles]);
    },
    [uploadedFiles, maxFiles, toast]
  );

  // Manual upload function (called by button click)
  const uploadAllFiles = async () => {
    const pendingFiles = uploadedFiles.filter((f) => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast({
        title: 'No files to upload',
        description: 'All files have already been uploaded.',
        variant: 'default'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Update status to uploading
      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.status === 'pending' ? { ...file, status: 'uploading' } : file
        )
      );

      // Create FormData with all pending files
      const formData = new FormData();
      pendingFiles.forEach((uploadFile) => {
        formData.append('files', uploadFile.file);
      });

      setUploadProgress(30);

      // Upload to API
      const response = await fetch('/api/seedream/upload', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(60);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Upload failed');
      }

      setUploadProgress(90);

      // Update file statuses with blob URLs
      setUploadedFiles((prev) =>
        prev.map((file) => {
          if (file.status === 'uploading') {
            const uploadedImage = result.images.find(
              (img: UploadedImage) => img.filename === file.file.name
            );
            return {
              ...file,
              status: 'uploaded',
              blobUrl: uploadedImage?.blobUrl
            };
          }
          return file;
        })
      );

      setUploadProgress(100);

      toast({
        title: 'Upload Complete',
        description: `Successfully uploaded ${result.images.length} image(s).`,
        variant: 'default'
      });

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(result.uploadId, result.images);
      }
    } catch (error) {
      console.error('Upload error:', error);

      // Mark files as error
      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.status === 'uploading'
            ? {
                ...file,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed'
              }
            : file
        )
      );

      toast({
        title: 'Upload Failed',
        description:
          error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  });

  const uploadedCount = uploadedFiles.filter((f) => f.status === 'uploaded').length;
  const pendingCount = uploadedFiles.filter((f) => f.status === 'pending').length;
  const canUploadMore = uploadedFiles.length < maxFiles;
  const hasFilesToUpload = pendingCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Photos
        </CardTitle>
        <CardDescription>
          Upload {minFiles}-{maxFiles} casual photos (JPEG, PNG, or WebP, max 10MB each)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        {canUploadMore && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-300 hover:border-gray-400'
              }
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to select files
            </p>
            <Button type="button" variant="outline" disabled={isUploading}>
              Select Images
            </Button>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-gray-600 text-center">
              Uploading images...
            </p>
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Uploaded Images ({uploadedCount}/{maxFiles})
              </h4>
              {uploadedCount >= minFiles && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-2 left-2">
                    {file.status === 'uploaded' && (
                      <div className="bg-green-500 text-white rounded-full p-1">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    )}
                    {file.status === 'uploading' && (
                      <div className="bg-blue-500 text-white rounded-full p-1">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      </div>
                    )}
                    {file.status === 'pending' && (
                      <div className="bg-gray-500 text-white rounded-full p-1">
                        <Upload className="h-4 w-4" />
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="bg-red-500 text-white rounded-full p-1">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* File Name */}
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {file.file.name}
                  </p>

                  {/* Error Message */}
                  {file.error && (
                    <p className="text-xs text-red-500 mt-1">{file.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {hasFilesToUpload && (
          <Button
            onClick={uploadAllFiles}
            disabled={isUploading}
            className="w-full"
            size="lg"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading {pendingCount} image(s)...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {pendingCount} image(s)
              </>
            )}
          </Button>
        )}

        {/* Upload Status Message */}
        {uploadedFiles.length > 0 && uploadedCount < minFiles && !hasFilesToUpload && (
          <p className="text-sm text-amber-600">
            Upload at least {minFiles - uploadedCount} more image(s) to continue
          </p>
        )}
        
        {uploadedCount >= minFiles && !hasFilesToUpload && (
          <p className="text-sm text-green-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Ready! {uploadedCount} image(s) uploaded successfully
          </p>
        )}
      </CardContent>
    </Card>
  );
}
