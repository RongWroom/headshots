'use client'
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import axios from "axios";
import Link from "next/link";
import { Progress } from "./ui/progress";
import { Loader2 } from "lucide-react";

interface Model {
  id: string;
  title: string;
  cover_url: string;
  slug: string;
}

export default function PacksGalleryZone() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchModels = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<Model[]>('/api/replicate/models');
      setModels(response.data);
    } catch (err: unknown) {
      const error = err as Error;
      toast({
        title: "Error fetching models",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading models...</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">No models available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {models.map((model) => (
        <Link
          key={model.id}
          href={`/models/${model.slug}`}
          className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 transition-all hover:shadow-lg"
        >
          <div className="aspect-square overflow-hidden">
            <img
              alt={model.title}
              className="h-full w-full object-cover transition-all group-hover:scale-105"
              src={model.cover_url}
              style={{
                aspectRatio: "1/1",
                objectFit: "cover",
              }}
            />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg">{model.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI Model for generating headshots
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}