# Implementation Plan

## Important Notes
- **Before creating any new files**: Check if similar files exist in the codebase to avoid duplication
- **After each task**: Run lint checks and fix TypeScript errors before proceeding
- **Validation**: Use `getDiagnostics` tool to check for errors after file modifications

- [x] 1. Set up database schema and migrations
  - Check existing migration files in `supabase/migrations/` directory
  - Create `seedream_uploads` table with RLS policies
  - Create `seedream_jobs` table with RLS policies
  - Add indexes for performance
  - Create database triggers for timestamp management
  - Run lint and type checks after completion
  - _Requirements: 1.4, 4.1, 4.6_

- [x] 2. Create style catalog and configuration
  - Check if `lib/` directory exists and review existing utility files
  - Define style catalog with at least 3 styles (Corporate Blue, Warm Studio, Professional Gray)
  - Set fixed seeds per style for background consistency
  - Create style preview images
  - Export style catalog as TypeScript module
  - Run lint and type checks after completion
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implement Replicate Seedream service wrapper
  - Check existing `lib/replicate.ts` file for reusable code
  - Create `lib/seedream-service.ts` with Replicate SDK integration
  - Implement `createPrediction()` method
  - Implement `getPrediction()` method for polling
  - Implement `cancelPrediction()` method
  - Add retry logic with exponential backoff
  - Add error handling for rate limits and API failures
  - Run lint and type checks after completion
  - _Requirements: 2.1, 2.2, 2.7, 7.1, 7.2_

- [x] 4. Build image upload API endpoint
  - Check existing API routes in `app/api/` directory for patterns
  - Check if `@vercel/blob` is already installed in package.json
  - Create `/api/seedream/upload` route
  - Integrate `@vercel/blob` for file uploads
  - Validate file types (JPEG, PNG, WebP) and sizes (max 10MB)
  - Generate unique blob paths per user
  - Store upload metadata in Supabase
  - Return blob URLs in response
  - Implement cleanup for failed uploads
  - Run lint and type checks after completion
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 5. Build generation API endpoint
  - Review existing generation endpoint at `app/api/headshots/generate/route.ts` for patterns
  - Create `/api/seedream/generate` route
  - Fetch upload metadata from Supabase
  - Fetch style configuration from catalog
  - Build custom negative prompt based on user customizations
  - Call Replicate API with webhook URL
  - Create job record in database
  - Return job ID and polling URL
  - Run lint and type checks after completion
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 9.4_

- [x] 6. Implement webhook handler
  - Check existing webhook handlers in `app/api/` for signature verification patterns
  - Create `/api/seedream/webhook` route
  - Verify webhook signature using `REPLICATE_WEBHOOK_SECRET`
  - Parse Replicate webhook payload
  - Download generated images from Replicate URLs
  - Upload images to Vercel Blob for permanent storage
  - Update job record with output URLs and status
  - Calculate and store generation metrics
  - Handle webhook failures gracefully
  - Run lint and type checks after completion
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 8.4_

- [ ] 7. Build status polling API endpoint
  - Check if similar status endpoints exist in `app/api/headshots/status/` directory
  - Create `/api/seedream/status/[jobId]/route.ts`
  - Verify user owns the job (RLS)
  - Return current job status and progress
  - Implement fallback polling to Replicate if webhook delayed
  - Add rate limiting (max 1 request per 2 seconds per job)
  - Return different responses based on status (pending, processing, completed, failed)
  - Run lint and type checks after completion
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 8. Create TypeScript types and interfaces
  - Check existing types in `types/` directory
  - Review `types/supabase.ts` for existing patterns
  - Define `SeedreamUpload` interface
  - Define `SeedreamJob` interface
  - Define `Style` interface
  - Define API request/response types
  - Update Supabase types if needed
  - Run lint and type checks after completion
  - _Requirements: All_

