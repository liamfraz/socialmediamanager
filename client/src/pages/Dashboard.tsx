import { useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import PostRow from "@/components/PostRow";
import PostCalendar, { type CalendarPost } from "@/components/PostCalendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { CheckCircle2 } from "lucide-react";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { addDays, setHours, setMinutes } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; order: number }[]) => {
      return apiRequest("PUT", "/api/posts/reorder", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const approvedPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "approved")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const getScheduledDateForPosition = (index: number) => {
    const tomorrow = addDays(new Date(), index + 1);
    return setMinutes(setHours(tomorrow, 9), 0);
  };

  const calendarPosts: CalendarPost[] = useMemo(() => {
    return approvedPosts.map((post, index) => ({
      id: post.id,
      content: post.content,
      status: post.status,
      scheduledDate: getScheduledDateForPosition(index),
    }));
  }, [approvedPosts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  const handleMoveUp = (postId: string) => {
    const sorted = [...approvedPosts];
    const index = sorted.findIndex((p) => p.id === postId);
    if (index <= 0) return;

    const currentPost = sorted[index];
    const prevPost = sorted[index - 1];
    
    reorderMutation.mutate([
      { id: currentPost.id, order: prevPost.order },
      { id: prevPost.id, order: currentPost.order },
    ]);
  };

  const handleMoveDown = (postId: string) => {
    const sorted = [...approvedPosts];
    const index = sorted.findIndex((p) => p.id === postId);
    if (index < 0 || index >= sorted.length - 1) return;

    const currentPost = sorted[index];
    const nextPost = sorted[index + 1];
    
    reorderMutation.mutate([
      { id: currentPost.id, order: nextPost.order },
      { id: nextPost.id, order: currentPost.order },
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <PostCalendar posts={calendarPosts} onPostClick={handlePostClick} />

        <div>
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold">Ready to Post</h2>
            <Badge variant="outline" className="ml-2">{approvedPosts.length}</Badge>
          </div>
          
          {approvedPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No approved posts yet. Review pending posts to add them here.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvedPosts.map((post, index) => (
                <PostRow
                  key={post.id}
                  post={{
                    id: post.id,
                    content: post.content,
                    status: post.status as PostStatus,
                    scheduledDate: getScheduledDateForPosition(index),
                    images: post.images ?? undefined,
                    order: post.order,
                  }}
                  index={index}
                  totalPosts={approvedPosts.length}
                  onClick={() => handlePostClick(post.id)}
                  onMoveUp={() => handleMoveUp(post.id)}
                  onMoveDown={() => handleMoveDown(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
