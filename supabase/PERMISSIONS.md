# Database Permissions Configuration

This document outlines the database permissions and grants configuration for the headshots application, implementing the principle of least privilege for security.

## Overview

The database uses three main Supabase roles with different permission levels:

- **anon**: Anonymous users (no database access)
- **authenticated**: Logged-in users (limited access to their own data)
- **service_role**: System operations (full access for webhooks and background tasks)

## Permission Matrix

### Schema Permissions

| Role | Public Schema |
|------|---------------|
| anon | USAGE |
| authenticated | USAGE |
| service_role | USAGE |

### Table Permissions

#### Credits Table
| Role | Permissions | Purpose |
|------|-------------|---------|
| anon | None | Must be authenticated to have credits |
| authenticated | SELECT, UPDATE | Read and update own credits (RLS enforced) |
| service_role | SELECT, INSERT, UPDATE, DELETE | Payment processing and system operations |

#### Models Table
| Role | Permissions | Purpose |
|------|-------------|---------|
| anon | None | Must be authenticated to create models |
| authenticated | SELECT, INSERT, UPDATE, DELETE | Full CRUD on own models (RLS enforced) |
| service_role | SELECT, INSERT, UPDATE, DELETE | Webhook operations and system management |

#### Samples Table
| Role | Permissions | Purpose |
|------|-------------|---------|
| anon | None | Must be authenticated to upload samples |
| authenticated | SELECT, INSERT, UPDATE, DELETE | Full CRUD on samples for own models (RLS enforced) |
| service_role | SELECT, INSERT, UPDATE, DELETE | System operations |

#### Images Table
| Role | Permissions | Purpose |
|------|-------------|---------|
| anon | None | Must be authenticated to view images |
| authenticated | SELECT, UPDATE, DELETE | View and manage images for own models (RLS enforced) |
| service_role | SELECT, INSERT, UPDATE, DELETE | Webhook operations and image generation |

*Note: Image INSERT is primarily handled by service_role via webhooks*

### Sequence Permissions

All auto-incrementing ID sequences follow this pattern:

| Role | Permissions | Purpose |
|------|-------------|---------|
| anon | None | No access to sequences |
| authenticated | USAGE, SELECT | Can use sequences for INSERT operations |
| service_role | ALL | Full sequence management |

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:

1. **User Isolation**: Users can only access their own data
2. **Service Role Access**: System operations can access all data when needed
3. **Relationship-based Access**: Samples and images are accessible through model ownership

### Key Security Policies

- **Credits**: Users access only their own credits; service role can manage all credits
- **Models**: Users access only their own models; service role can update any model
- **Samples**: Users access samples only for their own models
- **Images**: Users access images only for their own models; service role can insert via webhooks

## Implementation Files

1. **20250915000000_recreate_schema.sql**: Main schema creation with initial permissions
2. **20250915000001_secure_permissions.sql**: Secure permission configuration
3. **verify_permissions.sql**: Verification script to check permissions
4. **rls-policies.sql**: Additional RLS policies for service role operations

## Verification

Run the verification script to ensure permissions are configured correctly:

```sql
\i supabase/verify_permissions.sql
```

Expected results:
- No permissions for anon role on any table
- Limited permissions for authenticated role (enforced by RLS)
- Full permissions for service_role
- All tables have RLS enabled
- Multiple policies per table for different access patterns

## Migration Order

1. Apply main schema migration: `20250915000000_recreate_schema.sql`
2. Apply secure permissions: `20250915000001_secure_permissions.sql`
3. Verify with: `verify_permissions.sql`

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**: Check that the user role has the required table permissions
2. **RLS Policy Violations**: Verify that policies allow the intended access pattern
3. **Sequence Access Issues**: Ensure authenticated users have USAGE on sequences

### Debug Queries

```sql
-- Check current user's role
SELECT current_user, session_user;

-- Check table permissions for current user
SELECT * FROM information_schema.table_privileges 
WHERE grantee = current_user AND table_schema = 'public';

-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

## Security Considerations

1. **Principle of Least Privilege**: Each role has only the minimum permissions needed
2. **Defense in Depth**: RLS policies provide additional security beyond table permissions
3. **Service Role Protection**: Service role credentials must be secured and used only for system operations
4. **Regular Audits**: Periodically review permissions and policies for security compliance

This configuration ensures secure, role-based access to the database while maintaining the functionality required by the headshots application.