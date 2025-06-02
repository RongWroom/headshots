import TrainingStatusClient from './TrainingStatusClient';

export default function TrainingStatusPage({ params }: { params: { id: string } }) {
  return <TrainingStatusClient trainingId={params.id} />;
}
