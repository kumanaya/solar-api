"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface GeoTIFFImage {
  url: string;
  title: string;
  description: string;
}

interface GeoTIFFCarouselProps {
  images: GeoTIFFImage[];
  onClose: () => void;
}

export function GeoTIFFCarousel({ images, onClose }: GeoTIFFCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const previousImage = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  if (!images.length) {
    return (
      <div className="text-center p-4">
        <p>Nenhuma imagem GeoTIFF disponível.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center justify-between p-4">
        <Button
          variant="outline"
          size="icon"
          onClick={previousImage}
          className="absolute left-4 z-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="relative w-full h-64 overflow-hidden">
          <img
            src={images[currentIndex].url}
            alt={images[currentIndex].title}
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2">
            <h3 className="text-sm font-semibold">{images[currentIndex].title}</h3>
            <p className="text-xs">{images[currentIndex].description}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={nextImage}
          className="absolute right-4 z-10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex justify-center gap-2 mt-2">
        {images.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full ${
              index === currentIndex ? "bg-primary" : "bg-gray-300"
            }`}
            onClick={() => setCurrentIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
