# Requirements Document

## Introduction

This feature implements a professional headshot generation service using Replicate's Seedream API. The system allows users to upload casual photos via the Next.js frontend, which are stored in Vercel Blob and processed through Replicate's Seedream model to generate professional headshots with consistent backgrounds and styling.

This is a simpler alternative to the ComfyUI-based approach, leveraging Replicate's managed infrastructure for easier maintenance and deployment. The focus is on achieving consistent professional backgrounds across all users while maintaining facial accuracy.

## Requirements

### Requirement 1: Image Upload and Storage

**User Story:** As a user, I want to upload my casual photos through the web interface so that they can be processed into professional headshots.

#### Acceptance Criteria

1. WHEN a user uploads 1-5 photos THEN the system SHALL accept common image formats (JPEG, PNG, WebP)
2. WHEN photos are uploaded THEN the system SHALL validate file size (max 10MB per image)
3. WHEN validation passes THEN the system SHALL upload images to Vercel Blob storage
4. WHEN images are stored THEN the system SHALL save metadata (user_id, blob URLs, upload timestamp) to Supabase
5. WHEN upload completes THEN the system SHALL return blob URLs to the frontend
6. IF upload fails THEN the system SHALL provide clear error messages and cleanup any partial uploads

### Requirement 2: Replicate Seedream API Integration

**User Story:** As a developer, I want to integrate Replicate's Seedream API so that I can generate professional headshots with consistent styling.

#### Acceptance Criteria

1. WHEN calling Seedream THEN the system SHALL use the model `bytedance/seedream` via Replicate API
2. WHEN preparing the request THEN the system SHALL pass reference images as URLs from Vercel Blob
3. WHEN configuring generation THEN the system SHALL support parameters: prompt, negative_prompt, num_outputs (default 10), seed (for consistency)
4. WHEN setting prompts THEN the system SHALL use consistent professional photography prompts: "professional corporate headshot, neutral background, studio lighting, high quality, sharp focus"
5. WHEN using seeds THEN the system SHALL use fixed seeds per style to ensure consistent backgrounds across different users
6. WHEN making API calls THEN the system SHALL include webhook URL for async result delivery
7. WHEN API calls fail THEN the system SHALL implement retry logic with exponential backoff

### Requirement 3: Consistent Background Styling

**User Story:** As a business owner, I want all users who select the same style to get the same professional background so that the service provides predictable, branded results.

#### Acceptance Criteria

1. WHEN defining styles THEN the system SHALL maintain a style catalog with: style_name, prompt, negative_prompt, seed
2. WHEN a user selects "Corporate Blue" THEN all users SHALL receive headshots with the same blue gradient background
3. WHEN a user selects "Warm Studio" THEN all users SHALL receive headshots with the same warm-toned studio background
4. WHEN generating images THEN the system SHALL use the same seed value for each style across all users
5. WHEN styles are updated THEN the system SHALL version them to maintain consistency for existing users
6. WHEN testing consistency THEN headshots from different users with the same style SHALL have visually identical backgrounds

### Requirement 4: Async Job Processing and Webhooks

**User Story:** As a user, I want to be notified when my headshots are ready so that I don't have to wait on the page.

#### Acceptance Criteria

1. WHEN a generation is requested THEN the system SHALL create a job record with status "pending"
2. WHEN Replicate accepts the job THEN the system SHALL store the prediction_id and update status to "processing"
3. WHEN Replicate completes generation THEN it SHALL call the webhook endpoint with results
4. WHEN the webhook receives results THEN the system SHALL download images from Replicate URLs
5. WHEN images are downloaded THEN the system SHALL upload them to Vercel Blob for permanent storage
6. WHEN storage completes THEN the system SHALL update the job with output URLs and status "completed"
7. WHEN webhook processing fails THEN the system SHALL implement fallback polling mechanism
8. WHEN generation fails THEN the system SHALL update status to "failed" with error details

### Requirement 5: Job Status Polling API

**User Story:** As a frontend developer, I want a polling endpoint so that I can show real-time progress to users.

#### Acceptance Criteria

