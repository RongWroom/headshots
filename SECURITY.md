# Security Guidelines

## Environment Variables

- **Never commit** `.env.local` or any files containing real credentials to version control
- Use `.env.example` as a template for required variables
- For production, set environment variables through your deployment platform (Vercel, Netlify, etc.)

## API Keys

- **Rotate keys** if they're ever exposed in logs or public repositories
- Use the Supabase service role key only in server-side code
- Limit permissions when possible using Row Level Security (RLS)

## Supabase Security

### Row Level Security (RLS)

Row Level Security has been configured in `supabase/rls-policies.sql`. These policies ensure:
- Users can only access their own data
- The service role can access all data (for webhooks)

To apply these policies to your Supabase project:

1. Go to the Supabase dashboard
2. Select "SQL Editor"
3. Copy and paste the contents of `supabase/rls-policies.sql`
4. Run the SQL script

### Table Schema Security

Ensure your tables have appropriate columns for security:
- `user_id` columns should be linked to authenticated users
- Use timestamps for audit trails (`created_at`, `updated_at`)
- Consider soft deletes instead of hard deletes

## Regular Security Practices

- **Enable 2FA** on GitHub/GitLab, Supabase, and Vercel
- **Audit your repository** periodically for leaked secrets
- **Update dependencies** regularly to patch security vulnerabilities

## Webhooks

- Always verify webhook signatures
- Use environment variables for webhook secrets
- Implement rate limiting where possible
