import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Breadcrumb from "@/components/Breadcrumb";
import PostDetailCard from "@/components/PostDetailCard";
import ActionPanel from "@/components/ActionPanel";
import ConfirmationModal from "@/components/ConfirmationModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Post, PostLayout } from "@shared/schema";
import type { PostStatus } from "@/components/StatusBadge";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PostDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [sendToReviewModalOpen, setSendToReviewModalOpen] = useState(false);
  const [postNowModalOpen, setPostNowModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [editedImages, setEditedImages] = useState<string[] | null>(null);
  const [editedCollaborators, setEditedCollaborators] = useState<string[] | null>(null);
  const [editedScheduledDate, setEditedScheduledDate] = useState<Date | null>(null);

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
  });

  const post = useMemo(() => {
    return posts.find((p) => p.id === params.id);
  }, [posts, params.id]);

  const approvedPosts = useMemo(() => {
    return posts
      .filter((p) => p.status === "approved")
      .sort((a, b) => a.order - b.order);
  }, [posts]);

  const rowIndex = useMemo(() => {
    if (!post || post.status !== "approved") return 0;
    return approvedPosts.findIndex((p) => p.id === post.id);
  }, [post, approvedPosts]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/posts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { content?: string; images?: string[]; collaborators?: string[]; scheduledDate?: Date } }) => {
      // Convert Date to ISO string for proper JSON serialization
      const payload = {
        ...data,
        scheduledDate: data.scheduledDate ? data.scheduledDate.toISOString() : undefined,
      };
      return apiRequest("PUT", `/api/posts/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const postNowMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/posts/${id}/post-now`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  // Auto-save collaborators when they change
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (editedCollaborators !== null && post) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        updatePostMutation.mutate({ id: post.id, data: { collaborators: editedCollaborators } });
      }, 500);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedCollaborators, post?.id]);

  // Auto-save scheduled date when it changes
  const saveDateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (editedScheduledDate !== null && post) {
      if (saveDateTimeoutRef.current) {
        clearTimeout(saveDateTimeoutRef.current);
      }
      saveDateTimeoutRef.current = setTimeout(() => {
        updatePostMutation.mutate({ id: post.id, data: { scheduledDate: editedScheduledDate } });
      }, 500);
    }
    return () => {
      if (saveDateTimeoutRef.current) {
        clearTimeout(saveDateTimeoutRef.current);
      }
    };
  }, [editedScheduledDate, post?.id]);

  if (!post) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading post...</div>
      </div>
    );
  }

  const handleApprove = async () => {
    if (editedContent !== null || editedImages !== null || editedCollaborators !== null || editedScheduledDate !== null) {
      const data: { content?: string; images?: string[]; collaborators?: string[]; scheduledDate?: Date } = {};
      if (editedContent !== null) data.content = editedContent;
      if (editedImages !== null) data.images = editedImages;
      if (editedCollaborators !== null) data.collaborators = editedCollaborators;
      if (editedScheduledDate !== null) data.scheduledDate = editedScheduledDate;
      await updatePostMutation.mutateAsync({ id: post.id, data });
    }

    await updateStatusMutation.mutateAsync({ id: post.id, status: "approved" });
    
    toast({
      title: "Post Approved",
      description: "The post has been approved and scheduled for publishing.",
    });
    setApproveModalOpen(false);
    setLocation("/review");
  };

  const handleRejectKeepPhotos = async () => {
    await updateStatusMutation.mutateAsync({ id: post.id, status: "rejected" });
    
    toast({
      title: "Post Rejected",
      description: "The post has been rejected. Photos are still available.",
      variant: "destructive",
    });
    setRejectModalOpen(false);
    setLocation("/review");
  };

  const handleRejectDeletePhotos = async () => {
    try {
      // Reject the post and delete the photos from the library
      await apiRequest("POST", `/api/posts/${post.id}/reject-with-delete`);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tagged-photos"] });
      
      toast({
        title: "Post Rejected & Photos Deleted",
        description: "The post has been rejected and photos removed from the library.",
        variant: "destructive",
      });
      setRejectModalOpen(false);
      setLocation("/review");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendToReview = async () => {
    if (editedContent !== null || editedImages !== null || editedCollaborators !== null || editedScheduledDate !== null) {
      const data: { content?: string; images?: string[]; collaborators?: string[]; scheduledDate?: Date } = {};
      if (editedContent !== null) data.content = editedContent;
      if (editedImages !== null) data.images = editedImages;
      if (editedCollaborators !== null) data.collaborators = editedCollaborators;
      if (editedScheduledDate !== null) data.scheduledDate = editedScheduledDate;
      await updatePostMutation.mutateAsync({ id: post.id, data });
    }

    await updateStatusMutation.mutateAsync({ id: post.id, status: "pending" });
    
    toast({
      title: "Sent to Review",
      description: "The post has been sent back to the review queue.",
    });
    setSendToReviewModalOpen(false);
    setLocation("/review");
  };

  const handlePostNow = async () => {
    try {
      await postNowMutation.mutateAsync(post.id);
      toast({
        title: "Posted Successfully",
        description: "The post has been sent to the publishing platform.",
      });
      setPostNowModalOpen(false);
      setLocation("/posted");
    } catch (error) {
      toast({
        title: "Failed to Post",
        description: "There was an error sending the post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(post.id);
    toast({
      title: "Post Deleted",
      description: "The post has been permanently deleted.",
    });
    setDeleteModalOpen(false);
    setLocation("/review");
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-3">
        <Breadcrumb
          items={[
            { label: "Review Post" },
          ]}
        />
      </div>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <PostDetailCard
            id={post.id}
            content={editedContent ?? post.content}
            status={post.status as PostStatus}
            scheduledDate={editedScheduledDate ?? (post.scheduledDate ? new Date(post.scheduledDate) : null)}
            images={editedImages ?? post.images ?? undefined}
            collaborators={editedCollaborators ?? post.collaborators ?? undefined}
            onContentChange={setEditedContent}
            onImagesChange={setEditedImages}
            onCollaboratorsChange={setEditedCollaborators}
            onScheduledDateChange={setEditedScheduledDate}
          />
        </div>
      </main>

      <ActionPanel
        status={post.status as "pending" | "approved" | "rejected" | "draft" | "posted"}
        onApprove={() => setApproveModalOpen(true)}
        onReject={() => setRejectModalOpen(true)}
        onSendToReview={() => setSendToReviewModalOpen(true)}
        onPostNow={() => setPostNowModalOpen(true)}
        onDelete={() => setDeleteModalOpen(true)}
        onBack={() => post.status === "posted" ? setLocation("/posted") : setLocation("/review")}
        isPostingNow={postNowMutation.isPending}
      />

      <ConfirmationModal
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        title="Approve Post"
        description="This post will be scheduled for publishing. Are you sure you want to approve it?"
        confirmLabel="Yes, Approve"
        onConfirm={handleApprove}
      />

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Post</DialogTitle>
            <DialogDescription>
              Why are you rejecting this post?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div
              onClick={handleRejectKeepPhotos}
              className="p-4 border rounded-md cursor-pointer hover-elevate"
              data-testid="button-reject-keep-photos"
            >
              <div className="font-medium">Bad Carousel</div>
              <div className="text-sm text-muted-foreground">Keep the photos, just reject this arrangement</div>
            </div>
            <div
              onClick={handleRejectDeletePhotos}
              className="p-4 border border-destructive bg-destructive/10 rounded-md cursor-pointer hover-elevate"
              data-testid="button-reject-delete-photos"
            >
              <div className="font-medium text-destructive">Bad Photos</div>
              <div className="text-sm text-destructive/80">Delete photos from library permanently</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)} data-testid="button-reject-cancel">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={sendToReviewModalOpen}
        onOpenChange={setSendToReviewModalOpen}
        title="Send to Review"
        description="This post will be sent back to the review queue. Are you sure?"
        confirmLabel="Yes, Send to Review"
        onConfirm={handleSendToReview}
      />

      <ConfirmationModal
        open={postNowModalOpen}
        onOpenChange={setPostNowModalOpen}
        title="Post Now"
        description="This will immediately send the post to Instagram via the webhook. Are you sure you want to post now?"
        confirmLabel="Yes, Post Now"
        onConfirm={handlePostNow}
      />

      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Post"
        description="This will permanently delete this post. This action cannot be undone."
        confirmLabel="Delete Post"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
