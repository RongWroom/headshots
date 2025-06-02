import { useState, useEffect } from 'react';
import { ImageInspectionResult } from '@/lib/imageInspection';
import { Loader2 } from 'lucide-react';

export interface ImageInspectorProps {
  analysisResult?: ImageInspectionResult; // Make it optional to handle loading state in parent
  // type prop might still be needed if we want to compare detected vs expected type
  expectedType?: string; 
}

export function ImageInspector({ analysisResult, expectedType }: ImageInspectorProps) {
  const [issues, setIssues] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!analysisResult);

  useEffect(() => {
    if (analysisResult) {
      setIsLoading(false);
      const detectedIssues: string[] = [];

      if (analysisResult.selfie) {
        detectedIssues.push('Selfie');
      }
      if (analysisResult.blurry) {
        detectedIssues.push('Image is blurry');
      }
      if (analysisResult.includes_multiple_people) {
        detectedIssues.push('Multiple people');
      }
      if (analysisResult.full_body_image_or_longshot) {
        detectedIssues.push('Image is not a close-up');
      }
      if (analysisResult.wearing_sunglasses) {
        detectedIssues.push('Wearing sunglasses');
      }
      if (analysisResult.wearing_hat) {
        detectedIssues.push('Wearing hat');
      }
      if (analysisResult.funny_face) {
        detectedIssues.push('Funny face');
      }
      // Retain type comparison if expectedType is provided
      if (expectedType && analysisResult.name && analysisResult.name.toLowerCase() !== expectedType.toLowerCase()) {
         detectedIssues.push(`Detected ${analysisResult.name}, expected ${expectedType}`);
      }
      
      setIssues(detectedIssues);
    } else {
      setIsLoading(true);
      setIssues([]); // Clear issues if analysisResult is not yet available
    }
  }, [analysisResult, expectedType]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
        <Loader2 className="h-3 w-3 animate-spin" />
        Inspecting image...
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="text-xs text-green-600">
        ✓ Image looks good
      </div>
    );
  }

  return (
    <ul className="text-xs w-16 text-wrap pl-2">
      {issues.map((issue, index) => (
        <li key={index} className="text-yellow-500">⚠️{issue}</li>
      ))}
    </ul>
  );
}


