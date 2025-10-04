import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';

// This is your Replicate webhook secret
const WEBHOOK_SECRET = process.env.REPLICATE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    if (!WEBHOOK_SECRET) {
      throw new Error('REPLICATE_WEBHOOK_SECRET is not set');
    }

    // Get the headers
    const headersList = await headers();
    const svix_id = headersList.get('svix-id');
    const svix_timestamp = headersList.get('svix-timestamp');
    const svix_signature = headersList.get('svix-signature');

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Error occurred -- no svix headers', {
        status: 400
      });
    }

    // Get the body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Create a new Webhook instance with your webhook secret
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: any;

    try {
      // Verify the webhook signature
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-signature': svix_signature,
        'svix-timestamp': svix_timestamp,
      });
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return new Response('Error occurred', {
        status: 400
      });
    }

    // Handle the webhook
    const eventType = evt.type;
    const trainingData = evt.data;

    console.log(`Webhook received: ${eventType}`, trainingData);

    // Update database when training completes
    if (eventType === 'training.completed' && trainingData.status === 'succeeded') {
      const { createClient } = require('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Find the model by Replicate training ID and update it
      const { error: updateError } = await supabase
        .from('models')
        .update({
          status: 'finished',
          replicate_model_id: `${trainingData.output.model}`, // Store the trained model ID
          replicate_version_id: trainingData.output.version
        })
        .eq('replicate_training_id', trainingData.id);

      if (updateError) {
        console.error('Error updating model:', updateError);
      } else {
        console.log('Model updated with trained model ID:', trainingData.output.model);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}
