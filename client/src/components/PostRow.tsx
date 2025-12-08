import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import { format } from "date-fns";

export interface Post {
  id: string;
  content: string;
  status: PostStatus;
  scheduledDate: Date;
  imageUrl?: string;
  order: number;
}

interface PostRowProps {
  post: Post;
  index: number;
  totalPosts: number;
  onClick?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function PostRow({ 
  post, 
  index, 
  totalPosts, 
  onClick, 
  onMoveUp, 
  onMoveDown 
}: PostRowProps) {
  const isFirst = index === 0;
  const isLast = index === totalPosts - 1;

  return (
    <Card 
      className="flex items-center gap-4 p-4 transition-shadow hover:shadow-md hover-elevate"
      data-testid={`row-post-${post.id}`}
    >
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp?.();
          }}
          disabled={isFirst}
          className="h-7 w-7"
          data-testid={`button-move-up-${post.id}`}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div className="flex h-7 w-7 items-center justify-center">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown?.();
          }}
          disabled={isLast}
          className="h-7 w-7"
          data-testid={`button-move-down-${post.id}`}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {index + 1}
        </span>
      </div>

      {post.imageUrl && (
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          <img
            src={post.imageUrl}
            alt="Post preview"
            className="h-full w-full object-cover"
            data-testid={`img-post-${post.id}`}
          />
        </div>
      )}

      <div 
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1"
        onClick={onClick}
      >
        <p 
          className="line-clamp-2 text-sm text-foreground"
          data-testid={`text-post-content-${post.id}`}
        >
          {post.content}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span data-testid={`text-post-date-${post.id}`}>
              {format(post.scheduledDate, "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        </div>
      </div>

      <StatusBadge status={post.status} />

      <Button 
        variant="outline" 
        size="sm"
        onClick={onClick}
        data-testid={`button-review-${post.id}`}
      >
        Review
      </Button>
    </Card>
  );
}
