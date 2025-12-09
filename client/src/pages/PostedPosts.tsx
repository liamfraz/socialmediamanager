import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import PostRow from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function PostedPosts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const postedPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "posted")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-3">
        <p className="text-sm text-muted-foreground">
          Posts that have been published.
          <span className="ml-2 font-medium text-foreground">{postedPosts.length} posted</span>
        </p>
      </div>
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {postedPosts.length === 0 ? (
            <EmptyState />
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
      </main>
    </div>
  );
}
