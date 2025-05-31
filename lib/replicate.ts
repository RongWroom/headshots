import axios from 'axios';

const REPLICATE_API_URL = 'https://api.replicate.com/v1';

interface TrainingInput {
  input_images: string[];
  training_steps?: number;
  learning_rate?: number;
  resolution?: number;
}

export async function trainModel(images: string[], modelName: string, options?: {
  training_steps?: number;
  learning_rate?: number;
  resolution?: number;
}) {
  const response = await axios.post(
    `${REPLICATE_API_URL}/trainings`,
    {
      version: "replicate/flux-fast-trainer:latest",
      input: {
        input_images: images,
        training_steps: options?.training_steps || 1000,
        learning_rate: options?.learning_rate || 1e-6,
        resolution: options?.resolution || 768,
      },
      destination: `${process.env.REPLICATE_USERNAME}/${modelName}`,
    },
    {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

export async function generateImage(
  modelVersion: string,
  prompt: string,
  negativePrompt: string = "",
  numOutputs: number = 1
) {
  const response = await axios.post(
    `${REPLICATE_API_URL}/predictions`,
    {
      version: modelVersion,
      input: {
        prompt,
        negative_prompt: negativePrompt,
        num_outputs: numOutputs,
      },
    },
    {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

export async function getTrainingStatus(trainingId: string) {
  const response = await axios.get(
    `${REPLICATE_API_URL}/trainings/${trainingId}`,
    {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    }
  );

  return response.data;
}
