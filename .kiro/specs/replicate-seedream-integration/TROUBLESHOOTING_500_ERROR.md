# Troubleshooting: 500 Error on /api/seedream/generate

## Issues Fixed

### 1. ✅ Button Nesting Error (FIXED)

**Error:** `<button> cannot be a descendant of <button>`

**Cause:** In `SeedreamStyleSelector.tsx`, the style card was a `<button>` element containing a Dialog with another `<Button>` for the preview.

**Fix:** Changed the outer element from `<button>` to `<div>` with proper accessibility attributes:
- Added `role="button"`
- Added `tabIndex={0}`
- Added keyboard event handler for Enter/Space keys
- Added `cursor-pointer` class

**Result:** No more hydration errors! ✅

### 2. ⚠️ 500 Error on Generate API (NEEDS INVESTIGATION)

**Error:** `POST /api/seedream/generate 500 in 1415ms`

**Possible Causes:**

The API endpoint exists and looks correct, so the 500 error is likely due to one of these issues:

#### A. Missing Database Tables

The API tries to query these tables:
- `seedream_uploads`
- `seedream_jobs`

**Check if tables exist:**
```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('seedream_uploads', 'seedream_jobs');
```

**If tables don't exist, you need to run the migration:**
- Check `.kiro/specs/replicate-seedream-integration/tasks.md` Task 3
- Look for database migration files
- Run the migration to create tables

#### B. Missing Environment Variables

The API requires:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL`
- `REPLICATE_API_TOKEN` (used by seedreamService)
- `REPLICATE_WEBHOOK_SECRET` (optional but recommended)

**Check your `.env.local` file:**
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
REPLICATE_API_TOKEN=r8_your_token_here

# For webhooks
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REPLICATE_WEBHOOK_SECRET=your-webhook-secret
```

#### C. Missing seedreamService

The API imports `seedreamService` from `@/lib/seedream-service`.

**Check if file exists:**
```bash
ls -la lib/seedream-service.ts
```

**If missing, check Task 4 in tasks.md**

#### D. Missing style-catalog

The API imports functions from `@/lib/style-catalog`.

**Check if file exists:**
```bash
ls -la lib/style-catalog.ts
```

**If missing, check Task 2 in tasks.md**

## How to Debug

### Step 1: Check Server Logs

Look at your terminal where `npm run dev` is running. You should see detailed error logs from the Logger class.

Look for lines like:
```
[SEEDREAM_GENERATE_API] ERROR: ...
```

### Step 2: Check Browser Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Click on the failed `generate` request
4. Look at the Response tab
5. You should see a JSON error response with details

### Step 3: Test Database Connection

Create a simple test endpoint:

```typescript
// app/api/test-db/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  try {
    // Test auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Auth failed',
        details: authError.message 
      });
    }

    // Test table access
    const { data, error } = await supabase
      .from('seedream_uploads')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Table query failed',
        details: error.message,
        hint: 'Table might not exist or RLS policies might be blocking access'
      });
    }

    return NextResponse.json({ 
      success: true, 
      user: user?.email,
      message: 'Database connection works!' 
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
```

Then visit: `http://localhost:3000/api/test-db`

### Step 4: Check Task Completion

According to `tasks.md`, these tasks should be complete before testing the workflow:

- [x] Task 1: Database schema (tables must exist)
- [x] Task 2: Style catalog (lib/style-catalog.ts)
- [x] Task 3: Upload API (for staging images)
- [x] Task 4: Seedream service (lib/seedream-service.ts)
- [x] Task 5: Generate API (the one failing)
- [x] Task 6: Webhook handler
- [x] Task 7: Status API
- [x] Task 8: TypeScript types

**Verify each task's implementation exists:**
```bash
# Check database migration
ls -la supabase/migrations/

# Check style catalog
ls -la lib/style-catalog.ts

# Check seedream service
ls -la lib/seedream-service.ts

# Check types
ls -la types/seedream.ts
```

## Quick Fix Checklist

- [ ] Database tables created (run migration)
- [ ] Environment variables set in `.env.local`
- [ ] `lib/seedream-service.ts` exists
- [ ] `lib/style-catalog.ts` exists
- [ ] `types/seedream.ts` exists
- [ ] Supabase auth working (user logged in)
- [ ] RLS policies allow user to query tables
- [ ] Replicate API token is valid

## Expected Behavior After Fix

When you click "Generate Professional Headshots":

1. **Request sent:**
   ```json
   POST /api/seedream/generate
   {
     "uploadId": "abc-123",
     "styleId": "corporate-blue",
     "numOutputs": 10,
     "customizations": {
       "removeJewelry": true,
       "removeGlasses": false
     }
   }
   ```

2. **Success response:**
   ```json
   {
     "success": true,
     "jobId": "job-uuid-here",
     "status": "pending",
     "estimatedTime": "60-90 seconds",
     "pollUrl": "/api/seedream/status/job-uuid-here"
   }
   ```

3. **Progress component appears** and starts polling

4. **Results appear** after 60-90 seconds

## Next Steps

1. **Check server logs** in your terminal
2. **Check browser console** for the full error response
3. **Verify database tables exist**
4. **Verify environment variables are set**
5. **Run the test-db endpoint** to isolate the issue

Once you identify the specific error, we can fix it! The most common issues are:
- Missing database tables (need to run migration)
- Missing environment variables
- User not authenticated

Let me know what error you see in the server logs and I can help fix it! 🔧
