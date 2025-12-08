import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock } from "lucide-react";
import PlatformBadge, { type Platform } from "./PlatformBadge";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import { format } from "date-fns";

interface PostDetailCardProps {
  id: string;
  content: string;
  platform: Platform;
  status: PostStatus;
  scheduledDate: Date;
  imageUrl?: string;
  onContentChange?: (content: string) => void;
  maxLength?: number;
}

const platformLimits: Record<Platform, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
};

export default function PostDetailCard({
  id,
  content,
  platform,
  status,
  scheduledDate,
  imageUrl,
  onContentChange,
  maxLength,
}: PostDetailCardProps) {
  const [editedContent, setEditedContent] = useState(content);
  const limit = maxLength || platformLimits[platform];
  const remaining = limit - editedContent.length;
  const isNearLimit = remaining < limit * 0.1;
  const isOverLimit = remaining < 0;

  const handleChange = (value: string) => {
    setEditedContent(value);
    onContentChange?.(value);
  };

  return (
    <Card className="w-full" data-testid={`card-post-detail-${id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b pb-4">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={platform} />
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
        {imageUrl && (
          <div className="overflow-hidden rounded-lg bg-muted">
            <img
              src={imageUrl}
              alt="Post media"
              className="max-h-96 w-full object-contain"
              data-testid={`img-post-detail-${id}`}
            />
          </div>
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
              {editedContent.length} / {limit}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
