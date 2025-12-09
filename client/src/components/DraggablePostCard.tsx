import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Images } from "lucide-react";

interface DraggablePostCardProps {
  id: string;
  content: string;
  images?: string[];
  order: number;
  onClick?: () => void;
}

export default function DraggablePostCard({
  id,
  content,
  images,
  order,
  onClick,
}: DraggablePostCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
  };

  const hasImages = images && images.length > 0;
  const hasMultipleImages = images && images.length > 1;

  const contentSnippet = content.split("\n").slice(0, 2).join("\n");

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`flex items-center gap-4 p-4 transition-shadow hover-elevate ${
          isDragging ? "shadow-lg opacity-90" : ""
        }`}
        data-testid={`draggable-post-${id}`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 rounded hover:bg-muted"
          data-testid={`drag-handle-${id}`}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {order}
        </div>

        {hasImages && (
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
            <img
              src={images[0]}
              alt=""
              className="h-full w-full object-cover"
            />
            {hasMultipleImages && (
              <div className="absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl bg-black/60 px-1 py-0.5 text-[10px] text-white">
                <Images className="h-2.5 w-2.5" />
                <span>{images.length}</span>
              </div>
            )}
          </div>
        )}

        <div 
          className="min-w-0 flex-1 cursor-pointer"
          onClick={onClick}
        >
          <p 
            className="line-clamp-2 text-sm text-foreground"
            data-testid={`text-post-snippet-${id}`}
          >
            {contentSnippet}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onClick}
          data-testid={`button-edit-${id}`}
        >
          Edit
        </Button>
      </Card>
    </div>
  );
}
