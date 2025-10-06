'use client';

import React, { useState } from 'react';
import SeedreamUploadZone from '@/components/SeedreamUploadZone';
import SeedreamCustomizationUI from '@/components/SeedreamCustomizationUI';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadedImage, SeedreamCustomizations } from '@/types/seedream';

export default function SeedreamTestPage() {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [customizations, setCustomizations] = useState<SeedreamCustomizations>({
    removeJewelry: false,
    removeGlasses: false,
    removePiercings: false,
    cleanBackground: false,
  });

  const handleUploadComplete = (id: string, images: UploadedImage[]) => {
    console.log('Upload complete:', { id, images });
    setUploadId(id);
    setUploadedImages(images);
  };

  const handleCustomizationsChange = (newCustomizations: SeedreamCustomizations) => {
    console.log('Customizations changed:', newCustomizations);
    setCustomizations(newCustomizations);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Seedream Upload Test</h1>
        <p className="text-gray-600">
          Test the Seedream upload component functionality
        </p>
      </div>

      <div className="space-y-6">
        <SeedreamUploadZone
          onUploadComplete={handleUploadComplete}
          maxFiles={5}
          minFiles={1}
        />

        {uploadId && (
          <>
            <SeedreamCustomizationUI
              customizations={customizations}
              onCustomizationsChange={handleCustomizationsChange}
            />

            <Card>
              <CardHeader>
                <CardTitle>Upload Result</CardTitle>
                <CardDescription>
                  Upload ID and image details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Upload ID:</p>
                    <p className="text-sm text-gray-600 font-mono">{uploadId}</p>
                  </div>
                  <div>
                    <p className="font-medium">Uploaded Images:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {uploadedImages.map((img, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          {img.filename} - {(img.size / 1024).toFixed(2)} KB
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Customizations:</p>
                    <pre className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
                      {JSON.stringify(customizations, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
