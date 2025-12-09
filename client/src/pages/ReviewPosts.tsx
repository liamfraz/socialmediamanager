import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import PostRow from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function ReviewPosts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const pendingPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "pending")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const counts = useMemo(() => ({
    all: posts.length,
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  }), [posts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Review Posts" />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground" data-testid="loading-indicator">Loading posts...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Review Posts" />
      
      <div className="border-b px-6 py-3">
        <p className="text-sm text-muted-foreground">
          Review and approve posts before they appear on your schedule. 
          <span className="ml-2 font-medium text-foreground">{counts.pending} posts pending review</span>
        </p>
      </div>
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {pendingPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {pendingPosts.map((post, index) => (
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
                  totalPosts={pendingPosts.length}
                  onClick={() => handlePostClick(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
