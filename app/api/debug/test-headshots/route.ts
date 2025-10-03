import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    console.log('🧪 TEST: Starting headshots test');

    // Test 1: Environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasRunpodEndpoint = !!process.env.RUNPOD_INFERENCE_ENDPOINT;
    const hasRunpodKey = !!process.env.RUNPOD_API_KEY;

    console.log('🧪 TEST: Environment check', { hasSupabaseUrl, hasSupabaseKey, hasRunpodEndpoint, hasRunpodKey });

    // Test 2: Supabase client creation
    let supabaseError = null;
    let supabase;
    try {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return req.headers.get('cookie')?.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
            },
            set() { },
            remove() { },
          },
        }
      );
      console.log('🧪 TEST: Supabase client created');
    } catch (error) {
      supabaseError = error instanceof Error ? error.message : 'Unknown error';
      console.log('🧪 TEST: Supabase client error:', supabaseError);
    }

    // Test 3: Authentication
    let authError = null;
    let user = null;
    if (supabase) {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        user = authUser;
        authError = error?.message;
        console.log('🧪 TEST: Auth check', { hasUser: !!user, authError });
      } catch (error) {
        authError = error instanceof Error ? error.message : 'Unknown error';
        console.log('🧪 TEST: Auth error:', authError);
      }
    }

    // Test 4: Request parsing
    let requestBody = null;
    let parseError = null;
    try {
      requestBody = await req.json();
      console.log('🧪 TEST: Request parsed', { hasModelId: !!requestBody.modelId, hasPrompt: !!requestBody.prompt });
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'Unknown error';
      console.log('🧪 TEST: Parse error:', parseError);
    }

    // Test 5: Model lookup (if authenticated)
    let modelError = null;
    let model = null;
    if (supabase && user && requestBody?.modelId) {
      try {
        const { data, error } = await supabase
          .from('models')
          .select('*')
          .eq('id', requestBody.modelId)
          .eq('user_id', user.id)
          .single();
        
        model = data;
        modelError = error?.message;
        console.log('🧪 TEST: Model lookup', { hasModel: !!model, modelError });
      } catch (error) {
        modelError = error instanceof Error ? error.message : 'Unknown error';
        console.log('🧪 TEST: Model lookup error:', modelError);
      }
    }

    return NextResponse.json({
      test: 'headshots-debug',
      timestamp: new Date().toISOString(),
      results: {
        environment: {
          hasSupabaseUrl,
          hasSupabaseKey,
          hasRunpodEndpoint,
          hasRunpodKey
        },
        supabase: {
          created: !supabaseError,
          error: supabaseError
        },
        authentication: {
          authenticated: !!user,
          userId: user?.id,
          email: user?.email,
          error: authError
        },
        request: {
          parsed: !parseError,
          modelId: requestBody?.modelId,
          hasPrompt: !!requestBody?.prompt,
          error: parseError
        },
        model: {
          found: !!model,
          modelName: model?.name,
          modelStatus: model?.status,
          error: modelError
        }
      }
    });

  } catch (error) {
    console.log('🧪 TEST: Fatal error:', error);
    return NextResponse.json({
      test: 'headshots-debug',
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}