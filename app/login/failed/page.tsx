
import { LoginFail } from "./components/LoginFail";

// Define PageProps to align with Vercel's apparent expectations
type PageProps = {
  params: Promise<any>; // Based on original error for params
  searchParams?: Promise<any>; // Based on current error for searchParams
};

export default async function Page(props: PageProps) {
    // Await searchParams to get the actual object.
    // We cast to a more specific type for use within the component.
    const actualSearchParams: { [key: string]: string | string[] | undefined } | undefined = await props.searchParams;
    
    // props.params is typed as Promise<any> but not used in this component's logic.
    // If it were used: const resolvedParams = await props.params;

    let errorMessage = "Something went wrong, please reach out to support.";

    if (actualSearchParams?.err !== undefined) {
        const errValue = actualSearchParams.err;
        // Ensure errorCode is treated as a string for the switch statement
        const errorCode = Array.isArray(errValue) ? errValue[0] : errValue;
        switch (errorCode) {
            case "AuthApiError":
                errorMessage = "Oops! It looks like you tried to open your magic link from another device or browser.";
                break;
            case "500":
                errorMessage = "Something went wrong, please reach out to support.";
                break;
            default:
                // Optional: handle unknown error codes or log them
                console.warn(`Unknown error code: ${errorCode}`);
                break;
        }
    }

    return (
        <div className="flex flex-col flex-1 w-full h-[calc(100vh-73px)]">
            <LoginFail errorMessage={errorMessage} />
        </div>
    );
}
