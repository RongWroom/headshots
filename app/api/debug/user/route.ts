import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Create Supabase client
    const supabase = createServerClient(
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

    // Get current user
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({
        authenticated: false,
        error: error?.message || 'No user found',
        debug: {
          hasAuthHeader: !!req.headers.get('authorization'),
          hasCookieHeader: !!req.headers.get('cookie'),
          cookies: req.headers.get('cookie')?.split('; ').map(c => c.split('=')[0])
        }
      });
    }

    // Get user's models
    const { data: models, error: modelsError } = await supabase
      .from('models')
      .select('id, name, type, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      models: models || [],
      modelsError: modelsError?.message,
      availableModelIds: (models || []).map(m => m.id),
      debug: {
        totalModels: models?.length || 0,
        hasFinishedModels: (models || []).some(m => m.status === 'finished')
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}