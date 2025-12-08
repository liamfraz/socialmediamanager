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

  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
      <img
        src={images[currentIndex]}
        alt={`Image ${currentIndex + 1} of ${images.length}`}
        className={`w-full object-cover ${isSmall ? "h-16" : "max-h-96"}`}
        data-testid={`img-carousel-${currentIndex}`}
      />

      {images.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            onClick={handlePrev}
            className={`absolute left-1 top-1/2 -translate-y-1/2 ${isSmall ? "h-6 w-6" : "h-8 w-8"} rounded-full bg-background/80 backdrop-blur-sm`}
            data-testid="button-carousel-prev"
          >
            <ChevronLeft className={isSmall ? "h-3 w-3" : "h-4 w-4"} />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            onClick={handleNext}
            className={`absolute right-1 top-1/2 -translate-y-1/2 ${isSmall ? "h-6 w-6" : "h-8 w-8"} rounded-full bg-background/80 backdrop-blur-sm`}
            data-testid="button-carousel-next"
          >
            <ChevronRight className={isSmall ? "h-3 w-3" : "h-4 w-4"} />
          </Button>

          <div className={`absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1`}>
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`rounded-full bg-white/80 ${
                  idx === currentIndex ? "opacity-100" : "opacity-40"
                } ${isSmall ? "h-1 w-1" : "h-1.5 w-1.5"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
