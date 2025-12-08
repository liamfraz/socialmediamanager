import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  size?: "sm" | "lg";
  className?: string;
}

export default function ImageCarousel({ images, size = "lg", className = "" }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const isSmall = size === "sm";

  if (isSmall) {
    return (
      <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className="h-16 w-full object-cover"
          data-testid={`img-carousel-${currentIndex}`}
        />
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={handlePrev}
              className="absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm"
              data-testid="button-carousel-prev"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleNext}
              className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm"
              data-testid="button-carousel-next"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <div className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
              {images.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 w-1 rounded-full bg-white/80 ${
                    idx === currentIndex ? "opacity-100" : "opacity-40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {images.length > 1 && (
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrev}
          className="h-10 w-10 flex-shrink-0 rounded-full"
          data-testid="button-carousel-prev"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}

      <div className={`relative flex-1 overflow-hidden rounded-lg bg-muted ${className}`}>
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className="max-h-96 w-full object-contain"
          data-testid={`img-carousel-${currentIndex}`}
        />
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full bg-white/90 shadow-sm ${
                  idx === currentIndex ? "opacity-100" : "opacity-40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className="h-10 w-10 flex-shrink-0 rounded-full"
          data-testid="button-carousel-next"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
