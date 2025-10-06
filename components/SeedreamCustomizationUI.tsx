'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle, Sparkles } from 'lucide-react';
import { SeedreamCustomizations } from '@/types/seedream';

interface SeedreamCustomizationUIProps {
  customizations: SeedreamCustomizations;
  onCustomizationsChange: (customizations: SeedreamCustomizations) => void;
  disabled?: boolean;
}

interface CustomizationOption {
  id: keyof SeedreamCustomizations;
  label: string;
  description: string;
  tooltip: string;
}

const CUSTOMIZATION_OPTIONS: CustomizationOption[] = [
  {
    id: 'removeJewelry',
    label: 'Remove jewelry',
    description: 'Earrings, necklaces, rings, bracelets',
    tooltip: 'The AI will generate headshots without visible jewelry like earrings, necklaces, rings, or bracelets for a clean professional look.',
  },
  {
    id: 'removeGlasses',
    label: 'Remove glasses',
    description: 'Eyeglasses and sunglasses',
    tooltip: 'The AI will generate headshots without glasses or sunglasses, showing your eyes clearly.',
  },
  {
    id: 'removePiercings',
    label: 'Remove piercings',
    description: 'Nose rings, lip rings, eyebrow rings',
    tooltip: 'The AI will generate headshots without visible piercings like nose rings, lip rings, or eyebrow rings.',
  },
  {
    id: 'cleanBackground',
    label: 'Clean background',
    description: 'Remove distracting elements',
    tooltip: 'The AI will ensure a clean, professional background by removing any cluttered or distracting elements.',
  },
];

export default function SeedreamCustomizationUI({
  customizations,
  onCustomizationsChange,
  disabled = false,
}: SeedreamCustomizationUIProps) {
  const handleCheckboxChange = (id: keyof SeedreamCustomizations, checked: boolean) => {
    onCustomizationsChange({
      ...customizations,
      [id]: checked,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Customize Your Headshots
        </CardTitle>
        <CardDescription>
          Select options to refine your professional headshots
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-4">
            {CUSTOMIZATION_OPTIONS.map((option) => (
              <div
                key={option.id}
                className="flex items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  id={option.id}
                  checked={customizations[option.id] || false}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(option.id, checked as boolean)
                  }
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={option.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => e.preventDefault()}
                        >
                          <HelpCircle className="h-4 w-4" />
                          <span className="sr-only">More information</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="max-w-xs"
                        sideOffset={5}
                      >
                        <p className="text-sm">{option.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary of selected options */}
          {Object.values(customizations).some((value) => value) && (
            <div className="mt-6 rounded-lg bg-primary/10 p-4">
              <p className="text-sm font-medium mb-2">Selected customizations:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {CUSTOMIZATION_OPTIONS.filter(
                  (option) => customizations[option.id]
                ).map((option) => (
                  <li key={option.id} className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    {option.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
