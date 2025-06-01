"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/types/supabase";
import { createBrowserClient } from "@supabase/ssr";
import disposableDomains from "disposable-email-domains";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { AiOutlineGoogle } from "react-icons/ai";
import { WaitingForMagicLink } from "./WaitingForMagicLink";

type Inputs = {
  email: string;
};

interface LoginProps {
  host: string | null;
  searchParams?: Record<string, string>;
}

export const Login = ({
  host,
  searchParams,
}: LoginProps) => {
  // Initialize Supabase client with proper error handling
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Log Supabase initialization for debugging
  console.log('Supabase client initialized with URL:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Don't log the full key for security reasons
    keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<Inputs>();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(data.email);
      setTimeout(() => {
        setIsSubmitting(false);
        toast({
          title: "Email sent",
          description: "Check your inbox for a magic link to sign in.",
          duration: 5000,
        });
        setIsMagicLinkSent(true);
      }, 1000);
    } catch (error: any) {
      setIsSubmitting(false);
      console.error('Login error:', error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Please try again, if the problem persists, contact us at hello@tryleap.ai";
      
      if (error?.message) {
        if (error.message.includes('rate limit')) {
          errorMessage = "Too many attempts. Please wait a few minutes before trying again.";
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = "Invalid email address. Please check and try again.";
        } else if (error.message.includes('Email link is invalid')) {
          errorMessage = "The magic link is invalid or has expired. Please request a new one.";
        }
      }
      
      toast({
        title: "Authentication Error",
        variant: "destructive",
        description: errorMessage,
        duration: 5000,
      });
    }
  };

  let inviteToken = null;
  if (searchParams && "inviteToken" in searchParams) {
    inviteToken = searchParams["inviteToken"];
  }

  const protocol = host?.includes("localhost") ? "http" : "https";
  const redirectUrl = `${protocol}://${host}/auth/callback`;

  console.log({ redirectUrl });

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    console.log(data, error);
  };

  const signInWithMagicLink = async (email: string) => {
    console.log('Attempting to sign in with magic link', { 
      email, 
      redirectUrl,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL 
    });
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error(`Authentication Error: ${error.message}`, error);
      // Log additional details that might help debugging
      console.error('Error details:', {
        status: error.status,
        name: error.name,
        code: error?.code
      });
      throw error; // Make sure to throw the error so it can be caught by the try/catch block
    }
  };

  if (isMagicLinkSent) {
    return (
      <WaitingForMagicLink toggleState={() => setIsMagicLinkSent(false)} />
    );
  }

  return (
    <>
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col gap-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 p-4 rounded-xl max-w-sm w-full">
          <h1 className="text-xl">Welcome</h1>
          <p className="text-xs opacity-60">
            Sign in or create an account to get started.
          </p>
          {/* <Button
            onClick={signInWithGoogle}
            variant={"outline"}
            className="font-semibold"
          >
            <AiOutlineGoogle size={20} />
            Continue with Google
          </Button>
          <OR /> */}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input
                  type="email"
                  placeholder="Email"
                  {...register("email", {
                    required: true,
                    validate: {
                      emailIsValid: (value: string) =>
                        /^[A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value) ||
                        "Please enter a valid email",
                      emailDoesntHavePlus: (value: string) =>
                        /^[A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value) ||
                        "Email addresses with a '+' are not allowed",
                      emailIsntDisposable: (value: string) =>
                        !disposableDomains.includes(value.split("@")[1]) ||
                        "Please use a permanent email address",
                    },
                  })}
                />
                {isSubmitted && errors.email && (
                  <span className={"text-xs text-red-400"}>
                    {errors.email?.message || "Email is required to sign in"}
                  </span>
                )}
              </div>
            </div>

            <Button
              isLoading={isSubmitting}
              disabled={isSubmitting}
              variant="outline"
              className="w-full"
              type="submit"
            >
              Continue with Email
            </Button>
          </form>
        </div>
      </div>
    </>
  );
};

export const OR = () => {
  return (
    <div className="flex items-center my-1">
      <div className="border-b flex-grow mr-2 opacity-50" />
      <span className="text-sm opacity-50">OR</span>
      <div className="border-b flex-grow ml-2 opacity-50" />
    </div>
  );
};
