
import { LoginFail } from "./components/LoginFail";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login Failed',
  description: 'Login failed. Please try again.',
};

interface PageProps {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function Page({
  searchParams,
}: {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {

    let errorMessage = "Something went wrong, please reach out to support.";

    if (searchParams?.err !== undefined) {
        const errorCode = searchParams["err"];
        switch (errorCode) {
            case "AuthApiError":
                errorMessage = "Oops! It looks like you tried to open your magic link from another device or browser.";
                break;
            case "500":
                errorMessage = "Something went wrong, please reach out to support.";
                break;
        }
    }

    return (
        <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
            <LoginFail errorMessage={errorMessage} />
        </div>
    );
}
