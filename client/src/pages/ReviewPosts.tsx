import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import PostRow from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "@/components/StatusBadge";
import type { Post } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type FilterType = "pending" | "approved" | "rejected";

export default function ReviewPosts() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterType>("pending");

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === activeFilter)
      .sort((a, b) => a.order - b.order);
  }, [posts, activeFilter]);

  const counts = useMemo(() => ({
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
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground" data-testid="loading-indicator">Loading posts...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <div className="border-b px-6 py-3">
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterType)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
              Pending
              <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2" data-testid="tab-approved">
              Approved
              <Badge variant="secondary" className="ml-1">{counts.approved}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2" data-testid="tab-rejected">
              Rejected
              <Badge variant="secondary" className="ml-1">{counts.rejected}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
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
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
