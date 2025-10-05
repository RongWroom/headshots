# Implementation Plan

## Overview

This implementation plan breaks down the ComfyUI headshot generation system into discrete, testable tasks. Each task builds on previous work and can be validated independently.

---

## Phase 1: Database and Infrastructure Setup

- [x] 1. Set up database schema
  - [x] 1.1 Create generation_jobs table in Supabase
    - Add columns: id, user_id, status, progress, progress_message, reference_images, num_outputs, style_intensity, output_images, detected_features, generation_time_seconds, estimated_cost_usd, error_message, created_at, started_at, completed_at, updated_at
    - Add indexes: idx_user_status (user_id, status), idx_created_at (created_at DESC)
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Set up Row Level Security policies
    - Users can only read their own jobs
    - Users can only create jobs for themselves
    - Webhook endpoint can update any job (service role)
    - _Requirements: 5.1_
  - [x] 1.3 Create database migration file
    - Document schema in supabase/migrations/
    - Test migration on local Supabase instance
    - _Requirements: 5.1_

- [x] 2. Configure RunPod serverless endpoint
  - [x] 2.1 Create RunPod account and set up billing
    - Sign up at runpod.io
    - Add payment method
    - Set spending limits
    - _Requirements: 3.1_
  - [x] 2.2 Build custom ComfyUI Docker image
    - Base image: runpod/comfyui:latest
    - Install required custom nodes: RMBG, CLIP Interrogator, Seedream
    - Add DanDan LoRA to /workspace/models/loras/
    - Create Dockerfile and build script
    - _Requirements: 3.2, 3.3_
  - [x] 2.3 Create ComfyUI workflow JSON
    - Design workflow: Load Images → RMBG → CLIP Interrogator → Prompt Builder → Seedream 4.0 → (Optional) LoRA Refinement → Save Images
    - Export workflow as JSON
    - Add webhook progress updates at each stage
    - Test workflow locally in ComfyUI
    - _Requirements: 3.2, 4.1, 4.2, 4.3_
  - [ ] 2.4 Deploy serverless endpoint to RunPod
    - Upload Docker image to RunPod
    - Configure endpoint: GPU type (A40), min_workers (0), max_workers (3), idle_timeout (300s)
    - Set environment variables: WEBHOOK_SECRET, DANDAN_LORA_URL
    - Test endpoint with sample request
    - _Requirements: 3.1, 3.4, 3.5_

---

## Phase 2: API Development

- [ ] 3. Create headshot generation API endpoint
  - [ ] 3.1 Implement POST /api/headshots/generate
    - Validate user authentication (Supabase session)
    - Validate request body: referenceImages (5-10 URLs), numOutputs (default 4), styleIntensity (0-1)
    - Create job record in generation_jobs table (status: "queued")
    - Call RunPod endpoint asynchronously with job details
    - Return response: { success, jobId, status, estimatedTime, pollUrl }
    - _Requirements: 1.1, 1.4, 5.1, 5.2_
  - [ ] 3.2 Add error handling for invalid inputs
    - Return 400 if photo count is not 5-10
    - Return 400 if URLs are not from Vercel Blob
    - Return 401 if user is not authenticated
    - Return 500 if database or RunPod call fails
    - _Requirements: 1.4, 7.1_
  - [ ] 3.3 Add request logging and monitoring
    - Log all generation requests with user_id, timestamp, parameters
    - Track success/failure rates
    - _Requirements: 6.1_

- [ ] 4. Create job status polling endpoint
  - [ ] 4.1 Implement GET /api/headshots/status/:jobId
    - Validate user authentication
    - Verify user owns the job (user_id matches)
    - Query generation_jobs table for job status
    - Return: { jobId, status, progress, message, images, error, createdAt, completedAt }
    - _Requirements: 5.3, 5.6_
  - [ ] 4.2 Add caching headers for completed jobs
    - Cache completed jobs for 1 hour
    - No caching for in-progress jobs
    - _Requirements: 5.6_

- [ ] 5. Create webhook endpoint for RunPod callbacks
  - [ ] 5.1 Implement POST /api/headshots/webhook
    - Validate webhook signature using HMAC
    - Parse webhook payload: { jobId, status, progress, message, images, error }
    - Update generation_jobs table with new status/progress
    - If images provided (base64), upload to Vercel Blob Storage
    - Update job with output_images URLs
    - _Requirements: 5.2, 5.4, 5.5_
  - [ ] 5.2 Handle webhook retries and idempotency
    - Store webhook payloads for debugging
    - Handle duplicate webhooks gracefully
    - Implement exponential backoff for failed webhooks
    - _Requirements: 5.5, 7.2_
  - [ ] 5.3 Add webhook security
    - Validate HMAC signature
    - Rate limit webhook endpoint
    - Only accept from RunPod IPs (optional)
    - _Requirements: 5.5_

