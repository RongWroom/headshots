import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "../../types/supabase";
import { Login } from "./components/Login";

export const dynamic = "force-dynamic";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

interface LoginPageProps {
  searchParams?: SearchParams;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const headersList = await headers();
  const host = headersList.get("host");

  // Convert searchParams to a plain object if it's a URLSearchParams instance
  const searchParamsObj = searchParams ? { ...searchParams } : {};

  return (
    <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
      <Login host={host} searchParams={searchParamsObj} />
    </div>
  );
}
