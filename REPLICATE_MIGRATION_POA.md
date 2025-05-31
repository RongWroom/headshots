# Plan of Action: Migrating to Replicate for AI Headshots

This document outlines the next steps to continue migrating the headshot generation service from Astria to Replicate.

## I. Prerequisites (Actions for You)

Before we proceed with further code development, please ensure the following are completed:

1.  **Vercel Deployment:**
    *   Successfully deploy the current state of the application to Vercel.
2.  **Update `DEPLOYMENT_URL`:**
    *   Once deployed, obtain the public URL provided by Vercel (e.g., `https://your-project.vercel.app`).
    *   Update the `DEPLOYMENT_URL` variable in your local `.env.local` file.
    *   Ensure `DEPLOYMENT_URL` is also set correctly as an environment variable in your Vercel project settings.
3.  **Set `REPLICATE_WEBHOOK_SECRET`:**
    *   Generate a strong, unique, random string to be used as a secret for verifying webhook authenticity.
    *   Update the `REPLICATE_WEBHOOK_SECRET` variable in your local `.env.local` file.
    *   Ensure `REPLICATE_WEBHOOK_SECRET` is also set correctly as an environment variable in your Vercel project settings.
4.  **Install Replicate Node.js Client:**
    *   Open your terminal in the project directory and run:
        ```bash
        npm install replicate
        ```
    *   (Or if you use Yarn: `yarn add replicate`)

## II. Next Development Steps (Collaborative with Cascade)

Once the prerequisites are met, we will proceed with the following development tasks:

1.  **Create Replicate API Client (`lib/replicate.ts`):
    *   **Purpose:** Centralize all interactions with the Replicate API.
    *   **Details:** This module will use `REPLICATE_API_TOKEN`.
    *   **Functions:**
        *   `startUserModelTraining(zipFileUrl: string, webhookUrl: string)`: Initiates training with `replicate/flux-fast-trainer`.
        *   `startStyleApplication(userModelId: string, styleLoraId: string, webhookUrl: string)`: Initiates image generation with `lucataco/flux-dev-multi-lora`.

2.  **Create Image Zipping Utility (`lib/zipHelper.ts`):
    *   **Purpose:** Handle the zipping of user-uploaded images before sending them to Replicate.
    *   **Details:** Will require a library like `jszip` (we'll install this when we get to this step).
    *   **Function:** `createZipFromImageUrls(imageUrls: string[]): Promise<string>`: Downloads images, zips them, uploads the zip to Vercel Blob, and returns the public URL of the zip.

3.  **Implement API Route: Train User Model (`app/api/replicate/train-user-model/route.ts`):
    *   **Purpose:** Endpoint called by the frontend to start the user model training process.
    *   **Logic:**
        *   Receive image URLs from the client.
        *   Use `zipHelper.ts` to create the image zip.
        *   Call `startUserModelTraining` from `lib/replicate.ts`.
        *   Store initial job details in Supabase.

4.  **Implement Webhook: User Model Training Complete (`app/api/replicate/webhook/train-user-complete/route.ts`):
    *   **Purpose:** Endpoint called by Replicate when `flux-fast-trainer` job finishes.
    *   **Logic:**
        *   Verify webhook signature/secret.
        *   Update Supabase with training results (e.g., trained model ID).

5.  **Implement API Route: Apply Style (`app/api/replicate/apply-style/route.ts`):
    *   **Purpose:** Endpoint called by the frontend (or triggered internally) to generate the styled headshot.
    *   **Logic:**
        *   Retrieve user model ID (from Supabase) and style LoRA ID (from `.env.local`).
        *   Call `startStyleApplication` from `lib/replicate.ts`.
        *   Store initial job details in Supabase.

6.  **Implement Webhook: Style Application Complete (`app/api/replicate/webhook/apply-style-complete/route.ts`):
    *   **Purpose:** Endpoint called by Replicate when `flux-dev-multi-lora` job finishes.
    *   **Logic:**
        *   Verify webhook signature/secret.
        *   Update Supabase with generation results (e.g., final image URL).

7.  **Frontend Modifications (`components/TrainModelZone.tsx`, etc.):**
    *   Update UI and logic to call the new Replicate API routes.
    *   Adapt image upload flow and result display to the new backend.
    *   Use the `NEXT_PUBLIC_USE_REPLICATE` feature flag to switch between Astria and Replicate flows if needed during transition.

8.  **Testing and Refinement:**
    *   Thorough end-to-end testing of the entire Replicate workflow.

When you return and have completed the prerequisites, please let me know by referencing this file (`REPLICATE_MIGRATION_POA.md`), and we can begin with step II.1: Creating `lib/replicate.ts`.
