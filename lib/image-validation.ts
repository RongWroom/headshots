/**
 * Image validation utilities for client and server-side validation
 */

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    type: string;
    name: string;
  };
}

export interface ImageAccessibilityResult {
  isAccessible: boolean;
  statusCode?: number;
  error?: string;
  contentType?: string;
  contentLength?: number;
}

/**
 * Validates image file on the client side
 */
export function validateImageFile(file: File): ImageValidationResult {
  const result: ImageValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fileInfo: {
      size: file.size,
      type: file.type,
      name: file.name
    }
  };

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const minFileSize = 1024; // 1KB

  // Validate file type
  if (!allowedTypes.includes(file.type)) {
    result.errors.push(`Invalid file type "${file.type}". Allowed types: ${allowedTypes.join(', ')}`);
    result.isValid = false;
  }

  // Validate file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    result.errors.push(`Invalid file extension "${extension}". Allowed extensions: ${allowedExtensions.join(', ')}`);
    result.isValid = false;
  }

  // Validate file size
  if (file.size > maxFileSize) {
    result.errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxFileSize / 1024 / 1024}MB`);
    result.isValid = false;
  }

  if (file.size < minFileSize) {
    result.errors.push(`File too small: ${file.size} bytes. Minimum required: ${minFileSize} bytes`);
    result.isValid = false;
  }

  // Validate file name
  if (file.name.length > 255) {
    result.errors.push('File name too long. Maximum 255 characters allowed.');
    result.isValid = false;
  }

  // Check for potentially problematic characters in filename
  const problematicChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (problematicChars.test(file.name)) {
    result.warnings.push('File name contains special characters that may cause issues.');
  }

  // Warn about very large files
  if (file.size > 5 * 1024 * 1024) { // 5MB
    result.warnings.push('Large file size may result in slower upload and processing.');
  }

  return result;
}

/**
 * Validates multiple image files
 */
export function validateImageFiles(files: File[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validFiles: File[];
  invalidFiles: { file: File; validation: ImageValidationResult }[];
  totalSize: number;
} {
  const maxTotalSize = 200 * 1024 * 1024; // 200MB
  const maxFileCount = 50;

  const result = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
    validFiles: [] as File[],
    invalidFiles: [] as { file: File; validation: ImageValidationResult }[],
    totalSize: 0
  };

  // Validate file count
  if (files.length > maxFileCount) {
    result.errors.push(`Too many files: ${files.length}. Maximum allowed: ${maxFileCount}`);
    result.isValid = false;
  }

  // Validate each file and calculate total size
  files.forEach((file) => {
    const validation = validateImageFile(file);
    result.totalSize += file.size;

    if (validation.isValid) {
      result.validFiles.push(file);
    } else {
      result.invalidFiles.push({ file, validation });
      result.isValid = false;
    }

    // Collect errors and warnings
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
  });

  // Validate total size
  if (result.totalSize > maxTotalSize) {
    result.errors.push(`Total file size too large: ${(result.totalSize / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${maxTotalSize / 1024 / 1024}MB`);
    result.isValid = false;
  }

  // Check for duplicate files
  const fileHashes = new Map<string, File[]>();
  files.forEach((file) => {
    const hash = `${file.name}-${file.size}-${file.lastModified}`;
    if (!fileHashes.has(hash)) {
      fileHashes.set(hash, []);
    }
    fileHashes.get(hash)!.push(file);
  });

  fileHashes.forEach((duplicates, hash) => {
    if (duplicates.length > 1) {
      result.warnings.push(`Duplicate file detected: ${duplicates[0].name} (${duplicates.length} copies)`);
    }
  });

  return result;
}

/**
 * Checks if an image URL is accessible (server-side only)
 */
export async function checkImageAccessibility(imageUrl: string): Promise<ImageAccessibilityResult> {
  try {
    const response = await fetch(imageUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    return {
      isAccessible: response.ok,
      statusCode: response.status,
      contentType: response.headers.get('content-type') || undefined,
      contentLength: parseInt(response.headers.get('content-length') || '0', 10) || undefined,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    return {
      isAccessible: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch check image accessibility with concurrency control
 */
export async function checkMultipleImageAccessibility(
  imageUrls: string[],
  maxConcurrent: number = 5
): Promise<{
  accessible: string[];
  inaccessible: { url: string; error: string }[];
  results: Map<string, ImageAccessibilityResult>;
}> {
  const results = new Map<string, ImageAccessibilityResult>();
  const accessible: string[] = [];
  const inaccessible: { url: string; error: string }[] = [];

  // Process URLs in batches to avoid overwhelming the server
  for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
    const batch = imageUrls.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (url) => {
      const result = await checkImageAccessibility(url);
      results.set(url, result);
      
      if (result.isAccessible) {
        accessible.push(url);
      } else {
        inaccessible.push({
          url,
          error: result.error || 'Unknown error'
        });
      }
    });

    await Promise.all(batchPromises);
  }

  return { accessible, inaccessible, results };
}

/**
 * Validates image dimensions (requires browser environment)
 */
export function validateImageDimensions(
  file: File,
  minWidth: number = 256,
  minHeight: number = 256,
  maxWidth: number = 4096,
  maxHeight: number = 4096
): Promise<{
  isValid: boolean;
  width?: number;
  height?: number;
  errors: string[];
  warnings: string[];
}> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      const result = {
        isValid: true,
        width: img.width,
        height: img.height,
        errors: [] as string[],
        warnings: [] as string[]
      };

      // Validate dimensions
      if (img.width < minWidth || img.height < minHeight) {
        result.errors.push(`Image too small: ${img.width}x${img.height}. Minimum required: ${minWidth}x${minHeight}`);
        result.isValid = false;
      }

      if (img.width > maxWidth || img.height > maxHeight) {
        result.errors.push(`Image too large: ${img.width}x${img.height}. Maximum allowed: ${maxWidth}x${maxHeight}`);
        result.isValid = false;
      }

      // Check aspect ratio
      const aspectRatio = img.width / img.height;
      if (aspectRatio < 0.5 || aspectRatio > 2.0) {
        result.warnings.push(`Unusual aspect ratio: ${aspectRatio.toFixed(2)}. Consider using images closer to square format.`);
      }

      // Warn about very high resolution
      const megapixels = (img.width * img.height) / 1000000;
      if (megapixels > 16) {
        result.warnings.push(`Very high resolution: ${megapixels.toFixed(1)}MP. Consider resizing for faster processing.`);
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        isValid: false,
        errors: ['Failed to load image. File may be corrupted or not a valid image.'],
        warnings: []
      });
    };

    img.src = url;
  });
}