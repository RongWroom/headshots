import TrainingStatusClient from './TrainingStatusClient';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function TrainingStatusPage({ params }: PageProps) {
  return <TrainingStatusClient trainingId={params.id} />;
}
