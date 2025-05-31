import axios from 'axios';

export interface ImageInspectionResult {
  age?: string;
  blurry: boolean;
  ethnicity?: string;
  eye_color?: string;
  facial_hair?: string;
  full_body_image_or_longshot: boolean;
  funny_face: boolean;
  glasses?: string;
  hair_color?: string;
  hair_length?: string;
  hair_style?: string;
  includes_multiple_people: boolean;
  is_bald?: string;
  name?: string;
  selfie: boolean;
  wearing_hat: boolean;
  wearing_sunglasses: boolean;
}

export async function inspectImage(file: File, type: string): Promise<ImageInspectionResult> {
  try {
    // First, upload the image to a temporary location
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadResponse = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const imageUrl = uploadResponse.data.url;
    
    // Then, analyze the image using Replicate
    const analysisResponse = await axios.post('/api/replicate/analyze-image', {
      imageUrl,
      analysisType: type
    });

    // Map Replicate's response to our expected format
    const replicateData = analysisResponse.data;
    
    return {
      age: replicateData.age,
      blurry: replicateData.quality?.blurry || false,
      ethnicity: replicateData.demographics?.ethnicity,
      eye_color: replicateData.features?.eyes?.color,
      facial_hair: replicateData.features?.facial_hair?.present ? 'yes' : 'no',
      full_body_image_or_longshot: replicateData.composition?.full_body || false,
      funny_face: replicateData.expression?.funny || false,
      glasses: replicateData.accessories?.glasses ? 'yes' : 'no',
      hair_color: replicateData.features?.hair?.color,
      hair_length: replicateData.features?.hair?.length,
      hair_style: replicateData.features?.hair?.style,
      includes_multiple_people: replicateData.detection?.people_count > 1,
      is_bald: replicateData.features?.hair?.bald ? 'yes' : 'no',
      selfie: replicateData.composition?.is_selfie || false,
      wearing_hat: replicateData.accessories?.hat || false,
      wearing_sunglasses: replicateData.accessories?.sunglasses || false,
    };
    
  } catch (error) {
    console.error('Image inspection failed:', error);
    throw error;
  }
}

async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 512;
        let width = img.width;
        let height = img.height;

        if (width <= maxDimension && height <= maxDimension) {
          resolve(file);
          return;
        }

        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob conversion failed'));
          },
          file.type,
          0.9
        );
      };

      img.onerror = reject;
      if (e.target) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('FileReader event target is null'));
      }
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function aggregateCharacteristics(results: ImageInspectionResult[]): Record<string, string> {
  const aggregated: Record<string, string[]> = {};
  
  results.forEach((result) => {
    Object.entries(result).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (aggregated[key]) {
          aggregated[key].push(value);
        } else {
          aggregated[key] = [value];
        }
      }
    });
  });

  const commonValues: Record<string, string> = {};
  Object.entries(aggregated).forEach(([key, values]) => {
    const mostCommonValue = values.sort((a, b) => 
      values.filter(v => v === a).length - values.filter(v => v === b).length
    ).pop();
    if (mostCommonValue) {
      commonValues[key] = mostCommonValue;
    }
  });

  return commonValues;
}
