import TrainModelZone from "@/components/TrainModelZone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { FC } from 'react';

const packsIsEnabled = process.env.NEXT_PUBLIC_TUNE_TYPE === "packs";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

// No need for extending PageProps since we're directly using its type
export default async function TrainModelPage(props: PageProps) {
  // Await params to get the actual object
  const params = await props.params;
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        id="train-model-container"
        className="flex flex-1 flex-col gap-2 px-2"
      >
        <Link href={packsIsEnabled ? "/overview/packs" : "/overview"} className="text-sm w-fit">
          <Button variant={"outline"}>
            <FaArrowLeft className="mr-2" />
            Go Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Train Model</CardTitle>
            <CardDescription>
              Choose a name, type, and upload some photos to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <TrainModelZone packSlug={params.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
