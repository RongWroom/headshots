import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Database } from "../../types/supabase";
import { Login } from "./components/Login";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { [key: string]: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function LoginPage({ searchParams }: PageProps) {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const headersList = headers();
  const host = (await headersList).get("host");

  return (
    <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
      <Login host={host} searchParams={searchParams} />
    </div>
  );
}
