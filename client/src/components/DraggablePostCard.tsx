import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Images, Clock, Calendar, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface DraggablePostCardProps {
  id: string;
  content: string;
  images?: string[];
  scheduledDate: Date;
  createdAt?: Date;
  onTimeChange?: (postId: string, newDate: Date) => void;
  onClick?: () => void;
  showDateTime?: boolean;
  showCreatedDate?: boolean;
  isPaused?: boolean; // undefined = neutral, true = paused (red), false = active (green)
  isNewlyCreated?: boolean; // Show loading then tick animation
  showCheckbox?: boolean; // Show checkbox instead of drag handle
  isSelected?: boolean; // Whether the checkbox is checked
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export default function DraggablePostCard({
  id,
  content,
  images,
  scheduledDate,
  createdAt,
  onTimeChange,
  onClick,
  showDateTime = true,
  showCreatedDate = false,
  isPaused,
  isNewlyCreated = false,
  showCheckbox = false,
  isSelected = false,
  onSelectionChange,
}: DraggablePostCardProps) {
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [showTick, setShowTick] = useState(false);
  const [showIndicator, setShowIndicator] = useState(isNewlyCreated);

  useEffect(() => {
    if (isNewlyCreated) {
      setShowIndicator(true);
      // Show loading for 1 second, then tick for 2 seconds
      const tickTimer = setTimeout(() => {
        setShowTick(true);
      }, 1000);
      const hideTimer = setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
      return () => {
        clearTimeout(tickTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isNewlyCreated]);
  
  // Ensure scheduledDate is valid
  const validDate = scheduledDate instanceof Date && !isNaN(scheduledDate.getTime()) 
    ? scheduledDate 
    : new Date();
  
  const [editDate, setEditDate] = useState(format(validDate, "yyyy-MM-dd"));
  const [editTime, setEditTime] = useState(format(validDate, "HH:mm"));
  const [dateError, setDateError] = useState<string | null>(null);

  // Minimum date is today
  const minDate = format(new Date(), "yyyy-MM-dd");

  // Update edit fields when popover opens
  useEffect(() => {
    if (timePopoverOpen) {
      setEditDate(format(validDate, "yyyy-MM-dd"));
      setEditTime(format(validDate, "HH:mm"));
      setDateError(null);
    }
  }, [timePopoverOpen, validDate]);
  
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
  const dayLabel = format(validDate, "EEE, MMM d");
  const time = format(validDate, "h:mm a");

  const handleTimeSubmit = () => {
    const [year, month, day] = editDate.split("-").map(Number);
    const [hours, minutes] = editTime.split(":").map(Number);
    const newDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    // Check if the selected date/time is in the past
    if (newDate < new Date()) {
      setDateError("Cannot schedule a post in the past");
      return;
    }

    setDateError(null);
    onTimeChange?.(id, newDate);
    setTimePopoverOpen(false);
  };

  return (
    <div className="flex items-stretch gap-3">
      {showDateTime && (
        <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`flex w-24 flex-shrink-0 flex-col items-center justify-center rounded-md p-2 text-center hover-elevate cursor-pointer ${
                isPaused === undefined
                  ? "bg-muted"
                  : isPaused 
                    ? "bg-red-50 dark:bg-red-950/30" 
                    : "bg-green-50 dark:bg-green-950/30"
              }`}
              data-testid={`button-edit-time-${id}`}
            >
              <span className={`text-xs font-medium ${
                isPaused === undefined 
                  ? "text-muted-foreground" 
                  : isPaused 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-green-600 dark:text-green-400"
              }`}>{dayLabel}</span>
              <span className={`text-sm font-semibold ${
                isPaused === undefined 
                  ? "text-foreground" 
                  : isPaused 
                    ? "text-red-700 dark:text-red-300" 
                    : "text-green-700 dark:text-green-300"
              }`}>{time}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Set Date & Time</span>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input
                    type="date"
                    value={editDate}
                    min={minDate}
                    onChange={(e) => {
                      setEditDate(e.target.value);
                      setDateError(null);
                    }}
                    className="w-full"
                    data-testid={`input-date-${id}`}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => {
                      setEditTime(e.target.value);
                      setDateError(null);
                    }}
                    className="w-full"
                    data-testid={`input-time-${id}`}
                  />
                </div>
                {dateError && (
                  <p className="text-xs text-red-500">{dateError}</p>
                )}
              </div>
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
      )}
      
      <div ref={setNodeRef} style={style} className="flex-1">
        <Card
          className={`flex items-center gap-4 p-4 transition-shadow hover-elevate ${
            isDragging ? "shadow-lg opacity-90" : ""
          }`}
          data-testid={`draggable-post-${id}`}
        >
          {showCheckbox ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange?.(id, !!checked)}
              className="h-5 w-5"
              data-testid={`checkbox-select-${id}`}
              aria-label="Select post for deletion"
            />
          ) : (
            <div className="w-5 h-5" />
          )}

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

          {showIndicator && (
            <div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
              {showTick ? (
                <CheckCircle className="h-5 w-5 text-green-500 animate-in fade-in zoom-in duration-300" />
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
            </div>
          )}

          {showCreatedDate && createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(new Date(createdAt), "MMM d, h:mm a")}</span>
            </div>
          )}

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
