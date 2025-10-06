# Seedream Upload Troubleshooting Guide

## Error: DATABASE_INSERT_FAILED

If you're seeing this error when testing the upload component, here are the most common causes and solutions:

### 1. Migration Not Run ❌

**Symptom**: Error message contains "relation does not exist" or similar

**Solution**:
1. Open your Supabase dashboard
2. Navigate to SQL Editor
3. Open the migration file: `supabase/migrations/20250930000000_add_seedream_integration.sql`
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Run the query
7. Verify tables were created:
   ```sql
   SELECT * FROM seedream_uploads LIMIT 1;
   SELECT * FROM seedream_jobs LIMIT 1;
   ```

### 2. Not Authenticated ❌

**Symptom**: Error code `23503` (foreign key constraint) or `42501` (permission denied)

**Solution**:
- Make sure you are signed in to the application
- The upload API requires authentication
- Check that your session is valid
- Try signing out and signing back in

### 3. RLS Policies Not Applied ❌

**Symptom**: Error code `42501` or "permission denied"

**Solution**:
1. Verify RLS policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'seedream_uploads';
   ```
2. If policies are missing, re-run the migration
3. Check that your user ID matches the authenticated user

### 4. Invalid JSON Format ❌

**Symptom**: Error about JSON parsing or invalid format

**Solution**:
- This should be fixed in the latest code
- The `images` field is now properly formatted as JSON
- Make sure you're using the updated `app/api/seedream/upload/route.ts`

### 5. Missing Environment Variables ❌

**Symptom**: "Configuration error" or "Blob storage not configured"

**Solution**:
Check your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
BLOB_READ_WRITE_TOKEN=your_blob_token
```

## Debugging Steps

### Step 1: Run the Debug Script

```bash
node test-seedream-upload-debug.js
```

This will check:
- Environment variables
- Database table existence
- Table structure
- Insert permissions

### Step 2: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for detailed error messages
4. Check Network tab for API response

### Step 3: Check Server Logs

If running locally:
```bash
npm run dev
```

Look for log messages starting with `[SEEDREAM_UPLOAD_API]`

### Step 4: Verify Database State

In Supabase SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'seedream_uploads'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'seedream_uploads';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'seedream_uploads';

-- Try a test insert (replace with your user ID)
INSERT INTO seedream_uploads (user_id, images)
VALUES ('your-user-id-here', '[{"filename":"test.jpg","blobUrl":"https://example.com/test.jpg","size":1024}]'::jsonb);
```

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `23503` | Foreign key violation | User ID doesn't exist - sign in |
| `42501` | Permission denied | RLS policy issue - check authentication |
| `42P01` | Table doesn't exist | Run migration |
| `22P02` | Invalid JSON | Check data format |
| `23505` | Unique violation | Upload ID collision (very rare) |

## Quick Fixes

### Fix 1: Re-run Migration

```sql
-- Drop and recreate tables
DROP TABLE IF EXISTS seedream_jobs CASCADE;
DROP TABLE IF EXISTS seedream_uploads CASCADE;

-- Then run the full migration from:
-- supabase/migrations/20250930000000_add_seedream_integration.sql
```

### Fix 2: Reset RLS Policies

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own seedream uploads" ON seedream_uploads;
DROP POLICY IF EXISTS "Users can create their own seedream uploads" ON seedream_uploads;
DROP POLICY IF EXISTS "Users can delete their own seedream uploads" ON seedream_uploads;
DROP POLICY IF EXISTS "Service role can manage all seedream uploads" ON seedream_uploads;

-- Recreate policies (from migration file)
-- ... (copy from migration)
```

### Fix 3: Check User Authentication

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

## Testing Checklist

Before testing upload:

- [ ] Migration has been run
- [ ] Tables exist in database
- [ ] RLS policies are active
- [ ] You are signed in
- [ ] Environment variables are set
- [ ] Blob storage is configured
- [ ] Browser console is open for errors

## Still Having Issues?

1. **Check the error details**: The error response includes a `requestId` - save this for debugging
2. **Look at the timestamp**: Helps correlate with server logs
3. **Check the stage**: Tells you where the error occurred
4. **Review suggestions**: The API provides helpful suggestions in the error response

## Example Error Response

```json
{
  "success": false,
  "error": "Database error",
  "message": "Failed to save upload metadata",
  "errorCode": "DATABASE_ERROR",
  "details": {
    "dbError": {
      "message": "Foreign key violation",
      "code": "23503"
    },
    "uploadId": "...",
    "userId": "..."
  },
  "suggestions": [
    "Try again in a few moments",
    "Contact support if the issue persists"
  ],
  "timestamp": "2025-10-06T17:14:00.888Z"
}
```

## Contact Support

If none of these solutions work:

1. Save the full error message
2. Note the `requestId` from the error
3. Check server logs for that request ID
4. Provide:
   - Error message
   - Request ID
   - Timestamp
   - Steps to reproduce
   - Browser and OS

## Prevention

To avoid these issues in the future:

1. Always run migrations when updating
2. Keep environment variables up to date
3. Test authentication before testing features
4. Monitor Supabase dashboard for issues
5. Check RLS policies after schema changes

---

**Last Updated**: 2025-10-06
**Related Files**:
- `app/api/seedream/upload/route.ts`
- `supabase/migrations/20250930000000_add_seedream_integration.sql`
- `test-seedream-upload-debug.js`
