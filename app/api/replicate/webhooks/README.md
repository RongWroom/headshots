# Replicate Webhooks

This directory contains webhook handlers for Replicate's training and prediction events.

## Webhook Endpoints

### Training Webhook
- **Path**: `/api/replicate/webhooks/train`
- **Method**: POST
- **Query Parameters**:
  - `user_id`: The ID of the user who initiated the training
  - `model_id`: The ID of the model being trained

### Prediction Webhook
- **Path**: `/api/replicate/webhooks/predict`
- **Method**: POST
- **Query Parameters**:
  - `user_id`: The ID of the user who made the prediction
  - `prediction_id`: The ID of the prediction

## Environment Variables

Make sure these environment variables are set:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
REPLICATE_WEBHOOK_SECRET=your-webhook-secret
RESEND_API_KEY=your-resend-api-key  # Optional, for email notifications
```

## Testing Webhooks Locally

1. Start your Next.js app:
   ```bash
   npm run dev
   ```

2. Use a tool like ngrok to expose your local server:
   ```bash
   ngrok http 3000
   ```

3. Use the ngrok URL in your Replicate webhook configuration, for example:
   ```
   https://your-ngrok-url.ngrok.io/api/replicate/webhooks/train?user_id=123&model_id=456
   ```

## Webhook Payload Examples

### Training Webhook Payload

```json
{
  "id": "train_123",
  "version": "model-version",
  "status": "succeeded",
  "input": {
    // training input
  },
  "output": {
    "version": "trained-model-version"
  },
  "error": null,
  "logs": "...",
  "metrics": {},
  "created_at": "2023-01-01T00:00:00.000Z",
  "started_at": "2023-01-01T00:00:00.000Z",
  "completed_at": "2023-01-01T00:10:00.000Z"
}
```

### Prediction Webhook Payload

```json
{
  "id": "prediction-123",
  "version": "model-version",
  "status": "succeeded",
  "input": {
    // prediction input
  },
  "output": ["https://example.com/output.jpg"],
  "error": null,
  "logs": "...",
  "metrics": {},
  "created_at": "2023-01-01T00:00:00.000Z",
  "started_at": "2023-01-01T00:00:00.000Z",
  "completed_at": "2023-01-01T00:01:00.000Z"
}
```

## Security

- Webhook signatures are verified using the `REPLICATE_WEBHOOK_SECRET`
- Always validate the signature before processing the webhook payload
- Use HTTPS for webhook endpoints in production
- Validate all input data before processing

## Error Handling

- Returns 401 for invalid or missing signatures
- Returns 400 for missing required parameters
- Returns 500 for internal server errors
- Logs errors to the console for debugging