---

## Phase 3: ComfyUI Workflow Implementation

- [ ] 6. Build ComfyUI workflow nodes
  - [ ] 6.1 Configure Load Images node
    - Accept array of image URLs (5-10)
    - Download images from Vercel Blob
    - Validate image formats (JPEG, PNG)
    - Output: Image tensors
    - _Requirements: 1.1, 1.3_
  - [ ] 6.2 Configure RMBG background removal node
    - Use RMBG-v1.4 or BiRefNet model
    - Process each image to remove background
    - Output: Transparent PNG images
    - Send webhook: 20% progress, "Removing backgrounds..."
    - _Requirements: 1.2, 1.3_
  - [ ] 6.3 Configure CLIP Interrogator node
    - Analyze facial features from background-removed images
    - Detect: gender, skin tone, hair color, hair style, eye color, age range
    - Output: Feature dictionary
    - Send webhook: 40% progress, "Analyzing facial features..."
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 6.4 Build custom Prompt Builder node
    - Combine detected features with DanDan style template
    - Template: "A professional headshot portrait of a {gender} with {skin_tone} skin, {hair_color} hair, in dandan style. Cinematic lighting, shallow depth of field, Canon R6, Canon 70-200mm F2.8, muted tones, soft directional lighting, professional expression, looking directly at camera, photorealistic skin textures"
    - Handle multiple feature variations (use most common)
    - Output: Final prompt string
    - _Requirements: 2.3, 2.4, 2.5_
  - [ ] 6.5 Configure Seedream 4.0 node
    - Model: bytedance/seedream-4
    - Input: All background-removed images + generated prompt
    - Parameters: size="2K", width=1728, height=2304, aspect_ratio="3:4", max_images=4, prompt_strength=0.85
    - Output: 4 high-resolution headshots
    - Send webhook: 50% progress, "Generating professional headshots..."
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ] 6.6 Configure optional LoRA refinement node
    - Only execute if styleIntensity > 0.5
    - Apply DanDan-Actor LoRA via img2img
    - Low strength (0.3-0.4) to preserve face
    - Enhance photography aesthetic
    - Send webhook: 80% progress, "Refining photography style..."
    - _Requirements: 4.6_
  - [ ] 6.7 Configure Save Images node
    - Convert images to base64 strings
    - Send webhook with images: 100% progress, "Complete!"
    - Return images in response payload
    - _Requirements: 4.7, 5.4_

- [ ] 7. Test ComfyUI workflow end-to-end
  - [ ] 7.1 Test with sample photos locally
    - Use 5-10 test photos of different people
    - Verify background removal works
    - Verify face analysis is accurate
    - Verify Seedream generates quality images
    - _Requirements: 8.1, 8.2_
  - [ ] 7.2 Test webhook progress updates
    - Verify webhooks are sent at each stage
    - Verify progress percentages are accurate
    - Verify messages are descriptive
    - _Requirements: 5.2, 5.3_
  - [ ] 7.3 Test error scenarios
    - Test with invalid image URLs
    - Test with images without faces
    - Test with NSFW content
    - Verify graceful error handling
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

---

## Phase 4: Frontend Development

- [ ] 8. Create HeadshotGenerationZone component
  - [ ] 8.1 Build photo upload interface
    - File input accepting 5-10 images
    - Drag-and-drop support
    - Image preview thumbnails
    - Validation: file count, file size (max 10MB), file type (JPEG/PNG)
    - Upload to Vercel Blob Storage
    - Display upload progress
    - _Requirements: 1.1, 1.4_
  - [ ] 8.2 Build generation trigger UI
    - "Generate Headshots" button
    - Optional: Style intensity slider (0-1)
    - Disable button while uploading or generating
    - Call /api/headshots/generate with Blob URLs
    - _Requirements: 1.1_
  - [ ] 8.3 Build progress display
    - Progress bar (0-100%)
    - Status message ("Removing backgrounds...", etc)
    - Estimated time remaining
    - Poll /api/headshots/status/:jobId every 2 seconds
    - _Requirements: 5.3, 5.6_
  - [ ] 8.4 Build results display
    - Grid of 4 generated headshots
    - Download button for each image
    - "Generate More" button to start new job
    - Share/copy image URL functionality
    - _Requirements: 5.4_
  - [ ] 8.5 Add error handling and retry
    - Display error messages clearly
    - "Try Again" button on failure
    - Handle timeout scenarios (>5 minutes)
    - _Requirements: 5.5, 5.7, 7.1_

---

## Phase 5: Testing and Quality Assurance

