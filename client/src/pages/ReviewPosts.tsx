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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2, Pause, Play, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post, PostingSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type FilterType = "pending" | "approved" | "rejected" | "posted";

export default function ReviewPosts() {
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterType>("pending");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [postTopic, setPostTopic] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
    // Recalculate dates on initial load
    apiRequest("POST", "/api/posts/recalculate-dates").catch(() => {});
  }, []);

  // Fetch posting settings
  const { data: postingSettings } = useQuery<PostingSettings>({
    queryKey: ["/api/posting-settings"],
  });

  // Toggle pause mutation
  const togglePauseMutation = useMutation({
    mutationFn: async (isPaused: boolean) => {
      return apiRequest("PATCH", "/api/posting-settings", { isPaused });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posting-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const isPaused = postingSettings?.isPaused === "true";

  const handleOpenGenerateDialog = () => {
    setPostTopic("");
    setShowGenerateDialog(true);
  };

  const handleGeneratePosts = async () => {
    if (!postTopic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter what you want the post to be about.",
        variant: "destructive",
      });
      return;
    }

    setShowGenerateDialog(false);
    setIsGenerating(true);
    try {
      await apiRequest("POST", "/api/trigger-generate", { topic: postTopic.trim() });
      
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
      setPostTopic("");
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

  const updateTimeMutation = useMutation({
    mutationFn: async ({ postId, scheduledDate }: { postId: string; scheduledDate: Date }) => {
      return apiRequest("PUT", `/api/posts/${postId}`, { scheduledDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Time updated", description: "The scheduled time has been updated." });
    },
  });

  const handleTimeChange = (postId: string, newDate: Date) => {
    updateTimeMutation.mutate({ postId, scheduledDate: newDate });
  };

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
    posted: posts.filter((p) => p.status === "posted").length,
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
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterType)}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
              Pending
              <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2" data-testid="tab-approved">
              Ready to Post
              <Badge variant="secondary" className="ml-1">{counts.approved}</Badge>
            </TabsTrigger>
            <TabsTrigger value="posted" className="gap-2" data-testid="tab-posted">
              Posted
              <Badge variant="secondary" className="ml-1">{counts.posted}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2" data-testid="tab-rejected">
              Rejected
              <Badge variant="secondary" className="ml-1">{counts.rejected}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-4 flex-wrap">
          {activeFilter === "approved" && (
            <Button
              variant={isPaused ? "outline" : "default"}
              size="sm"
              onClick={() => togglePauseMutation.mutate(!isPaused)}
              disabled={togglePauseMutation.isPending}
              data-testid="button-toggle-pause"
            >
              {isPaused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume Posting
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Posting
                </>
              )}
            </Button>
          )}
          <Button 
            onClick={handleOpenGenerateDialog} 
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
      </div>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Posts</DialogTitle>
            <DialogDescription>
              What do you want the post to be about?
            </DialogDescription>
          </DialogHeader>
          <Input
            value={postTopic}
            onChange={(e) => setPostTopic(e.target.value)}
            placeholder="e.g., Tips for small business owners"
            data-testid="input-post-topic"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleGeneratePosts();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePosts} data-testid="button-submit-generate">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <main className="flex-1 p-6 overflow-auto">
        <div className="mx-auto max-w-2xl">
          {activeFilter === "approved" && counts.approved > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              {isPaused ? (
                <>
                  <Pause className="h-4 w-4 text-orange-500" />
                  <span>Posting is paused. Posts will be delayed until resumed.</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Auto-posting enabled. Posts will be sent at their scheduled times.</span>
                </>
              )}
            </div>
          )}
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
                  {localPosts.map((post) => (
                    <DraggablePostCard
                      key={post.id}
                      id={post.id}
                      content={post.content}
                      images={post.images ?? undefined}
                      scheduledDate={new Date(post.scheduledDate)}
                      onTimeChange={handleTimeChange}
                      onClick={() => handlePostClick(post.id)}
                      showDateTime={activeFilter !== "pending"}
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