- [ ] 9. Implement error handling and retry logic
  - Check if `lib/logger.ts` exists for error logging patterns
  - Create retry utility with exponential backoff
  - Handle Replicate rate limits (429)
  - Handle Replicate server errors (500)
  - Implement webhook delivery fallback
  - Add comprehensive error logging
  - Create user-friendly error messages
  - Run lint and type checks after completion
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 10. Add authentication and security
  - Review existing auth patterns in `app/api/headshots/generate/route.ts`
  - Verify Supabase authentication on all endpoints
  - Implement RLS policies for user data isolation
  - Verify webhook signatures
  - Implement rate limiting on all endpoints
  - Validate and sanitize all user inputs
  - Use secure blob paths (unguessable)
  - Run lint and type checks after completion
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 11. Build frontend upload component
  - Check existing components in `components/` directory for reusable patterns
  - Create drag-and-drop upload zone
  - Show upload progress indicators
  - Display uploaded image previews
  - Add file validation on client side
  - Handle upload errors gracefully
  - Run lint and type checks after completion
  - _Requirements: 9.1, 9.2_

- [ ] 12. Build frontend customization UI
  - Check existing UI components for checkbox patterns
  - Create checkbox for "Remove jewelry"
  - Create checkbox for "Remove glasses"
  - Create checkbox for "Remove piercings"
  - Create checkbox for "Clean background"
  - Show tooltips explaining each option
  - Run lint and type checks after completion
  - _Requirements: 9.3, 9.4_

- [ ] 13. Build frontend style selection UI
  - Check existing UI components for card/selection patterns
  - Display style cards with preview images
  - Show style names and descriptions
  - Highlight selected style
  - Allow style preview before generation
  - Run lint and type checks after completion
  - _Requirements: 9.5, 9.6_

- [ ] 14. Build frontend generation progress UI
  - Check existing progress/loading components
  - Show progress indicator during generation
  - Display estimated time remaining
  - Poll status endpoint every 3 seconds
  - Handle long-running generations gracefully
  - Show error messages if generation fails
  - Run lint and type checks after completion
  - _Requirements: 9.7_

- [ ] 15. Build frontend results gallery
  - Check existing gallery/grid components
  - Display 10 generated headshots in grid
  - Add download button for individual images
  - Add "Download All" button (ZIP)
  - Show generation metadata (time, cost)
  - Allow user to regenerate with different settings
  - Run lint and type checks after completion
  - _Requirements: 9.8, 9.9_

- [ ] 16. Add cost tracking and monitoring
  - Check if monitoring utilities exist in `lib/` directory
  - Log generation costs per job
  - Create daily/monthly cost summary queries
  - Add cost alerts for threshold breaches
  - Display cost estimates to users before generation
  - Run lint and type checks after completion
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 17. Implement cleanup and maintenance tasks
  - Check if cron jobs or scheduled tasks exist in the codebase
  - Create cron job to delete expired uploads (24 hours)
  - Create cron job to clean up old job records (30 days)
  - Implement user-initiated deletion of their data
  - Add Vercel Blob cleanup for deleted jobs
  - Run lint and type checks after completion
  - _Requirements: 1.6, 5.6_

- [ ] 18. Write integration tests
  - Check existing test files and testing setup
  - Test complete upload → generate → webhook → results flow
  - Test webhook signature verification
  - Test fallback polling when webhook fails
  - Test error scenarios (API failures, invalid inputs)
  - Test rate limiting
  - Run lint and type checks after completion
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

- [ ] 19. Test background consistency across users
  - Generate headshots for 5 different users with same style
  - Verify backgrounds are visually identical
  - Verify faces are different but backgrounds match
  - Document any inconsistencies
  - Run lint and type checks after completion
  - _Requirements: 3.6, 10.2_

- [ ] 20. Deploy and configure production environment
  - Set up Vercel Blob storage
  - Configure Replicate API token
  - Deploy API routes to Vercel
  - Configure webhook URL in environment
  - Set up monitoring and alerting
  - Test end-to-end in production
  - Run final lint and type checks
  - _Requirements: All_
