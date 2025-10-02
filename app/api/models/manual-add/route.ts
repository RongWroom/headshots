import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trainingId, modelName, triggerWord, modelUrl } = await request.json();

    // Insert the model into the database
    const { data: model, error } = await supabase
      .from('models')
      .insert({
        name: modelName,
        user_id: user.id,
        status: 'finished',
        modelId: trainingId,
        type: 'raw-tune',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save model', details: error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      model,
      message: 'Model added successfully'
    });

  } catch (error) {
    console.error('Manual add error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}