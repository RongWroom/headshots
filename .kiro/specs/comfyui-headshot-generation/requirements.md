# Requirements Document

## Introduction

This feature implements a professional AI headshot generation system using ComfyUI on RunPod. The system allows users to upload 5-10 photos of themselves and receive high-quality professional headshots in the photographer's signature DanDan style with accurate facial likeness.

The current Replicate-based approaches (Seedream, dual LoRA, face swap) have proven inconsistent in quality and facial accuracy. ComfyUI provides the control and quality needed for production-grade results, as evidenced by successful professional services like Enhancor.ai.

## Requirements

### Requirement 1: User Photo Upload and Processing

**User Story:** As a user, I want to upload 5-10 photos of myself so that the system can generate professional headshots that look like me.

#### Acceptance Criteria

1. WHEN a user uploads between 5-10 photos THEN the system SHALL accept and store these photos for processing
2. WHEN photos are uploaded THEN the system SHALL automatically remove backgrounds from each photo using RMBG or BiRefNet
3. WHEN backgrounds are removed THEN the system SHALL validate that faces are clearly visible in the processed images
4. IF fewer than 5 or more than 10 photos are uploaded THEN the system SHALL reject the upload with a clear error message
5. WHEN photos are processed THEN the system SHALL store both original and background-removed versions

### Requirement 2: Automated Face Analysis and Prompt Generation

**User Story:** As a system, I want to automatically analyze uploaded photos to generate accurate prompts so that generated headshots match the user's physical characteristics.

#### Acceptance Criteria

1. WHEN background-removed photos are ready THEN the system SHALL analyze facial features using CLIP Interrogator or similar
2. WHEN analyzing faces THEN the system SHALL detect and record: gender, skin tone, hair color, hair style, eye color, facial hair, age range
3. WHEN analysis is complete THEN the system SHALL generate a detailed prompt incorporating detected features and DanDan style keywords
4. WHEN generating prompts THEN the system SHALL include professional photography terms: "cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, muted tones, soft directional lighting"
5. WHEN multiple photos show different features THEN the system SHALL use the most consistent/common features across images

### Requirement 3: ComfyUI Workflow Deployment on RunPod

**User Story:** As a developer, I want a reliable ComfyUI workflow deployed on RunPod so that headshot generation is consistent and maintainable.

#### Acceptance Criteria

1. WHEN deploying to RunPod THEN the system SHALL use a serverless endpoint with automatic scaling
2. WHEN the workflow is deployed THEN it SHALL include all required nodes: Load Images, RMBG, CLIP Interrogator, Seedream 4.0, (Optional) LoRA Loader for style refinement, Save Images
3. WHEN the workflow loads THEN it SHALL automatically load the DanDan-Actor LoRA from storage
4. WHEN the endpoint is called THEN it SHALL accept: user photos (5-10), number of outputs (default 4), style parameters
5. WHEN the endpoint is idle for 5+ minutes THEN it SHALL scale down to save costs
6. WHEN a new request arrives THEN the endpoint SHALL scale up within 30-60 seconds

### Requirement 4: High-Quality Headshot Generation with Face Consistency

**User Story:** As a user, I want generated headshots to accurately show my face in professional photography style so that I can use them for professional purposes.

#### Acceptance Criteria

1. WHEN generating headshots THEN the system SHALL use Seedream 4.0 for superior face consistency with multiple reference images
2. WHEN using Seedream THEN the system SHALL pass all background-removed user photos as image_input for optimal face learning
3. WHEN applying style THEN the system SHALL incorporate DanDan photography keywords in the prompt: "dandan style, cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, muted tones, soft directional lighting"
4. WHEN generating images THEN the system SHALL produce 4 variations with different poses/expressions using Seedream's multi-output capability
5. WHEN Seedream generates base images THEN they SHALL be at high resolution (1728x2304 or 2K)
6. IF additional style refinement is needed THEN the system MAY apply DanDan-Actor LoRA via img2img at low strength (0.3-0.5) to enhance photography aesthetic without losing face
7. WHEN comparing generated faces to input photos THEN facial features SHALL be recognizably similar (subjective but critical)
8. WHEN evaluating style THEN generated images SHALL match DanDan photography aesthetic: muted backgrounds, soft directional lighting, cinematic mood, shallow depth of field

### Requirement 5: API Integration and Job Management

**User Story:** As a developer, I want a reliable API to trigger and monitor headshot generation so that the frontend can provide real-time feedback to users.

#### Acceptance Criteria

1. WHEN a generation is requested THEN the system SHALL create a job record in the database with status "queued"
2. WHEN the job starts processing THEN the status SHALL update to "processing" with progress percentage
3. WHEN the ComfyUI workflow progresses THEN the system SHALL update job progress: 10% (started), 30% (background removed), 50% (faces analyzed), 70% (generating), 90% (upscaling), 100% (complete)
4. WHEN generation completes successfully THEN the system SHALL store output images and update status to "completed"
5. WHEN generation fails THEN the system SHALL update status to "failed" with error details
6. WHEN a user polls for status THEN the API SHALL return current progress, status, and images (if complete)
7. WHEN generation takes longer than 5 minutes THEN the system SHALL timeout and mark as failed

### Requirement 6: Cost Management and Monitoring

**User Story:** As a business owner, I want to monitor and control generation costs so that the service remains profitable.

#### Acceptance Criteria

1. WHEN a generation completes THEN the system SHALL log: generation time, GPU time used, estimated cost
2. WHEN monitoring costs THEN the system SHALL track daily/monthly generation counts and costs
3. WHEN costs exceed thresholds THEN the system SHALL send alerts to administrators
4. WHEN the RunPod endpoint is idle THEN it SHALL automatically scale down to minimize costs
5. WHEN evaluating efficiency THEN average generation time SHALL be under 2 minutes per 4-image batch

### Requirement 7: Quality Assurance and Fallbacks

**User Story:** As a user, I want consistent quality results even when the system encounters issues so that I always receive usable headshots.

#### Acceptance Criteria

1. WHEN face detection fails THEN the system SHALL retry with adjusted parameters before failing
2. WHEN background removal produces poor results THEN the system SHALL attempt alternative methods
3. WHEN InstantID/PuLID fails THEN the system SHALL fall back to alternative face consistency methods
4. WHEN generation produces NSFW content THEN the system SHALL filter it out and regenerate
5. WHEN all 4 generated images are low quality THEN the system SHALL automatically retry once
6. WHEN the RunPod endpoint is unavailable THEN the system SHALL queue the job and retry when available

### Requirement 8: Testing and Validation

**User Story:** As a developer, I want comprehensive testing to ensure the system works reliably before launch.

#### Acceptance Criteria

1. WHEN testing the workflow THEN it SHALL be validated with at least 10 different people's photos
2. WHEN evaluating results THEN at least 80% of generations SHALL be deemed "professional quality" by manual review
3. WHEN testing face consistency THEN generated faces SHALL be recognizable as the input person in 90%+ of cases
4. WHEN testing style accuracy THEN generated images SHALL match DanDan aesthetic in 95%+ of cases
5. WHEN load testing THEN the system SHALL handle 10 concurrent generation requests without degradation
