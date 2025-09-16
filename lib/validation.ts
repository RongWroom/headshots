import { z } from 'zod';
import { trainRequestSchema } from '@/types/training';

// Extended training request validation schema with additional constraints
export const trainingRequestValidationSchema = trainRequestSchema.extend({
  imageUrls: z.array(z.string().url('Invalid image URL format'))
    .min(1, 'At least one image is required')
    .max(50, 'Maximum 50 images allowed')
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    imageCount: number;
    totalEstimatedSize?: number;
    formatChecks: ImageFormatCheck[];
    accessibilityChecks: ImageAccessibilityCheck[];
  };
}

export interface ImageFormatCheck {
  url: string;
  isValid: boolean;
  format?: string;
  error?: string;
}

export interface ImageAccessibilityCheck {
  url: string;
  isAccessible: boolean;
  statusCode?: number;
  contentType?: string;
  size?: number;
  error?: string;
}

/**
 * Comprehensive validation utility for training inputs
 */
export class TrainingInputValidator {
  
  /**
   * Validate training request data structure
   */
  static validateRequestSchema(data: any): { isValid: boolean; errors: string[]; data?: any } {
    try {
      const validatedData = trainingRequestValidationSchema.parse(data);
      return {
        isValid: true,
        errors: [],
        data: validatedData
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return {
        isValid: false,
        errors: ['Unknown validation error']
      };
    }
  }

  /**
   * Validate image formats by checking file extensions and MIME types
   */
  static validateImageFormats(imageUrls: string[]): ImageFormatCheck[] {
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
    return imageUrls.map(url => {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        const extension = pathname.substring(pathname.lastIndexOf('.'));
        
        const isValidExtension = supportedFormats.includes(extension);
        
        return {
          url,
          isValid: isValidExtension,
          format: extension,
          error: isValidExtension ? undefined : `Unsupported format: ${extension}. Supported formats: ${supportedFormats.join(', ')}`
        };
      } catch (error) {
        return {
          url,
          isValid: false,
          error: 'Invalid URL format'
        };
      }
    });
  }

  /**
   * Check if images are accessible and get their metadata
   */
  static async validateImageAccessibility(imageUrls: string[]): Promise<ImageAccessibilityCheck[]> {
    const checks = await Promise.all(
      imageUrls.map(async (url): Promise<ImageAccessibilityCheck> => {
        try {
          const response = await fetch(url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          const contentType = response.headers.get('content-type');
          const contentLength = response.headers.get('content-length');
          
          return {
            url,
            isAccessible: response.ok,
            statusCode: response.status,
            contentType: contentType || undefined,
            size: contentLength ? parseInt(contentLength, 10) : undefined,
            error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
          };
        } catch (error) {
          return {
            url,
            isAccessible: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    return checks;
  }

  /**
   * Comprehensive validation of training inputs
   */
  static async validateTrainingInputs(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Schema validation
    const schemaValidation = this.validateRequestSchema(data);
    if (!schemaValidation.isValid) {
      errors.push(...schemaValidation.errors);
      return {
        isValid: false,
        errors,
        warnings,
        details: {
          imageCount: 0,
          formatChecks: [],
          accessibilityChecks: []
        }
      };
    }
    
    const validatedData = schemaValidation.data!;
    const imageUrls = validatedData.imageUrls;
    
    // Format validation
    const formatChecks = this.validateImageFormats(imageUrls);
    const invalidFormats = formatChecks.filter(check => !check.isValid);
    if (invalidFormats.length > 0) {
      errors.push(...invalidFormats.map(check => check.error!));
    }
    
    // Accessibility validation
    const accessibilityChecks = await this.validateImageAccessibility(imageUrls);
    const inaccessibleImages = accessibilityChecks.filter(check => !check.isAccessible);
    if (inaccessibleImages.length > 0) {
      errors.push(...inaccessibleImages.map(check => `Image not accessible: ${check.url} - ${check.error}`));
    }
    
    // Size warnings
    const totalSize = accessibilityChecks
      .filter(check => check.size)
      .reduce((sum, check) => sum + (check.size || 0), 0);
    
    if (totalSize > 100 * 1024 * 1024) { // 100MB
      warnings.push(`Total image size (${Math.round(totalSize / 1024 / 1024)}MB) is quite large and may slow down processing`);
    }
    
    // Image count warnings
    if (imageUrls.length < 5) {
      warnings.push('Less than 5 images may result in poor training quality');
    }
    
    if (imageUrls.length > 20) {
      warnings.push('More than 20 images may increase training time significantly');
    }
    
    // Model name validation
    if (validatedData.modelName.length < 3) {
      warnings.push('Model name is very short, consider using a more descriptive name');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {
        imageCount: imageUrls.length,
        totalEstimatedSize: totalSize,
        formatChecks,
        accessibilityChecks
      }
    };
  }

  /**
   * Validate Replicate API configuration
   */
  static validateReplicateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!process.env.REPLICATE_API_TOKEN) {
      errors.push('REPLICATE_API_TOKEN environment variable is not set');
    }
    
    if (!process.env.REPLICATE_USERNAME) {
      warnings.push('REPLICATE_USERNAME environment variable is not set - model creation may fail');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate Vercel Blob configuration
   */
  static validateBlobConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      errors.push('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}