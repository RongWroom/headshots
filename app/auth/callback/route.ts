import { Database } from "@/types/supabase";
import { createServerClient } from "@supabase/ssr";
import { isAuthApiError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { CookieOptions } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const next = requestUrl.searchParams.get("next") || "/";
  const error_description = requestUrl.searchParams.get("error_description");

  if (error) {
    console.error("Auth callback error: ", {
      error,
      error_description,
      code,
      requestUrl: req.url
    });

    // Redirect to a more specific error page based on the error
    return NextResponse.redirect(`${requestUrl.origin}/login/failed?err=${error}&desc=${error_description || 'Unknown error'}`);
  }

  // Create a response object that we'll modify as we go
  let response = NextResponse.redirect(new URL(next, req.url));

  if (code) {
    // Create a Supabase client with proper cookie handling for Next.js App Router
    const cookieStore = cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            // In App Router, we need to use the synchronous version
            const cookie = (await cookieStore).get(name);
            return cookie?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // In App Router, we need to use the synchronous version
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: CookieOptions) {
            // In App Router, we need to use the synchronous version
            response.cookies.set({
              name,
              value: "",
              ...options,
              maxAge: 0,
            });
          },
        },
      }
    );

    try {
      // Exchange the code for a session and log success/failure
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Failed to exchange code for session:", error);
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=SessionExchangeError&desc=${error.message}`
        );
      }

      console.log("Successfully exchanged code for session", {
        session: data.session ? "Session established" : "No session",
        user: data.user ? "User retrieved" : "No user"
      });

      // After exchanging the code, check if the user has a feature-flag row and credits
      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "[login] [session] [500] Error getting user: ",
          userError
        );
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=500`
        );
      }
    } catch (error) {
      if (isAuthApiError(error)) {
        console.error(
          "[login] [session] [500] Error exchanging code for session: ",
          error
        );
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=AuthApiError`
        );
      } else {
        console.error("[login] [session] [500] Something wrong: ", error);
        return NextResponse.redirect(
          `${requestUrl.origin}/login/failed?err=500`
        );
      }
    }

    // Verify the session was established before redirecting
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error("Session not established after code exchange");
      return NextResponse.redirect(`${requestUrl.origin}/login/failed?err=NoSession`);
    }

    console.log("Authentication successful, redirecting to", next);
  }

  return response; // Return the response with cookies set
}
