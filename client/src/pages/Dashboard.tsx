import { useMemo, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import DraggablePostCard from "@/components/DraggablePostCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CheckCircle2, Pause, Play } from "lucide-react";
import { addDays, format, isToday, isTomorrow } from "date-fns";
import type { Post, PostingSettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function WeekAheadCalendar({ posts }: { posts: Post[] }) {
  const today = new Date();
  const days = Array.from({ length: 6 }, (_, i) => addDays(today, i + 1));

  // Match posts to their actual scheduled dates
  const getPostForDay = (day: Date) => {
    return posts.find(post => {
      if (!post.scheduledDate) return false;
      const postDate = new Date(post.scheduledDate);
      return postDate.toDateString() === day.toDateString();
    });
  };

  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold">Upcoming Schedule</h3>
      <div className="grid grid-cols-6 gap-3">
        {days.map((day, index) => {
          const post = getPostForDay(day);
          const hasPost = !!post;
          const firstImage = post?.images?.[0];
          const dayName = isTomorrow(day) ? "Tomorrow" : format(day, "EEE");
          const dayNum = format(day, "d");
          const month = format(day, "MMM");
          
          return (
            <div
              key={index}
              className={`flex flex-col items-center rounded-lg p-3 text-center ${
                hasPost 
                  ? "bg-primary/10 border border-primary/20" 
                  : "bg-muted/50"
              }`}
              data-testid={`calendar-day-${index}`}
            >
              <span className="text-xs font-medium text-muted-foreground">{dayName}</span>
              <span className="text-2xl font-bold">{dayNum}</span>
              <span className="text-xs text-muted-foreground mb-2">{month}</span>
              {firstImage ? (
                <div className="h-16 w-16 overflow-hidden rounded-md">
                  <img 
                    src={firstImage} 
                    alt="" 
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : hasPost ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
                  <span className="text-xs text-muted-foreground">No image</span>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-md border-2 border-dashed border-muted-foreground/20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    apiRequest("POST", "/api/seed").catch(() => {});
  }, []);

  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const { data: postingSettings } = useQuery<PostingSettings>({
    queryKey: ["/api/posting-settings"],
  });

  const isPaused = postingSettings?.isPaused === "true";

  const togglePauseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/posting-settings", {
        isPaused: !isPaused,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posting-settings"] });
    },
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
      return apiRequest("PUT", `/api/posts/${postId}`, { scheduledDate: scheduledDate.toISOString() });
    },
    onSuccess: () => {
      toast({ title: "Schedule updated", description: "The scheduled date and time have been updated." });
    },
  });

  const handleTimeChange = (postId: string, newDate: Date) => {
    // Optimistic update - update local state immediately and re-sort by date
    setLocalPosts(prev => {
      const updated = prev.map(p => 
        p.id === postId ? { ...p, scheduledDate: newDate } : p
      );
      // Re-sort by scheduled date (earliest first)
      return updated.sort((a, b) => {
        const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return dateA - dateB;
      });
    });
    updateTimeMutation.mutate({ postId, scheduledDate: newDate });
  };

  const approvedPosts = useMemo(() => {
    return posts
      .filter((post) => post.status === "approved")
      .sort((a, b) => {
        // Sort by scheduled date (earliest first)
        const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return dateA - dateB;
      });
  }, [posts]);

  useEffect(() => {
    setLocalPosts(approvedPosts);
  }, [approvedPosts]);

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
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <WeekAheadCalendar posts={localPosts} />
        
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold">Ready to Post</h2>
              <Badge variant="outline">{localPosts.length}</Badge>
            </div>
            <Button
              variant={isPaused ? "default" : "outline"}
              size="sm"
              onClick={() => togglePauseMutation.mutate()}
              disabled={togglePauseMutation.isPending}
              data-testid="button-toggle-pause"
            >
              {isPaused ? (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  Resume Posting
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-4 w-4" />
                  Pause Posting
                </>
              )}
            </Button>
          </div>
          
          {localPosts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No approved posts yet. Review pending posts to add them here.</p>
            </Card>
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
                <div className="space-y-3" data-testid="post-list">
                  {localPosts.map((post) => (
                    <DraggablePostCard
                      key={post.id}
                      id={post.id}
                      content={post.content}
                      images={post.images ?? undefined}
                      scheduledDate={new Date(post.scheduledDate)}
                      onTimeChange={handleTimeChange}
                      onClick={() => handlePostClick(post.id)}
                      isPaused={isPaused}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
