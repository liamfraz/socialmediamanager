import { useMemo, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import DraggablePostCard from "@/components/DraggablePostCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type FilterType = "pending" | "approved" | "rejected";

export default function ReviewPosts() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterType>("pending");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const handleGeneratePosts = async () => {
    setIsGenerating(true);
    try {
      await apiRequest("POST", "/api/trigger-generate");
      
      toast({
        title: "Generation triggered",
        description: "Posts are being generated. They will appear shortly.",
      });
      
      // Refresh posts after a short delay to give n8n time to process
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      }, 3000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger post generation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
      .filter((post) => post.status === activeFilter)
      .sort((a, b) => a.order - b.order);
  }, [posts, activeFilter]);

  useEffect(() => {
    setLocalPosts(filteredPosts);
  }, [filteredPosts]);

  const counts = useMemo(() => ({
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  }), [posts]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = localPosts.findIndex((post) => post.id === active.id);
    const newIndex = localPosts.findIndex((post) => post.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(localPosts, oldIndex, newIndex);
    setLocalPosts(newOrder);

    const updates = newOrder.map((post, index) => ({
      id: post.id,
      order: index + 1,
    }));

    reorderMutation.mutate(updates);
  };

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
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4">
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
        <Button 
          onClick={handleGeneratePosts} 
          disabled={isGenerating}
          data-testid="button-generate-posts"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate Posts
        </Button>
      </div>
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="mx-auto max-w-2xl">
          {localPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localPosts.map((post) => post.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3" data-testid="review-post-list">
                  {localPosts.map((post, index) => (
                    <DraggablePostCard
                      key={post.id}
                      id={post.id}
                      content={post.content}
                      images={post.images ?? undefined}
                      rowIndex={index}
                      onClick={() => handlePostClick(post.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </main>
    </div>
  );
}
