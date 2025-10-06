'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Check, Eye, Palette } from 'lucide-react';
import { STYLE_CATALOG, Style } from '@/lib/style-catalog';
import { cn } from '@/lib/utils';

interface SeedreamStyleSelectorProps {
  selectedStyleId: string | null;
  onStyleSelect: (styleId: string) => void;
  disabled?: boolean;
}

export default function SeedreamStyleSelector({
  selectedStyleId,
  onStyleSelect,
  disabled = false,
}: SeedreamStyleSelectorProps) {
  const [previewStyle, setPreviewStyle] = useState<Style | null>(null);

  const getCategoryLabel = (category: Style['category']) => {
    const labels = {
      corporate: 'Corporate',
      creative: 'Creative',
      casual: 'Casual',
    };
    return labels[category];
  };

  const getCategoryColor = (category: Style['category']) => {
    const colors = {
      corporate: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      creative: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      casual: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[category];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Choose Your Style
        </CardTitle>
        <CardDescription>
          Select a professional background style for your headshots
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STYLE_CATALOG.map((style) => {
            const isSelected = selectedStyleId === style.id;

            return (
              <div
                key={style.id}
                onClick={() => !disabled && onStyleSelect(style.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    !disabled && onStyleSelect(style.id);
                  }
                }}
                className={cn(
                  'relative group rounded-lg border-2 transition-all duration-200 overflow-hidden text-left cursor-pointer',
                  'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                  isSelected
                    ? 'border-primary shadow-md ring-2 ring-primary ring-offset-2'
                    : 'border-border hover:border-primary/50',
                  disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
                )}
              >
                {/* Preview Image */}
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={style.previewImage}
                    alt={`${style.name} preview`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Preview Button Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewStyle(style);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {style.name}
                            <Badge className={getCategoryColor(style.category)}>
                              {getCategoryLabel(style.category)}
                            </Badge>
                          </DialogTitle>
                          <DialogDescription>
                            {style.description}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="relative aspect-video rounded-lg overflow-hidden">
                          <Image
                            src={style.previewImage}
                            alt={`${style.name} preview`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                        </div>
                        <div className="space-y-2">
                          <div>
                            <h4 className="text-sm font-medium mb-1">Style Details</h4>
                            <p className="text-sm text-muted-foreground">
                              This style uses consistent lighting and background settings to ensure
                              all users receive the same professional look.
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              onStyleSelect(style.id);
                              setPreviewStyle(null);
                            }}
                            className="w-full"
                            disabled={disabled}
                          >
                            {isSelected ? 'Selected' : 'Select This Style'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Style Info */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight">
                      {style.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getCategoryColor(style.category))}
                    >
                      {getCategoryLabel(style.category)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {style.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Style Summary */}
        {selectedStyleId && (
          <div className="mt-6 rounded-lg bg-primary/10 p-4">
            <p className="text-sm font-medium mb-2">Selected style:</p>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-md overflow-hidden border-2 border-primary">
                <Image
                  src={
                    STYLE_CATALOG.find((s) => s.id === selectedStyleId)?.previewImage || ''
                  }
                  alt="Selected style"
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {STYLE_CATALOG.find((s) => s.id === selectedStyleId)?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {STYLE_CATALOG.find((s) => s.id === selectedStyleId)?.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
