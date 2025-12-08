import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus, X } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import ImageCarousel from "./ImageCarousel";
import { format } from "date-fns";

interface PostDetailCardProps {
  id: string;
  content: string;
  status: PostStatus;
  scheduledDate: Date;
  images?: string[];
  onContentChange?: (content: string) => void;
  onImagesChange?: (images: string[]) => void;
}

const INSTAGRAM_LIMIT = 2200;

export default function PostDetailCard({
  id,
  content,
  status,
  scheduledDate,
  images = [],
  onContentChange,
  onImagesChange,
}: PostDetailCardProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [currentImages, setCurrentImages] = useState<string[]>(images);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const remaining = INSTAGRAM_LIMIT - editedContent.length;
  const isNearLimit = remaining < INSTAGRAM_LIMIT * 0.1;
  const isOverLimit = remaining < 0;

  const handleContentChange = (value: string) => {
    setEditedContent(value);
    onContentChange?.(value);
  };

  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newUrl = event.target?.result as string;
        setCurrentImages((prev) => {
          const updated = [...prev, newUrl];
          onImagesChange?.(updated);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setCurrentImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onImagesChange?.(updated);
      return updated;
    });
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            <span className="text-xs text-muted-foreground">
              {currentImages.length} photo{currentImages.length !== 1 ? "s" : ""} attached
            </span>
          </div>

          {currentImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentImages.map((img, idx) => (
                <div key={idx} className="group relative">
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute -right-1 -top-1 h-5 w-5 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    data-testid={`button-remove-image-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
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
    </Card>
  );
}
