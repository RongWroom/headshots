# Environment Configuration Guide

This guide walks you through updating the environment configuration for the new Supabase database migration.

## Overview

The application requires specific environment variables to connect to your new Supabase database. This document explains how to properly configure these variables and verify the connection.

## Required Supabase Environment Variables

The application uses three main Supabase environment variables:

| Variable | Description | Format | Usage |
|----------|-------------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://your-project-ref.supabase.co` | Client-side and server-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/anonymous key | JWT format starting with `eyJ` | Client-side authentication |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | JWT format starting with `eyJ` | Server-side operations, webhooks |

## Step-by-Step Configuration

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (for `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role key** (for `SUPABASE_SERVICE_ROLE_KEY`)

### 2. Update .env.local

Open `.env.local` and replace the placeholder values:

```bash
# Supabase Configuration - Updated for new database migration
NEXT_PUBLIC_SUPABASE_URL="https://your-actual-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Validate Configuration

Run the validation script to check your environment variables:

```bash
node validate-env-config.js
```

This will verify:
- All required variables are set
- No placeholder values remain
- Formats match expected patterns

**Expected Output**: The script should show ✅ for all Supabase variables after you update them.

### 4. Test Database Connection

Once validation passes, test the database connection:

```bash
node test-db-connection.js
```

This will test:
- Environment variable loading
- Database connectivity with both anon and service keys
- Table access (credits, models, samples, images)

**Note**: This test will fail if your database schema hasn't been created yet (Task 1) or if RLS policies aren't configured (Task 2).

### 5. Alternative: Interactive Setup

For a guided setup experience, use the interactive helper:

```bash
node update-supabase-env.js
```

This script will:
- Prompt you for each Supabase credential
- Validate the format as you enter them
- Automatically update your .env.local file

## Environment Variable Usage in Code

### Client-Side Usage (middleware.ts)
```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  // ... cookie configuration
)
```

### Server-Side Usage (API routes)
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all three Supabase variables are set in `.env.local`
   - Check for typos in variable names

2. **"Connection failed" errors**
   - Verify your Supabase project URL is correct
   - Ensure your project is not paused
   - Check that your API keys are valid

3. **"Table access denied" errors**
   - Ensure your database schema has been created
   - Verify RLS policies are properly configured
   - Check that tables exist: credits, models, samples, images

4. **"Invalid format" warnings**
   - Supabase URLs should match: `https://[project-ref].supabase.co`
   - API keys should be JWT tokens starting with `eyJ`

### Verification Checklist

- [ ] All environment variables are set in `.env.local`
- [ ] No placeholder values (containing "your-" or "your_") remain
- [ ] Validation script passes without errors
- [ ] Connection test succeeds for both anon and service clients
- [ ] All four tables (credits, models, samples, images) are accessible

## Security Notes

- **Never commit** `.env.local` to version control
- The **service role key** has elevated permissions - keep it secure
- The **anon key** is safe to expose in client-side code
- Use environment-specific configurations for different deployments

## Next Steps

After successful environment configuration:

1. Ensure your database schema is created (Task 1)
2. Configure RLS policies (Task 2) 
3. Test the full application functionality
4. Deploy with updated environment variables

## Files Modified

- `.env.local` - Updated with new Supabase credentials
- `.env.example` - Added helpful comments and format examples
- `.env.local.example` - Enhanced documentation
- `validate-env-config.js` - Created validation script
- `test-db-connection.js` - Created connection test script