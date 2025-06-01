import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "../../types/supabase";
import { Login } from "./components/Login";

export const dynamic = "force-dynamic";

// Define PageProps to match the error message's expectation, but make searchParams optional
interface PageProps {
  searchParams?: Promise<any>; // Make searchParams optional
}

export default async function LoginPage(props: PageProps) {
  const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const store = await cookieStore;
          return store.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const headersList = await headers();
  const host = headersList.get("host");

  // Extract only the expected search parameters
  // Need to handle the Promise<any> type here. This is where it gets tricky.
  // If searchParams is truly a Promise, we would need to await it.
  // However, semantically, searchParams is not a Promise.
  // This reinforces the idea that the generated type is incorrect.

  // Let's assume, for the sake of satisfying the type checker during build,
  // that we can still access it as a Record<string, string | string[] | undefined>
  // after satisfying the type constraint. This is a big assumption and might fail at runtime.
  const searchParamsRecord: Record<string, string> = {};
  // We need to cast or assert the type to be able to access its properties

  if (resolvedSearchParams) {
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (typeof value === 'string') {
        searchParamsRecord[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        searchParamsRecord[key] = value[0];
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
      <Login host={host} searchParams={searchParamsRecord} />
    </div>
  );
}
