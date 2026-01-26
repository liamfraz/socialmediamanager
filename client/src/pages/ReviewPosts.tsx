import { useMemo, useEffect, useState, useRef, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2, Pause, Play, CheckCircle, RefreshCw, AlertCircle, Check } from "lucide-react";
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
  const [postTopics, setPostTopics] = useState<string[]>([""]);
  const [generationStatus, setGenerationStatus] = useState<Record<number, "pending" | "generating" | "done" | "error">>({});
  const [generationErrors, setGenerationErrors] = useState<Record<number, string>>({});
  const [newlyCreatedPosts, setNewlyCreatedPosts] = useState<Set<string>>(new Set());
  const knownPostIdsRef = useRef<Set<string>>(new Set());
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
    setPostTopics([""]);
    setShowGenerateDialog(true);
  };

  const handlePostCountChange = (value: string) => {
    const count = parseInt(value);
    setPostTopics(prev => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill("")];
      } else {
        return prev.slice(0, count);
      }
    });
  };

  const handleTopicChange = (index: number, value: string) => {
    setPostTopics(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleGeneratePosts = async () => {
    const filledTopics = postTopics.filter(t => t.trim());
    if (filledTopics.length === 0) {
      toast({
        title: "Topic required",
        description: "Please enter at least one topic for the post.",
        variant: "destructive",
      });
      return;
    }

    // Initialize generation status for all topics
    const initialStatus: Record<number, "pending" | "generating" | "done" | "error"> = {};
    filledTopics.forEach((_, i) => {
      initialStatus[i] = "generating";
    });
    setGenerationStatus(initialStatus);
    setGenerationErrors({});
    setIsGenerating(true);

    try {
      const response = await apiRequest("POST", "/api/generate-posts", {
        topics: filledTopics.map(t => t.trim())
      });
      const data = await response.json();

      // Update status based on results
      const newStatus: Record<number, "pending" | "generating" | "done" | "error"> = {};
      const newErrors: Record<number, string> = {};

      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((result: any, index: number) => {
          if (result.success) {
            newStatus[index] = "done";
          } else {
            newStatus[index] = "error";
            newErrors[index] = result.error || "Generation failed";
          }
        });
      }

      setGenerationStatus(newStatus);
      setGenerationErrors(newErrors);

      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const failCount = data.results?.filter((r: any) => !r.success).length || 0;

      if (successCount > 0) {
        toast({
          title: "Posts generated",
          description: `${successCount} post${successCount > 1 ? 's' : ''} created successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      } else {
        toast({
          title: "Generation failed",
          description: data.error || "No posts were generated. Check your photo library.",
          variant: "destructive",
        });
      }

      // Close dialog after a short delay to show completion status
      setTimeout(() => {
        setShowGenerateDialog(false);
        setIsGenerating(false);
        setPostTopics([""]);
        setGenerationStatus({});
        setGenerationErrors({});
      }, failCount > 0 ? 3000 : 1500);

    } catch (error: any) {
      // Mark all as error
      const errorStatus: Record<number, "pending" | "generating" | "done" | "error"> = {};
      filledTopics.forEach((_, i) => {
        errorStatus[i] = "error";
      });
      setGenerationStatus(errorStatus);

      const errorMessage = error?.message || "Failed to generate posts. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      setTimeout(() => {
        setIsGenerating(false);
        setShowGenerateDialog(false);
        setPostTopics([""]);
        setGenerationStatus({});
        setGenerationErrors({});
      }, 2000);
    }
  };

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    refetchInterval: isGenerating ? 2000 : false, // Poll every 2 seconds while generating
  });

  // Track new posts that appear after generation starts
  useEffect(() => {
    if (posts.length > 0) {
      const currentIds = new Set(posts.map(p => p.id));
      
      // Find posts that are new (not in our known list)
      const newPostIds = posts
        .filter(p => !knownPostIdsRef.current.has(p.id))
        .map(p => p.id);
      
      if (newPostIds.length > 0 && knownPostIdsRef.current.size > 0) {
        // Only mark as new if we had known posts before (not on initial load)
        setNewlyCreatedPosts(prev => new Set([...Array.from(prev), ...newPostIds]));
        
        // Clear the "newly created" status after 4 seconds
        setTimeout(() => {
          setNewlyCreatedPosts(prev => {
            const next = new Set(prev);
            newPostIds.forEach(id => next.delete(id));
            return next;
          });
        }, 4000);
      }
      
      // Update our known IDs reference
      knownPostIdsRef.current = currentIds;
    }
  }, [posts]);

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
      return apiRequest("PUT", `/api/posts/${postId}`, { scheduledDate: scheduledDate.toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Time updated", description: "The scheduled time has been updated." });
    },
  });

  const handleTimeChange = (postId: string, newDate: Date) => {
    // Optimistic update with re-sort
    setLocalPosts(prev => {
      const updated = prev.map(p => 
        p.id === postId ? { ...p, scheduledDate: newDate } : p
      );
      // Re-sort by scheduled date (earliest first) for approved posts
      if (activeFilter === "approved") {
        return updated.sort((a, b) => {
          const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          return dateA - dateB;
        });
      }
      return updated;
    });
    updateTimeMutation.mutate({ postId, scheduledDate: newDate });
  };

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === activeFilter)
      .sort((a, b) => {
        // Sort by scheduled date (earliest first) for approved posts, otherwise by order
        if (activeFilter === "approved") {
          const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          return dateA - dateB;
        }
        return a.order - b.order;
      });
  }, [posts, activeFilter]);

  useEffect(() => {
    // Only update if the post IDs or order have changed to prevent infinite loops
    const filteredIds = filteredPosts.map(p => p.id).join(',');
    const localIds = localPosts.map(p => p.id).join(',');
    if (filteredIds !== localIds) {
      setLocalPosts(filteredPosts);
    }
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
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/posts"] })}
            data-testid="button-refresh-posts"
            title="Refresh posts"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Posts</DialogTitle>
            <DialogDescription>
              What do you want {postTopics.length === 1 ? 'the post' : 'each post'} to be about?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="post-count" className="whitespace-nowrap">Number of posts</Label>
              <Select value={String(postTopics.length)} onValueChange={handlePostCountChange} disabled={isGenerating}>
                <SelectTrigger id="post-count" className="w-24" data-testid="select-post-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {postTopics.map((topic, index) => (
                <div key={index} className="flex items-center gap-2">
                  {postTopics.length > 1 && (
                    <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                  )}
                  <Input
                    value={topic}
                    onChange={(e) => handleTopicChange(index, e.target.value)}
                    placeholder="A bride holding flowers"
                    data-testid={`input-post-topic-${index}`}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && index === postTopics.length - 1 && !isGenerating) {
                        handleGeneratePosts();
                      }
                    }}
                  />
                  {/* Status indicator - always reserve space to prevent jitter */}
                  <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {generationStatus[index] === "generating" && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {generationStatus[index] === "done" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {generationStatus[index] === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-500" title={generationErrors[index]} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGeneratePosts}
              disabled={isGenerating}
              data-testid="button-submit-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
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
                      createdAt={post.createdAt ? new Date(post.createdAt) : undefined}
                      onTimeChange={handleTimeChange}
                      onClick={() => handlePostClick(post.id)}
                      showDateTime={activeFilter === "approved" || activeFilter === "posted"}
                      showCreatedDate={activeFilter === "pending"}
                      isNewlyCreated={newlyCreatedPosts.has(post.id)}
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