- [ ] 9. Conduct comprehensive testing
  - [ ] 9.1 Test with diverse photo sets
    - Test with 10 different people (various genders, skin tones, ages)
    - Verify face consistency in generated images
    - Manual review: Does face match input? (Target: 90%+ recognizable)
    - _Requirements: 8.1, 8.3_
  - [ ] 9.2 Test style accuracy
    - Compare generated images to DanDan portfolio
    - Manual review: Does style match? (Target: 95%+ match)
    - Verify: muted backgrounds, soft lighting, cinematic mood, shallow depth of field
    - _Requirements: 8.4_
  - [ ] 9.3 Conduct load testing
    - Simulate 10 concurrent users generating headshots
    - Verify no quality degradation
    - Verify reasonable queue times (<2 minutes wait)
    - Monitor RunPod scaling behavior
    - _Requirements: 8.5_
  - [ ] 9.4 Test edge cases and error scenarios
    - Upload photos without clear faces
    - Upload non-face images
    - Upload corrupted images
    - Test with slow internet connection
    - Test RunPod endpoint unavailability
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [ ] 9.5 Conduct cost analysis
    - Track generation costs over 100 test jobs
    - Calculate average cost per generation
    - Verify cost is <$0.30 per 4-image batch
    - Identify optimization opportunities
    - _Requirements: 6.1, 6.2, 8.4_

---

## Phase 6: Monitoring and Optimization

- [ ] 10. Set up monitoring and logging
  - [ ] 10.1 Add application logging
    - Log all API requests with timestamps
    - Log generation start/complete events
    - Log errors with stack traces
    - Use structured logging (JSON format)
    - _Requirements: 6.1_
  - [ ] 10.2 Set up cost tracking
    - Track daily/monthly generation counts
    - Track GPU time used per generation
    - Calculate estimated costs
    - Store in database for reporting
    - _Requirements: 6.1, 6.2_
  - [ ] 10.3 Set up alerts
    - Alert when error rate exceeds 5%
    - Alert when daily costs exceed threshold
    - Alert when RunPod endpoint is down
    - Alert when average generation time exceeds 3 minutes
    - _Requirements: 6.3_
  - [ ] 10.4 Create admin dashboard
    - View recent generations
    - View success/failure rates
    - View cost metrics
    - View average generation times
    - _Requirements: 6.1, 6.2_

- [ ] 11. Optimize performance and costs
  - [ ] 11.1 Optimize image processing
    - Resize uploaded images to max 2048px before sending to RunPod
    - Use WebP format for storage (smaller file size)
    - Implement lazy loading for result images
    - _Requirements: 6.4_
  - [ ] 11.2 Optimize RunPod scaling
    - Monitor queue length and adjust max_workers
    - Tune idle_timeout for cost vs responsiveness
    - Consider reserved instances for peak hours
    - _Requirements: 6.4_
  - [ ] 11.3 Optimize database queries
    - Add database indexes if missing
    - Paginate job history queries
    - Cache frequently accessed data
    - _Requirements: 6.4_
  - [ ] 11.4 Implement caching strategies
    - Cache CLIP Interrogator results for similar faces
    - Cache background-removed images
    - Cache generated prompts
    - _Requirements: 6.4_

---

## Phase 7: Launch Preparation

- [ ] 12. Prepare for production launch
  - [ ] 12.1 Security audit
    - Review authentication flows
    - Review input validation
    - Review webhook security
    - Test for common vulnerabilities (SQL injection, XSS, etc)
    - _Requirements: 7.7_
  - [ ] 12.2 Performance testing
    - Load test with 50 concurrent users
    - Verify system stability under load
    - Identify bottlenecks
    - _Requirements: 8.5_
  - [ ] 12.3 Documentation
    - Write API documentation
    - Write user guide for headshot generation
    - Document ComfyUI workflow for maintenance
    - Document RunPod deployment process
    - _Requirements: All_
  - [ ] 12.4 Deploy to production
    - Deploy database migrations
    - Deploy API routes
    - Deploy frontend components
    - Configure production environment variables
    - Test end-to-end in production
    - _Requirements: All_
  - [ ] 12.5 Monitor initial usage
    - Watch logs for errors
    - Monitor generation success rates
    - Gather user feedback
    - Track costs
    - _Requirements: 6.1, 6.2, 6.3_

---

## Phase 8: Post-Launch Iteration

- [ ] 13. Gather feedback and iterate
  - [ ] 13.1 Collect user feedback
    - Add feedback form in UI
    - Track user satisfaction scores
    - Identify common issues or requests
    - _Requirements: 8.1_
  - [ ] 13.2 Analyze quality metrics
    - Review face consistency scores
    - Review style accuracy scores
    - Identify patterns in failures
    - _Requirements: 8.2, 8.3, 8.4_
  - [ ] 13.3 Implement improvements
    - Fix identified bugs
    - Optimize workflow based on data
    - Add requested features
    - _Requirements: All_
  - [ ] 13.4 Plan future enhancements
    - Multiple style options
    - Advanced customization (background, clothing, expression)
    - Batch processing for teams
    - Video headshots
    - _Requirements: Future enhancements_
