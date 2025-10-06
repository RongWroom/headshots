# Seedream Integration Migration

## Overview

This migration adds database support for the Replicate Seedream integration, which enables professional headshot generation using the Seedream API.

## Tables Created

### `seedream_uploads`
Stores user photo uploads that will be processed by Seedream.

**Columns:**
- `id` (uuid, PK): Unique identifier for the upload
- `user_id` (uuid, FK): Reference to the user who uploaded the images
- `images` (jsonb): Array of uploaded image metadata `{filename, blobUrl, size}`
- `created_at` (timestamptz): When the upload was created
- `expires_at` (timestamptz): When the upload expires (24 hours after creation)

**Indexes:**
- `idx_seedream_uploads_user`: Index on `user_id` for fast user queries
- `idx_seedream_uploads_expires`: Index on `expires_at` for cleanup operations

### `seedream_jobs`
Tracks headshot generation jobs via the Replicate API.

**Columns:**
- `id` (uuid, PK): Unique identifier for the job
- `user_id` (uuid, FK): Reference to the user who owns the job
- `upload_id` (uuid, FK): Reference to the upload being processed
- `style_id` (text): Style identifier from the style catalog
- `num_outputs` (integer): Number of headshots to generate (default: 10)
- `customizations` (jsonb): User customization preferences
- `replicate_prediction_id` (text): Replicate API prediction ID
- `status` (text): Job status (pending, processing, completed, failed)
- `progress` (integer): Progress percentage (0-100)
- `error_message` (text): Error details if job failed
- `output_images` (jsonb): Array of generated image URLs
- `generation_time_seconds` (numeric): Time taken for generation
- `estimated_cost_usd` (numeric): Estimated cost for analytics
- `created_at` (timestamptz): When the job was created
- `started_at` (timestamptz): When processing began
- `completed_at` (timestamptz): When the job finished
- `updated_at` (timestamptz): Last update timestamp

**Indexes:**
- `idx_seedream_jobs_user`: Index on `user_id`
- `idx_seedream_jobs_status`: Index on `status`
- `idx_seedream_jobs_replicate`: Index on `replicate_prediction_id`
- `idx_seedream_jobs_user_status`: Composite index on `user_id` and `status`
- `idx_seedream_jobs_created_at`: Index on `created_at` (descending)

## Triggers

### Automatic Timestamp Management

1. **`update_seedream_jobs_updated_at`**: Automatically updates `updated_at` on any row update
2. **`set_seedream_job_started_at`**: Sets `started_at` when status changes to 'processing'
3. **`set_seedream_job_completed_at`**: Sets `completed_at` and calculates `generation_time_seconds` when status changes to 'completed' or 'failed'

## RLS Policies

### seedream_uploads
- Users can view, create, and delete their own uploads
- Service role has full access for webhook operations

### seedream_jobs
- Users can view, create, update, and delete their own jobs
- Service role has full access for webhook operations

## Usage

### Creating an Upload
```sql
INSERT INTO seedream_uploads (user_id, images)
VALUES (
  auth.uid(),
  '[{"filename": "photo1.jpg", "blobUrl": "https://...", "size": 1024000}]'::jsonb
);
```

### Creating a Job
```sql
INSERT INTO seedream_jobs (user_id, upload_id, style_id, num_outputs)
VALUES (
  auth.uid(),
  'upload-uuid-here',
  'corporate-blue',
  10
);
```

### Updating Job Status
```sql
UPDATE seedream_jobs
SET status = 'processing', progress = 50
WHERE id = 'job-uuid-here';
```

## Cleanup

Uploads automatically expire after 24 hours. A cron job should be set up to delete expired uploads:

```sql
DELETE FROM seedream_uploads
WHERE expires_at < now();
```

## Migration File

`20250930000000_add_seedream_integration.sql`
