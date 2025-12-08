import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import PostRow from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");

  // Seed database on first load if empty
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

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => statusFilter === "all" || post.status === statusFilter)
      .sort((a, b) => a.order - b.order);
  }, [posts, statusFilter]);

  const counts = useMemo(() => ({
    all: posts.length,
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  }), [posts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  const handleMoveUp = (postId: string) => {
    const sorted = [...posts].sort((a, b) => a.order - b.order);
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
    const sorted = [...posts].sort((a, b) => a.order - b.order);
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
        <Header title="Instagram Post Queue" />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground" data-testid="loading-indicator">Loading posts...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Instagram Post Queue" />
      <FilterBar
        onStatusChange={setStatusFilter}
        counts={counts}
      />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {filteredPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post, index) => (
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
                  totalPosts={filteredPosts.length}
                  onClick={() => handlePostClick(post.id)}
                  onMoveUp={() => handleMoveUp(post.id)}
                  onMoveDown={() => handleMoveDown(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
