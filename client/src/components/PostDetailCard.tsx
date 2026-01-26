import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar, Clock, Plus, X, Search, Check, Users, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SiInstagram } from "react-icons/si";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import ImageCarousel from "./ImageCarousel";
import { format, addDays, isToday } from "date-fns";
import type { TaggedPhoto } from "@shared/schema";

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ id, url, index, onRemove }: SortableImageProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <img
        src={url}
        alt={`Thumbnail ${index + 1}`}
        className="h-12 w-12 rounded-md object-cover"
      />
      {confirmDelete ? (
        <div 
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            variant="destructive"
            size="icon"
            onClick={() => {
              onRemove(index);
              setConfirmDelete(false);
            }}
            className="h-5 w-5 rounded-full"
            data-testid={`button-confirm-remove-${index}`}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmDelete(false)}
            className="h-5 w-5 rounded-full"
            data-testid={`button-cancel-remove-${index}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="destructive"
          size="icon"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setConfirmDelete(true)}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          data-testid={`button-remove-image-${index}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface PostDetailCardProps {
  id: string;
  content: string;
  status: PostStatus;
  scheduledDate?: Date | null;
  images?: string[];
  collaborators?: string[];
  onContentChange?: (content: string) => void;
  onImagesChange?: (images: string[]) => void;
  onCollaboratorsChange?: (collaborators: string[]) => void;
  onScheduledDateChange?: (date: Date) => void;
}

const INSTAGRAM_LIMIT = 2200;

export default function PostDetailCard({
  id,
  content,
  status,
  scheduledDate: propScheduledDate,
  images = [],
  collaborators = [],
  onContentChange,
  onImagesChange,
  onCollaboratorsChange,
  onScheduledDateChange,
}: PostDetailCardProps) {
  const { toast } = useToast();
  const [editedContent, setEditedContent] = useState(content);
  const [currentImages, setCurrentImages] = useState<string[]>(images);
  const [currentCollaborators, setCurrentCollaborators] = useState<string[]>(collaborators);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);

  // Mutation for regenerating caption
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/posts/${id}/regenerate-caption`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate caption");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.caption) {
        setEditedContent(data.caption);
        onContentChange?.(data.caption);
        toast({
          title: "Caption regenerated",
          description: "Your caption has been rewritten by AI.",
        });
      }
      setRegenerateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setRegenerateDialogOpen(false);
    },
  });

  // Initialize scheduled date once - use prop or default to tomorrow at 5pm
  const [scheduledDate, setScheduledDate] = useState<Date>(() => {
    if (propScheduledDate) {
      return new Date(propScheduledDate);
    }
    const d = addDays(new Date(), 1);
    d.setHours(17, 0, 0, 0);
    return d;
  });
  
  const { data: taggedPhotos = [] } = useQuery<TaggedPhoto[]>({
    queryKey: ["/api/tagged-photos"],
  });

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      const updated = new Date(newDate);
      updated.setHours(scheduledDate.getHours(), scheduledDate.getMinutes(), 0, 0);
      setScheduledDate(updated);
      onScheduledDateChange?.(updated);
      setDatePickerOpen(false);
    }
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    const updated = new Date(scheduledDate);
    updated.setHours(hours, minutes, 0, 0);
    
    // If selecting a time in the past for today, adjust to next valid quarter-hour
    if (isToday(scheduledDate)) {
      const now = new Date();
      if (updated <= now) {
        // Find the next valid quarter-hour
        const nextValid = new Date(now);
        nextValid.setMinutes(Math.ceil(now.getMinutes() / 15) * 15 + 15, 0, 0);
        updated.setHours(nextValid.getHours(), nextValid.getMinutes(), 0, 0);
      }
    }
    
    setScheduledDate(updated);
    onScheduledDateChange?.(updated);
    setTimePickerOpen(false);
  };

  // Check if a time option is in the past (only relevant for today)
  const isTimePast = (hours: number, minutes: number) => {
    if (!isToday(scheduledDate)) return false;
    const now = new Date();
    const testTime = new Date(scheduledDate);
    testTime.setHours(hours, minutes, 0, 0);
    return testTime <= now;
  };

  const remaining = INSTAGRAM_LIMIT - editedContent.length;
  const isNearLimit = remaining < INSTAGRAM_LIMIT * 0.1;
  const isOverLimit = remaining < 0;

  const filteredPhotos = useMemo(() => {
    if (!searchTerm.trim()) return taggedPhotos;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/);
    return taggedPhotos.filter((photo) => {
      if (!photo.tags || photo.tags.length === 0) return false;
      const photoTags = photo.tags.map((tag) => tag.toLowerCase());
      return searchWords.every((word) =>
        photoTags.some((tag) => tag.includes(word))
      );
    });
  }, [taggedPhotos, searchTerm]);

  const getDirectImageUrl = (url: string) => {
    if (url.includes("lh3.googleusercontent.com")) return url;
    const driveMatch = url.match(/\/d\/([^/]+)/);
    if (driveMatch) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w800-h800`;
    }
    return url;
  };

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    onContentChange?.(value);
  };

  const handleAddPhoto = () => {
    setSelectedPhotos(new Set());
    setSearchTerm("");
    setPhotoDialogOpen(true);
  };

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoUrl)) {
        next.delete(photoUrl);
      } else {
        next.add(photoUrl);
      }
      return next;
    });
  };

  const handleAddSelectedPhotos = () => {
    const newUrls = Array.from(selectedPhotos).map(getDirectImageUrl);
    const updated = [...currentImages, ...newUrls];
    setCurrentImages(updated);
    onImagesChange?.(updated);
    setPhotoDialogOpen(false);
    setSelectedPhotos(new Set());
  };

  const handleRemoveImage = (index: number) => {
    setCurrentImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onImagesChange?.(updated);
      return updated;
    });
  };

  const handleAddCollaborator = () => {
    const username = collaboratorInput.trim().replace(/^@/, "");
    if (username && !currentCollaborators.includes(username)) {
      const updated = [...currentCollaborators, username];
      setCurrentCollaborators(updated);
      onCollaboratorsChange?.(updated);
      setCollaboratorInput("");
    }
  };

  const handleRemoveCollaborator = (username: string) => {
    const updated = currentCollaborators.filter((c) => c !== username);
    setCurrentCollaborators(updated);
    onCollaboratorsChange?.(updated);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const imageIds = currentImages.map((url, idx) => `image-${idx}-${url.slice(-20)}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = imageIds.indexOf(active.id as string);
      const newIndex = imageIds.indexOf(over.id as string);
      const newOrder = arrayMove(currentImages, oldIndex, newIndex);
      setCurrentImages(newOrder);
      onImagesChange?.(newOrder);
    }
  };

  return (
    <Card className="w-full" data-testid={`card-post-detail-${id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-3 py-1.5">
            <SiInstagram className="h-4 w-4 text-white" />
            <span className="text-sm font-medium text-white">Instagram</span>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Popover open={datePickerOpen} onOpenChange={status !== "approved" ? setDatePickerOpen : undefined}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 h-auto py-1 px-2 ${status === "approved" ? "cursor-default" : ""}`}
                data-testid="button-edit-date"
                disabled={status === "approved"}
              >
                <Calendar className="h-4 w-4" />
                <span>{format(scheduledDate, "MMM d, yyyy")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={scheduledDate}
                onSelect={handleDateChange}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover open={timePickerOpen} onOpenChange={status !== "approved" ? setTimePickerOpen : undefined}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1.5 h-auto py-1 px-2 ${status === "approved" ? "cursor-default" : ""}`}
                data-testid="button-edit-time"
                disabled={status === "approved"}
              >
                <Clock className="h-4 w-4" />
                <span>{format(scheduledDate, "h:mm a")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="start">
              <div className="space-y-3">
                <div className="text-sm font-medium">Select Time</div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={String(scheduledDate.getHours())} 
                    onValueChange={(v) => handleTimeChange(parseInt(v), scheduledDate.getMinutes())}
                  >
                    <SelectTrigger className="w-20" data-testid="select-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem 
                          key={i} 
                          value={String(i)}
                          disabled={isTimePast(i, 59)}
                        >
                          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>:</span>
                  <Select 
                    value={String(scheduledDate.getMinutes())} 
                    onValueChange={(v) => handleTimeChange(scheduledDate.getHours(), parseInt(v))}
                  >
                    <SelectTrigger className="w-20" data-testid="select-minute">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled={isTimePast(scheduledDate.getHours(), 0)}>00</SelectItem>
                      <SelectItem value="15" disabled={isTimePast(scheduledDate.getHours(), 15)}>15</SelectItem>
                      <SelectItem value="30" disabled={isTimePast(scheduledDate.getHours(), 30)}>30</SelectItem>
                      <SelectItem value="45" disabled={isTimePast(scheduledDate.getHours(), 45)}>45</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {currentImages.length > 0 && (
          <ImageCarousel images={currentImages} size="lg" />
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {status !== "approved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPhoto}
                data-testid="button-add-photo"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Photo
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {currentImages.length} photo{currentImages.length !== 1 ? "s" : ""} attached
            </span>
          </div>

          {currentImages.length > 0 && status !== "approved" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={imageIds} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-3">
                  {currentImages.map((img, idx) => (
                    <SortableImage
                      key={imageIds[idx]}
                      id={imageIds[idx]}
                      url={img}
                      index={idx}
                      onRemove={handleRemoveImage}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

        </div>

        <div className="space-y-2">
          <Textarea
            value={editedContent}
            onChange={(e) => handleContentChange(e.target.value)}
            className={`min-h-32 resize-none text-base ${status === "approved" ? "bg-muted cursor-not-allowed" : ""}`}
            placeholder="Enter your post content..."
            data-testid="textarea-post-content"
            disabled={status === "approved" || regenerateMutation.isPending}
          />
          {status === "approved" && (
            <p className="text-xs text-muted-foreground">
              Caption is locked. Send back to review to make changes.
            </p>
          )}
          <div className="flex items-center justify-between">
            {status !== "approved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRegenerateDialogOpen(true)}
                disabled={regenerateMutation.isPending}
                data-testid="button-regenerate-caption"
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {regenerateMutation.isPending ? "Regenerating..." : "Regenerate Caption"}
              </Button>
            )}
            {status === "approved" && <div />}
            <span
              className={`text-xs ${
                isOverLimit
                  ? "text-red-500"
                  : isNearLimit
                  ? "text-amber-500"
                  : "text-muted-foreground"
              }`}
              data-testid="text-character-count"
            >
              {editedContent.length} / {INSTAGRAM_LIMIT}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Invite Collaborators</span>
          </div>
          {status !== "approved" && (
            <div className="flex gap-2">
              <Input
                placeholder="@username"
                value={collaboratorInput}
                onChange={(e) => setCollaboratorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCollaborator();
                  }
                }}
                className="flex-1"
                data-testid="input-collaborator"
              />
              <Button
                variant="outline"
                onClick={handleAddCollaborator}
                disabled={!collaboratorInput.trim()}
                data-testid="button-add-collaborator"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          )}
          {currentCollaborators.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentCollaborators.map((username) => (
                <div
                  key={username}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                  data-testid={`collaborator-${username}`}
                >
                  <span>@{username}</span>
                  {status !== "approved" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleRemoveCollaborator(username)}
                      data-testid={`button-remove-collaborator-${username}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {currentCollaborators.length === 0 && status === "approved" && (
            <p className="text-xs text-muted-foreground">No collaborators added</p>
          )}
        </div>
      </CardContent>

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Photos</DialogTitle>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-photo-search"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredPhotos.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No photos found
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {filteredPhotos.map((photo) => {
                  const imageUrl = getDirectImageUrl(photo.photoUrl);
                  const isSelected = selectedPhotos.has(photo.photoUrl);
                  return (
                    <div
                      key={photo.id}
                      className={`relative cursor-pointer rounded-md overflow-visible hover-elevate ${
                        isSelected ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => togglePhotoSelection(photo.photoUrl)}
                      data-testid={`photo-select-${photo.id}`}
                    >
                      <img
                        src={imageUrl}
                        alt={photo.description || "Photo"}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 rounded-full bg-primary p-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPhotoDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSelectedPhotos}
              disabled={selectedPhotos.size === 0}
              data-testid="button-confirm-add-photos"
            >
              Add {selectedPhotos.size} Photo{selectedPhotos.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Caption</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to regenerate the caption? AI will rewrite your current caption with a fresh version. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateDialogOpen(false)}
              disabled={regenerateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              data-testid="button-confirm-regenerate"
            >
              {regenerateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
