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

    if (!uploadResponse.data?.url) {
      throw new Error('Failed to upload image: No URL returned');
    }

    const imageUrl = uploadResponse.data.url;
    
    // Then, analyze the image using Replicate
    const analysisResponse = await axios.post('/api/replicate/analyze-image', {
      imageUrl,
      analysisType: type
    });

    // Log the full response for debugging
    console.log('Analysis response:', analysisResponse.data);

    // Extract the analysis text from the response
    const analysisText = analysisResponse.data.analysis?.join(' ') || '';
    
    // Simple heuristic checks based on the analysis text
    const isSelfie = analysisText.toLowerCase().includes('selfie') || 
                    analysisText.toLowerCase().includes('self-portrait');
    const isBlurry = analysisText.toLowerCase().includes('blur') || 
                    analysisText.toLowerCase().includes('unclear');
    const hasMultiplePeople = (analysisText.match(/person|people|faces?/gi) || []).length > 1;
    const isFullBody = analysisText.toLowerCase().includes('full body') || 
                      analysisText.toLowerCase().includes('full-body');
    const hasSunglasses = analysisText.toLowerCase().includes('sunglasses') || 
                         analysisText.toLowerCase().includes('wearing glasses');
    const hasHat = analysisText.toLowerCase().includes('hat') || 
                  analysisText.toLowerCase().match(/wearing a (hat|cap)/i);
    const isFunnyFace = analysisText.toLowerCase().includes('funny') || 
                       analysisText.toLowerCase().includes('silly');

    // Extract basic attributes
    const ageMatch = analysisText.match(/(\d+)\s*(?:year|yr)s?\s*old/i);
    const genderMatch = analysisText.match(/(man|woman|male|female|person|boy|girl)/i);
    const hairColorMatch = analysisText.match(/(blonde|brunette|black|brown|red|gray|grey|white) hair/i);
    const eyeColorMatch = analysisText.match(/(blue|brown|green|hazel|gray|grey) eyes?/i);
    const ethnicityMatch = analysisText.match(/(caucasian|asian|african|hispanic|latino|middle eastern|indian)/i);

    return {
      age: ageMatch ? ageMatch[1] : undefined,
      blurry: isBlurry,
      ethnicity: ethnicityMatch ? ethnicityMatch[1] : undefined,
      eye_color: eyeColorMatch ? eyeColorMatch[1] : undefined,
      facial_hair: analysisText.toLowerCase().includes('beard') || 
                  analysisText.toLowerCase().includes('mustache') ? 'yes' : 'no',
      full_body_image_or_longshot: isFullBody,
      funny_face: isFunnyFace,
      glasses: hasSunglasses ? 'sunglasses' : 
              analysisText.toLowerCase().includes('glasses') ? 'yes' : 'no',
      hair_color: hairColorMatch ? hairColorMatch[1] : undefined,
      hair_length: analysisText.match(/(short|medium|long) hair/i)?.[1]?.toLowerCase(),
      hair_style: analysisText.match(/(straight|curly|wavy|braided|dreadlocks|afro)/i)?.[1]?.toLowerCase(),
      includes_multiple_people: hasMultiplePeople,
      is_bald: analysisText.toLowerCase().includes('bald') ? 'yes' : 'no',
      name: genderMatch ? genderMatch[1] : undefined,
      selfie: isSelfie,
      wearing_hat: hasHat,
      wearing_sunglasses: hasSunglasses,
    };
    
  } catch (error) {
    console.error('Image inspection failed:', error);
    // Return a default response with minimal information if analysis fails
    return {
      blurry: false,
      full_body_image_or_longshot: false,
      funny_face: false,
      includes_multiple_people: false,
      selfie: false,
      wearing_hat: false,
      wearing_sunglasses: false,
    };
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
