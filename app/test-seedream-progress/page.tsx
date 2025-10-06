'use client';

import { useState } from 'react';
import SeedreamGenerationProgress from '@/components/SeedreamGenerationProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TestSeedreamProgressPage() {
  const [jobId, setJobId] = useState<string>('');
  const [testJobId, setTestJobId] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleStartTest = () => {
    if (!jobId.trim()) {
      alert('Please enter a job ID');
      return;
    }
    setTestJobId(jobId);
    setOutputs([]);
    setError(null);
  };

  const handleComplete = (generatedOutputs: any[]) => {
    console.log('Generation complete!', generatedOutputs);
    setOutputs(generatedOutputs);
  };

  const handleError = (err: string) => {
    console.error('Generation failed:', err);
    setError(err);
  };

  const handleCancel = () => {
    console.log('User cancelled generation');
    setTestJobId(null);
  };

  const handleReset = () => {
    setTestJobId(null);
    setJobId('');
    setOutputs([]);
    setError(null);
  };

  // Example job IDs for testing
  const exampleJobIds = [
    { label: 'Valid Job ID', value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    { label: 'Invalid Format', value: 'invalid-job-id' },
    { label: 'Non-existent', value: '00000000-0000-0000-0000-000000000000' },
  ];

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Seedream Progress Component Test</h1>
        <p className="text-muted-foreground">
          Test the SeedreamGenerationProgress component with different job IDs
        </p>
      </div>

      {!testJobId ? (
        <Card>
          <CardHeader>
            <CardTitle>Start Test</CardTitle>
            <CardDescription>
              Enter a job ID to test the progress component
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobId">Job ID</Label>
              <Input
                id="jobId"
                placeholder="Enter job ID (UUID format)"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Example Job IDs:</Label>
              <div className="flex flex-wrap gap-2">
                {exampleJobIds.map((example) => (
                  <Button
                    key={example.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setJobId(example.value)}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={handleStartTest} className="w-full">
              Start Progress Test
            </Button>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h3 className="font-semibold mb-2">How to get a real job ID:</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Go to the Seedream generation page</li>
                <li>Upload images and start a generation</li>
                <li>Copy the job ID from the URL or response</li>
                <li>Paste it here to test the progress component</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <SeedreamGenerationProgress
            jobId={testJobId}
            onComplete={handleComplete}
            onError={handleError}
            onCancel={handleCancel}
            pollInterval={3000}
            maxPollDuration={10 * 60 * 1000}
          />

          <Card>
            <CardHeader>
              <CardTitle>Test Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Reset Test
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p><strong>Testing Job ID:</strong> {testJobId}</p>
                <p><strong>Status:</strong> {outputs.length > 0 ? 'Completed' : error ? 'Failed' : 'In Progress'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Results Display */}
          {outputs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generation Results</CardTitle>
                <CardDescription>
                  {outputs.length} image(s) generated successfully
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {outputs.map((output, index) => (
                    <div key={index} className="space-y-2">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                        <img
                          src={output.url}
                          alt={`Result ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">
                        Image {index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Error Occurred</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{error}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Console Log Display */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>What to test:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Progress bar updates smoothly</li>
            <li>Elapsed time increments every second</li>
            <li>Estimated time remaining displays</li>
            <li>Phase transitions (initializing → uploading → processing → finalizing)</li>
            <li>Completed state shows success message</li>
            <li>Failed state shows error message</li>
            <li>Cancel button works</li>
            <li>Retry logic on connection errors</li>
          </ul>
          <p className="mt-4"><strong>Check browser console for:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>API request logs</li>
            <li>Status updates</li>
            <li>Error messages</li>
            <li>Callback executions</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
