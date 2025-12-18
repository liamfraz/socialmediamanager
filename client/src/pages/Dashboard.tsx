import { useMemo, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import DraggablePostCard from "@/components/DraggablePostCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { addDays, format, isToday, isTomorrow } from "date-fns";
import type { Post } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

function WeekAheadCalendar({ posts }: { posts: Post[] }) {
  const today = new Date();
  const days = Array.from({ length: 6 }, (_, i) => addDays(today, i + 1));

  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold">Upcoming Schedule</h3>
      <div className="grid grid-cols-6 gap-3">
        {days.map((day, index) => {
          const post = posts[index];
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
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold">Ready to Post</h2>
            <Badge variant="outline" className="ml-2">{localPosts.length}</Badge>
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
                      onClick={() => handlePostClick(post.id)}
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
