// app/api/webhooks/replicate/route.ts
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client directly with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface WebhookPayload {
  type: string;
  id: string;
  status: string;
  output: any;
  metadata?: {
    userId?: string;
    modelType?: 'user-model' | 'final-style';
  };
}

export async function POST(request: Request) {
  try {
    console.log('\n--- New Webhook Request ---')
    console.log('Time:', new Date().toISOString())

    // Parse and validate request
    const payload: WebhookPayload = await request.json()
    console.log('Payload:', JSON.stringify(payload, null, 2))

    const headersList = await nextHeaders()
    const signature = headersList.get('x-webhook-signature')
    console.log('Signature:', signature ? 'Present' : 'Missing')

    // Verify the webhook signature
    if (!signature) {
      console.error('Error: Missing webhook signature')
      return new NextResponse('Missing signature', { status: 401 })
    }

    // Process the webhook based on the event type
    const { type: eventType, id: predictionId, status, output, metadata } = payload
    console.log(`Processing ${eventType} for ID: ${predictionId}`)

    if (eventType === 'prediction.completed' && metadata) {
      const { userId, modelType } = metadata
      console.log(`Model Type: ${modelType}, User ID: ${userId}`)

      if (!userId) {
        console.error('Error: Missing userId in metadata')
        return new NextResponse('Missing user ID', { status: 400 })
      }

      try {
        if (modelType === 'user-model') {
          console.log('Updating user model with ID:', output?.model_id)
          const { data, error } = await supabase
            .from('user_models')
            .upsert({
              user_id: userId,
              model_id: output.model_id,
              status: 'trained',
              updated_at: new Date().toISOString()
            })
            .select()

          if (error) throw error
          console.log('User model update successful:', data)

        } else if (modelType === 'final-style') {
          console.log('Updating generation with output URL:', output?.[0])
          const { data, error } = await supabase
            .from('generations')
            .upsert({
              id: predictionId,
              user_id: userId,
              output_url: output[0],
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .select()

          if (error) throw error
          console.log('Generation update successful:', data)
        }
      } catch (dbError) {
        console.error('Database error:', dbError)
        throw dbError
      }
    }

    console.log('--- Webhook processed successfully ---\n')
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      event: eventType,
      predictionId
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook error:', errorMessage)
    console.error('Error details:', error)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Failed to process webhook'
      },
      { status: 400 }
    )
  }
}
