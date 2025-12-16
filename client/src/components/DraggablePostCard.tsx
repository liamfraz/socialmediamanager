import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GripVertical, Images, Clock } from "lucide-react";
import { format } from "date-fns";

interface DraggablePostCardProps {
  id: string;
  content: string;
  images?: string[];
  scheduledDate: Date;
  onTimeChange?: (postId: string, newDate: Date) => void;
  onClick?: () => void;
}

export default function DraggablePostCard({
  id,
  content,
  images,
  scheduledDate,
  onTimeChange,
  onClick,
}: DraggablePostCardProps) {
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [editTime, setEditTime] = useState(format(scheduledDate, "HH:mm"));
  
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
  const dayLabel = format(scheduledDate, "EEE, MMM d");
  const time = format(scheduledDate, "h:mm a");

  const handleTimeSubmit = () => {
    const [hours, minutes] = editTime.split(":").map(Number);
    const newDate = new Date(scheduledDate);
    newDate.setHours(hours, minutes, 0, 0);
    onTimeChange?.(id, newDate);
    setTimePopoverOpen(false);
  };

  return (
    <div className="flex items-stretch gap-3">
      <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-24 flex-shrink-0 flex-col items-center justify-center rounded-md bg-muted p-2 text-center hover-elevate cursor-pointer"
            data-testid={`button-edit-time-${id}`}
          >
            <span className="text-xs font-medium text-muted-foreground">{dayLabel}</span>
            <span className="text-sm font-semibold">{time}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Set Time</span>
            </div>
            <Input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full"
              data-testid={`input-time-${id}`}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTimePopoverOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTimeSubmit}
                data-testid={`button-save-time-${id}`}
              >
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <div ref={setNodeRef} style={style} className="flex-1">
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
    </div>
  );
}
