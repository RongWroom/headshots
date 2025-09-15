# Requirements Document

## Introduction

This feature involves recreating the original Supabase database schema for the headshots application on a new Supabase account. The application expects a simple schema with four main tables: credits, models, samples, and images. This setup will restore the application's functionality with the existing codebase without requiring code changes.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to recreate the original database schema, so that the existing application code works without modifications.

#### Acceptance Criteria

1. WHEN the database is set up THEN the system SHALL have credits, models, samples, and images tables
2. WHEN table structures are created THEN they SHALL match the existing TypeScript types exactly
3. WHEN foreign key relationships are established THEN they SHALL maintain referential integrity
4. WHEN the application connects THEN it SHALL work with existing database queries

### Requirement 2

**User Story:** As a user, I want my credits to be tracked properly, so that I can use the headshot generation service.

#### Acceptance Criteria

1. WHEN a user account is created THEN the system SHALL initialize their credits record
2. WHEN credits are consumed THEN the system SHALL decrement the credits value accurately
3. WHEN credits are purchased THEN the system SHALL increment the credits value
4. WHEN credit balance is checked THEN the system SHALL return the current accurate amount

### Requirement 3

**User Story:** As a user, I want to train custom models, so that I can generate personalized headshots.

#### Acceptance Criteria

1. WHEN a user starts model training THEN the system SHALL create a models record with pending status
2. WHEN Replicate training begins THEN the system SHALL store the external modelId
3. WHEN training completes THEN the system SHALL update the model status appropriately
4. WHEN models are listed THEN the system SHALL show only models belonging to the authenticated user

### Requirement 4

**User Story:** As a user, I want to upload sample images for training, so that my model learns from my photos.

#### Acceptance Criteria

1. WHEN sample images are uploaded THEN the system SHALL store references in the samples table
2. WHEN samples are associated with models THEN the system SHALL link them via modelId foreign key
3. WHEN samples are retrieved THEN the system SHALL return all samples for a specific model
4. WHEN samples are displayed THEN the system SHALL show the correct image URIs

### Requirement 5

**User Story:** As a user, I want to view generated headshot images, so that I can see the results of my model.

#### Acceptance Criteria

1. WHEN headshots are generated THEN the system SHALL store image records with URIs
2. WHEN images are associated with models THEN the system SHALL link them via modelId foreign key
3. WHEN images are retrieved THEN the system SHALL return all images for a specific model
4. WHEN images are displayed THEN the system SHALL show the correct image URIs from Vercel Blob storage

### Requirement 6

**User Story:** As a developer, I want proper database policies and security, so that users can only access their own data.

#### Acceptance Criteria

1. WHEN users query their data THEN the system SHALL only return records they own
2. WHEN users attempt unauthorized access THEN the system SHALL deny the request
3. WHEN service roles operate THEN they SHALL have appropriate elevated permissions
4. WHEN authentication is required THEN the system SHALL enforce user authentication

### Requirement 7

**User Story:** As a developer, I want the database migration to be seamless, so that the application continues working immediately.

#### Acceptance Criteria

1. WHEN the new database is configured THEN all existing API endpoints SHALL work without changes
2. WHEN database queries execute THEN they SHALL use the correct table and column names
3. WHEN the application starts THEN it SHALL connect to the new Supabase instance successfully
4. WHEN users interact with the app THEN they SHALL experience no functional differences