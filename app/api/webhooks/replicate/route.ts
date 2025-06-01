// app/api/webhooks/replicate/route.ts
import { NextResponse } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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
    // Log incoming request
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

      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

      try {
        if (modelType === 'user-model') {
          console.log('Updating user model with ID:', output?.model_id)
          const { data, error } = await supabase
            .from('user_models')
            .update({
              model_id: output.model_id,
              status: 'trained',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
          
          if (error) throw error
          console.log('User model update successful:', data)
          
        } else if (modelType === 'final-style') {
          console.log('Updating generation with output URL:', output?.[0])
          const { data, error } = await supabase
            .from('generations')
            .update({
              output_url: output[0],
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', predictionId)
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
