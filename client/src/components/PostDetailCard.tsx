import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock } from "lucide-react";
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
}

const INSTAGRAM_LIMIT = 2200;

export default function PostDetailCard({
  id,
  content,
  status,
  scheduledDate,
  images,
  onContentChange,
}: PostDetailCardProps) {
  const [editedContent, setEditedContent] = useState(content);
  const remaining = INSTAGRAM_LIMIT - editedContent.length;
  const isNearLimit = remaining < INSTAGRAM_LIMIT * 0.1;
  const isOverLimit = remaining < 0;

  const handleChange = (value: string) => {
    setEditedContent(value);
    onContentChange?.(value);
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
        {images && images.length > 0 && (
          <ImageCarousel images={images} size="lg" />
        )}

        <div className="space-y-2">
          <Textarea
            value={editedContent}
            onChange={(e) => handleChange(e.target.value)}
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
