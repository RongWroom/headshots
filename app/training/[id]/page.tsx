import TrainingStatusClient from './TrainingStatusClient';

// Using the correct type definition for Next.js App Router
type PageProps = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function TrainingStatusPage({ params }: PageProps) {
  return <TrainingStatusClient trainingId={params.id} />;
}
