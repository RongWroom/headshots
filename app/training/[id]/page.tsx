import TrainingStatusClient from './TrainingStatusClient';

interface PageProps {
  params: {
    id: string;
  };
}

export default function TrainingStatusPage({ params }: PageProps) {
  return <TrainingStatusClient trainingId={params.id} />;
}
