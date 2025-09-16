# Design Document

## Overview

The image upload and training pipeline is currently failing with a 400 error when attempting to start training on Replicate. Based on the codebase analysis, the issue appears to be in the training API endpoint where images are being processed and sent to Replicate's fast-flux-trainer model. The system successfully uploads images to Vercel Blob but fails during the Replicate training initiation phase.

Key issues identified:
1. **Input Format Mismatch**: The Replicate API expects specific input formats that may not match what we're sending
2. **ZIP File Processing**: The current implementation creates a ZIP file of images, but this may not be the correct format for the fast-flux-trainer model
3. **Missing Error Context**: Limited error logging makes it difficult to diagnose the exact failure point
4. **API Version Mismatch**: The training endpoint may be using an outdated or incorrect model version

## Architecture

The current architecture follows this flow:
```
User Upload → Vercel Blob → Image Analysis → Training Request → Replicate API → Webhook Response
```

The improved architecture will add comprehensive error handling and validation at each step:
```
User Upload → Validation → Vercel Blob → Analysis → Format Validation → Training Request → Enhanced Error Handling → Replicate API → Status Tracking → Webhook Response
```

## Components and Interfaces

### 1. Enhanced Upload API (`/api/upload/route.ts`)
- **Current State**: Basic file upload with minimal error handling
- **Improvements Needed**:
  - Add comprehensive request validation
  - Implement detailed error logging with request/response data
  - Add file format and size validation
  - Include upload progress tracking

### 2. Training API (`/api/replicate/train/route.ts`)
- **Current Issues**:
  - ZIP file creation may not be compatible with fast-flux-trainer
  - Limited error context from Replicate API failures
  - Hardcoded model version that may be outdated
- **Improvements Needed**:
  - Research correct input format for fast-flux-trainer model
  - Add comprehensive error logging for each step
  - Implement input validation before sending to Replicate
  - Add retry logic for transient failures

### 3. Client-Side Training Component (`TrainModelZone.tsx`)
- **Current Issues**:
  - Generic error messages don't help users understand the problem
  - No detailed progress feedback during training initiation
- **Improvements Needed**:
  - Add detailed progress indicators
  - Implement specific error message handling
  - Add client-side validation before submission

### 4. New Diagnostic and Testing Components
- **API Health Check Endpoint**: Validate all external API connections
- **Training Input Validator**: Verify request format before sending to Replicate
- **Integration Test Suite**: End-to-end testing of the upload-to-training pipeline

## Data Models

### Enhanced Error Response Model
```typescript
interface DetailedErrorResponse {
  error: string;
  message: string;
  step: 'upload' | 'analysis' | 'zip_creation' | 'model_creation' | 'training_start';
  details: {
    requestData?: any;
    responseData?: any;
    timestamp: string;
    userId?: string;
  };
  suggestions?: string[];
}
```

### Training Request Validation Model
```typescript
interface ValidatedTrainingRequest {
  imageUrls: string[];
  modelName: string;
  packSlug: string;
  trainingConfig: {
    trigger_word: string;
    lora_type: 'style' | 'subject';
    training_steps: number;
    subject_type: string;
  };
  validation: {
    imageCount: number;
    totalSize: number;
    formatCheck: boolean;
    accessibilityCheck: boolean;
  };
}
```

## Error Handling

### 1. Upload Phase Error Handling
- **File Validation Errors**: Check file format, size, and accessibility
- **Vercel Blob Errors**: Capture and log specific blob storage failures
- **Network Errors**: Handle timeout and connectivity issues

### 2. Training Phase Error Handling
- **Input Format Errors**: Validate data format before sending to Replicate
- **API Authentication Errors**: Verify token validity and permissions
- **Model Creation Errors**: Handle model destination creation failures
- **Training Initiation Errors**: Capture detailed Replicate API error responses

### 3. User-Facing Error Messages
- **Upload Failures**: "Image upload failed. Please check your internet connection and try again."
- **Format Issues**: "One or more images are in an unsupported format. Please use JPG, PNG, or WebP files."
- **Training Failures**: "Training could not be started. Our team has been notified and will investigate."

## Testing Strategy

### 1. Unit Tests
- **Upload API Tests**: Test file validation, error handling, and Vercel Blob integration
- **Training API Tests**: Test input validation, ZIP creation, and Replicate API calls
- **Component Tests**: Test user interactions and error state handling

### 2. Integration Tests
- **End-to-End Pipeline Tests**: Test complete upload-to-training workflow
- **API Health Tests**: Verify external API connectivity and authentication
- **Error Scenario Tests**: Test various failure modes and error handling

### 3. Manual Testing Procedures
- **Upload Testing**: Test with various file formats, sizes, and quantities
- **Training Testing**: Test with different model configurations and pack types
- **Error Recovery Testing**: Test user experience during various error conditions

### 4. Diagnostic Tools
- **API Health Dashboard**: Real-time status of external API connections
- **Training Request Inspector**: Tool to validate training requests before submission
- **Error Log Analyzer**: Centralized error tracking and analysis

## Implementation Phases

### Phase 1: Enhanced Error Logging and Diagnostics
- Add comprehensive logging to existing endpoints
- Create API health check endpoint
- Implement detailed error response format

### Phase 2: Input Validation and Format Correction
- Research and implement correct Replicate API input format
- Add comprehensive input validation
- Fix ZIP file creation or replace with correct format

### Phase 3: User Experience Improvements
- Add detailed progress indicators
- Implement specific error messages
- Add client-side validation

### Phase 4: Testing and Monitoring
- Implement comprehensive test suite
- Add monitoring and alerting
- Create diagnostic tools

## Security Considerations

- **API Token Security**: Ensure Replicate and Vercel Blob tokens are properly secured
- **Input Validation**: Prevent malicious file uploads and injection attacks
- **Error Information Disclosure**: Avoid exposing sensitive information in error messages
- **Rate Limiting**: Implement appropriate rate limiting for API endpoints

## Performance Considerations

- **File Upload Optimization**: Implement chunked uploads for large files
- **ZIP Creation Optimization**: Optimize memory usage during ZIP file creation
- **API Response Caching**: Cache API health checks and model information
- **Error Recovery**: Implement exponential backoff for retry logic