1. WHEN the frontend polls `/api/seedream/status/{jobId}` THEN it SHALL return current job status
2. WHEN status is "pending" or "processing" THEN the response SHALL include estimated time remaining
3. WHEN status is "completed" THEN the response SHALL include array of output image URLs
4. WHEN status is "failed" THEN the response SHALL include error message and suggested actions
5. WHEN polling THEN the endpoint SHALL be rate-limited to prevent abuse (max 1 request per 2 seconds per job)
6. WHEN a job is older than 24 hours THEN the system SHALL automatically mark it as expired

### Requirement 6: Cost Tracking and Optimization

**User Story:** As a business owner, I want to track generation costs so that I can optimize pricing and profitability.

#### Acceptance Criteria

1. WHEN a generation completes THEN the system SHALL log: Replicate cost, generation time, number of outputs
2. WHEN tracking costs THEN the system SHALL store per-job cost in the database
3. WHEN monitoring usage THEN the system SHALL provide daily/monthly cost summaries
4. WHEN optimizing THEN the system SHALL default to 10 outputs per generation (Seedream's optimal batch size)
5. WHEN calculating pricing THEN the system SHALL ensure user pricing covers Replicate costs plus margin

### Requirement 7: Error Handling and Retry Logic

**User Story:** As a user, I want the system to handle errors gracefully so that temporary issues don't cause permanent failures.

#### Acceptance Criteria

1. WHEN Replicate API returns 429 (rate limit) THEN the system SHALL retry with exponential backoff
2. WHEN Replicate API returns 500 (server error) THEN the system SHALL retry up to 3 times
3. WHEN webhook delivery fails THEN the system SHALL fall back to polling Replicate API
4. WHEN image download fails THEN the system SHALL retry up to 3 times before failing
5. WHEN Vercel Blob upload fails THEN the system SHALL retry with different blob names
6. WHEN all retries fail THEN the system SHALL mark job as failed with detailed error message
7. WHEN errors occur THEN the system SHALL log to monitoring service for debugging

### Requirement 8: Security and Authentication

**User Story:** As a security-conscious developer, I want proper authentication and authorization so that users can only access their own generations.

#### Acceptance Criteria

1. WHEN calling generation API THEN the system SHALL verify user authentication via Supabase
2. WHEN creating jobs THEN the system SHALL associate them with the authenticated user_id
3. WHEN polling status THEN the system SHALL verify the user owns the requested job
4. WHEN receiving webhooks THEN the system SHALL verify webhook signature using REPLICATE_WEBHOOK_SECRET
5. WHEN storing images THEN the system SHALL use user-specific blob paths to prevent collisions
6. WHEN accessing images THEN the system SHALL ensure Vercel Blob URLs are publicly accessible but unguessable

### Requirement 9: Frontend Integration and Customization

**User Story:** As a user, I want a simple interface to upload photos, customize my preferences, and receive professional headshots.

#### Acceptance Criteria

1. WHEN on the upload page THEN the user SHALL see a drag-and-drop zone for 1-5 photos
2. WHEN photos are selected THEN the system SHALL show upload progress
3. WHEN upload completes THEN the user SHALL see customization checkboxes:
   - Remove jewelry (earrings, necklaces, rings)
   - Remove glasses
   - Remove piercings (nose rings, lip rings, etc.)
   - Clean background (remove distracting elements)
4. WHEN customizations are selected THEN they SHALL be added to the negative prompt
5. WHEN customizations are complete THEN the user SHALL see style selection options (Corporate Blue, Warm Studio, etc.)
6. WHEN a style is selected THEN the user SHALL see a preview of the background style
7. WHEN generation starts THEN the user SHALL see a progress indicator with estimated time
8. WHEN generation completes THEN the user SHALL see a gallery of 10 professional headshots
9. WHEN viewing results THEN the user SHALL be able to download individual images or all as a ZIP

### Requirement 10: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive testing to ensure reliability before launch.

#### Acceptance Criteria

1. WHEN testing uploads THEN the system SHALL handle various image formats and sizes correctly
2. WHEN testing generation THEN at least 5 different users' photos SHALL produce consistent backgrounds per style
3. WHEN testing webhooks THEN both success and failure scenarios SHALL be validated
4. WHEN testing polling THEN the frontend SHALL correctly handle all job statuses
5. WHEN load testing THEN the system SHALL handle 20 concurrent generation requests
6. WHEN testing errors THEN all error paths SHALL provide helpful user-facing messages
