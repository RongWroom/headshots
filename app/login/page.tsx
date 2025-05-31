import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "../../types/supabase";
import { Login } from "./components/Login";

export const dynamic = "force-dynamic";

// Remove custom type definitions
// type SearchParamValue = string | string[] | undefined;
// type SearchParams = Record<string, SearchParamValue>;
// interface PageProps {
//   searchParams: SearchParams;
// }

// Update function signature to use inline typing
export default async function LoginPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const headersList = await headers();
  const host = headersList.get("host");

  // Extract only the expected search parameters
  const searchParamsRecord: Record<string, string> = {};
  if (searchParams) { // Use the searchParams from the function arguments
    for (const [key, value] of Object.entries(searchParams)) {
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
