import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "../../types/supabase";
import { Login } from "./components/Login";

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue>;

interface PageProps {
  searchParams: SearchParams;
}

export default async function LoginPage(props: PageProps) {
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
  const searchParams: Record<string, string> = {};
  if (props.searchParams) {
    for (const [key, value] of Object.entries(props.searchParams)) {
      if (typeof value === 'string') {
        searchParams[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        searchParams[key] = value[0];
      }
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
      <Login host={host} searchParams={searchParams} />
    </div>
  );
}
