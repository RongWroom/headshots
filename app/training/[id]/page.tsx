import TrainingStatusClient from './TrainingStatusClient';

// Using the correct type definition for Next.js App Router
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TrainingStatusPage(props: PageProps) {
  const params = await props.params;
  return <TrainingStatusClient trainingId={params.id} />;
}
