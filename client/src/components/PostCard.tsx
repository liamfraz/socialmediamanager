import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import StatusBadge, { type PostStatus } from "./StatusBadge";
import PlatformBadge, { type Platform } from "./PlatformBadge";
import { format } from "date-fns";

export interface Post {
  id: string;
  content: string;
  platform: Platform;
  status: PostStatus;
  scheduledDate: Date;
  imageUrl?: string;
}

interface PostCardProps {
  post: Post;
  onClick?: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <Card 
      className="cursor-pointer transition-shadow hover:shadow-md hover-elevate"
      onClick={onClick}
      data-testid={`card-post-${post.id}`}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <PlatformBadge platform={post.platform} />
          <StatusBadge status={post.status} />
        </div>

        {post.imageUrl && (
          <div className="mb-3 aspect-video overflow-hidden rounded-md bg-muted">
            <img
              src={post.imageUrl}
              alt="Post preview"
              className="h-full w-full object-cover"
              data-testid={`img-post-${post.id}`}
            />
          </div>
        )}

        <p 
          className="line-clamp-3 text-sm text-foreground"
          data-testid={`text-post-content-${post.id}`}
        >
          {post.content}
        </p>
      </CardContent>

      <CardFooter className="border-t px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span data-testid={`text-post-date-${post.id}`}>
            {format(post.scheduledDate, "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
