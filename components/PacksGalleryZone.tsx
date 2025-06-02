'use client'
import { useState } from "react";
import Link from "next/link";
// import { useToast } from "@/components/ui/use-toast"; // Not used anymore
// import axios from "axios"; // Not used anymore
// import { Progress } from "./ui/progress"; // Not used anymore
// import { Loader2 } from "lucide-react"; // Not used anymore

interface Model {
  id: string;
  title: string;
  cover_url: string;
  slug: string;
}

const staticModels: Model[] = [
  {
    id: "actor-headshots",
    title: "Actor Headshots",
    cover_url: "/images/placeholder-actor.jpg", // Placeholder - ensure this image exists or use a service
    slug: "actor-headshots",
  },
  {
    id: "corporate-headshots",
    title: "Corporate Headshots",
    cover_url: "/images/placeholder-corporate.jpg", // Placeholder - ensure this image exists or use a service
    slug: "corporate-headshots",
  },
];

export default function PacksGalleryZone() {
  const [models, setModels] = useState<Model[]>(staticModels);
  // const { toast } = useToast(); // Not used anymore

  // No fetching logic needed for static models

  // No loading state needed for static models

  // No "No models available" message needed as we always have two

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {models.map((model) => (
        <Link
          key={model.id}
          href={`/overview/models/train/${model.slug}`}
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
