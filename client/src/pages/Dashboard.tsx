import { useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import PostRow from "@/components/PostRow";
import PostCalendar, { type CalendarPost } from "@/components/PostCalendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, Link } from "wouter";
import { ClipboardList, CheckCircle2, Send } from "lucide-react";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

  const postedPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "posted")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const pendingCount = useMemo(() => {
    return posts.filter((p) => p.status === "pending").length;
  }, [posts]);

  const calendarPosts: CalendarPost[] = useMemo(() => {
    return approvedPosts.map(post => ({
      id: post.id,
      content: post.content,
      status: post.status,
      scheduledDate: new Date(post.scheduledDate),
    }));
  }, [approvedPosts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  const handleMoveUp = (postId: string) => {
    const sorted = [...approvedPosts].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((p) => p.id === postId);
    if (index <= 0) return;

    const currentOrder = sorted[index].order;
    const prevOrder = sorted[index - 1].order;
    
    reorderMutation.mutate([
      { id: sorted[index].id, order: prevOrder },
      { id: sorted[index - 1].id, order: currentOrder },
    ]);
  };

  const handleMoveDown = (postId: string) => {
    const sorted = [...approvedPosts].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((p) => p.id === postId);
    if (index < 0 || index >= sorted.length - 1) return;

    const currentOrder = sorted[index].order;
    const nextOrder = sorted[index + 1].order;
    
    reorderMutation.mutate([
      { id: sorted[index].id, order: nextOrder },
      { id: sorted[index + 1].id, order: currentOrder },
    ]);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground" data-testid="loading-indicator">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href="/review">
            <Card className="flex items-center justify-between p-4 hover-elevate cursor-pointer" data-testid="link-review-posts">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
                  <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-medium">Review Posts</h2>
                  <p className="text-sm text-muted-foreground">Review and approve pending posts</p>
                </div>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1.5">
                {pendingCount} pending
              </Badge>
            </Card>
          </Link>

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
                      scheduledDate: new Date(post.scheduledDate),
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

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold">Posted</h2>
              <Badge variant="outline" className="ml-2">{postedPosts.length}</Badge>
            </div>
            
            {postedPosts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No posts have been published yet.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {postedPosts.map((post, index) => (
                  <PostRow
                    key={post.id}
                    post={{
                      id: post.id,
                      content: post.content,
                      status: post.status as PostStatus,
                      scheduledDate: new Date(post.scheduledDate),
                      images: post.images ?? undefined,
                      order: post.order,
                    }}
                    index={index}
                    totalPosts={postedPosts.length}
                    onClick={() => handlePostClick(post.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
