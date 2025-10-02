"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GenerateHeadshotsZoneProps {
  modelId: number;
  modelName: string;
}

const packOptions = [
  {
    id: "actor-headshots",
    name: "Actor Headshots",
    description: "Dramatic lighting, cinematic style"
  },
  {
    id: "corporate-headshots", 
    name: "Corporate Headshots",
    description: "Professional, clean background"
  },
  {
    id: "creative-headshots",
    name: "Creative Headshots", 
    description: "Artistic lighting, modern style"
  }
];

export default function GenerateHeadshotsZone({ modelId, modelName }: GenerateHeadshotsZoneProps) {
  const [selectedPack, setSelectedPack] = useState("corporate-headshots");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!selectedPack) {
      toast({
        title: "Pack required",
        description: "Please select a headshot style pack",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate/headshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId,
          prompt: customPrompt || "professional headshot",
          packSlug: selectedPack,
          numOutputs: 4
        })
      });

      const result = await response.json();

      if (result.success) {
        setGenerationResult(result);
        toast({
          title: "Generation started!",
          description: result.message,
        });
      } else {
        throw new Error(result.error || 'Generation failed');
      }

    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Professional Headshots</CardTitle>
          <CardDescription>
            Create professional headshots using your trained model: <strong>{modelName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Pack Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Choose Your Style</Label>
            <RadioGroup
              value={selectedPack}
              onValueChange={setSelectedPack}
              className="grid grid-cols-1 gap-4"
            >
              {packOptions.map((pack) => (
                <div key={pack.id} className="flex items-center space-x-3 border rounded-lg p-4">
                  <RadioGroupItem value={pack.id} id={pack.id} />
                  <div className="flex-1">
                    <Label htmlFor={pack.id} className="font-medium cursor-pointer">
                      {pack.name}
                    </Label>
                    <p className="text-sm text-muted-foreground">{pack.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-base font-medium">
              Additional Details (Optional)
            </Label>
            <Input
              id="prompt"
              placeholder="e.g., smiling, looking confident, outdoor setting"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-sm text-muted-foreground">
              Add specific details about pose, expression, or setting
            </p>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPack}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Generating Headshots...</span>
              </div>
            ) : (
              "Generate 4 Professional Headshots"
            )}
          </Button>

          {/* Generation Result */}
          {generationResult && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="font-medium text-green-800">✅ Generation Started!</p>
                  <p className="text-sm text-green-700">
                    Your headshots are being created with the photographer's signature style.
                  </p>
                  <p className="text-sm text-green-600">
                    Estimated time: {generationResult.estimatedTime}
                  </p>
                  <p className="text-xs text-green-600 font-mono">
                    Job ID: {generationResult.generationId}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="font-medium text-blue-800">🎨 Signature Style Applied</p>
                <p className="text-sm text-blue-700">
                  Your headshots will automatically include the photographer's unique lighting, 
                  composition, and aesthetic style, combined with your facial features.
                </p>
              </div>
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}