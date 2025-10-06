'use client';

import SeedreamWorkflow from '@/components/SeedreamWorkflow';

export default function SeedreamDemoPage() {
  const handleComplete = (outputs: Array<{ url: string; thumbnail: string }>) => {
    console.log('✅ Generation complete!', outputs.length, 'headshots generated');
    
    // You could add analytics tracking here
    // trackEvent('seedream_generation_complete', { count: outputs.length });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto py-12 px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Professional AI Headshots
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload your casual photos and get stunning professional headshots in minutes.
            Perfect for LinkedIn, resumes, and business profiles.
          </p>
        </div>

        {/* Workflow Component */}
        <SeedreamWorkflow onComplete={handleComplete} />

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-semibold mb-2">Fast Generation</h3>
            <p className="text-sm text-muted-foreground">
              Get 10 professional headshots in just 60-90 seconds
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎨</span>
            </div>
            <h3 className="font-semibold mb-2">Multiple Styles</h3>
            <p className="text-sm text-muted-foreground">
              Choose from corporate, creative, and casual backgrounds
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="font-semibold mb-2">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">
              Advanced AI ensures natural-looking, professional results
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
