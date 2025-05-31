
import { LoginFail } from "./components/LoginFail";
import type { Metadata } from 'next';

interface Props {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export const metadata: Metadata = {
  title: 'Login Failed',
  description: 'Login failed. Please try again.',
};

export default async function LoginFailedPage({
    searchParams,
}: Props) {

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
