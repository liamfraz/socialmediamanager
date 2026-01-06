import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Calendar, Clock, Plus, X, Search, Check } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import ImageCarousel from "./ImageCarousel";
import { format, addDays } from "date-fns";
import type { TaggedPhoto } from "@shared/schema";

interface SortableImageProps {
  id: string;
  url: string;
  index: number;
  onRemove: (index: number) => void;
}

function SortableImage({ id, url, index, onRemove }: SortableImageProps) {
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
      <Button
        variant="destructive"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="absolute -right-1 -top-1 h-5 w-5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        data-testid={`button-remove-image-${index}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface PostDetailCardProps {
  id: string;
  content: string;
  status: PostStatus;
  rowIndex?: number;
  images?: string[];
  onContentChange?: (content: string) => void;
  onImagesChange?: (images: string[]) => void;
}

const INSTAGRAM_LIMIT = 2200;

function getScheduledDate(rowIndex: number): Date {
  const today = new Date();
  const scheduledDate = addDays(today, rowIndex + 1);
  scheduledDate.setHours(17, 0, 0, 0);
  return scheduledDate;
}

export default function PostDetailCard({
  id,
  content,
  status,
  rowIndex = 0,
  images = [],
  onContentChange,
  onImagesChange,
}: PostDetailCardProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [currentImages, setCurrentImages] = useState<string[]>(images);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  
  const { data: taggedPhotos = [] } = useQuery<TaggedPhoto[]>({
    queryKey: ["/api/tagged-photos"],
  });

  const scheduledDate = getScheduledDate(rowIndex);
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
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{format(scheduledDate, "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{format(scheduledDate, "h:mm a")}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6">
        {currentImages.length > 0 && (
          <ImageCarousel images={currentImages} size="lg" />
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddPhoto}
              data-testid="button-add-photo"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Photo
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentImages.length} photo{currentImages.length !== 1 ? "s" : ""} attached
            </span>
          </div>

          {currentImages.length > 0 && (
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
            className="min-h-32 resize-none text-base"
            placeholder="Enter your post content..."
            data-testid="textarea-post-content"
          />
          <div className="flex justify-end">
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
    </Card>
  );
}
