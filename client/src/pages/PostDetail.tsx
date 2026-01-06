import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Breadcrumb from "@/components/Breadcrumb";
import PostDetailCard from "@/components/PostDetailCard";
import ActionPanel from "@/components/ActionPanel";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@shared/schema";
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
    mutationFn: async ({ id, data }: { id: string; data: { content?: string; images?: string[]; collaborators?: string[] } }) => {
      return apiRequest("PUT", `/api/posts/${id}`, data);
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

  if (!post) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading post...</div>
      </div>
    );
  }

  const handleApprove = async () => {
    if (editedContent !== null || editedImages !== null || editedCollaborators !== null) {
      const data: { content?: string; images?: string[]; collaborators?: string[] } = {};
      if (editedContent !== null) data.content = editedContent;
      if (editedImages !== null) data.images = editedImages;
      if (editedCollaborators !== null) data.collaborators = editedCollaborators;
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

  const handleReject = async () => {
    await updateStatusMutation.mutateAsync({ id: post.id, status: "rejected" });
    
    toast({
      title: "Post Rejected",
      description: "The post has been rejected and won't be published.",
      variant: "destructive",
    });
    setRejectModalOpen(false);
    setLocation("/review");
  };

  const handleSendToReview = async () => {
    if (editedContent !== null || editedImages !== null || editedCollaborators !== null) {
      const data: { content?: string; images?: string[]; collaborators?: string[] } = {};
      if (editedContent !== null) data.content = editedContent;
      if (editedImages !== null) data.images = editedImages;
      if (editedCollaborators !== null) data.collaborators = editedCollaborators;
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
            rowIndex={rowIndex}
            images={editedImages ?? post.images ?? undefined}
            collaborators={editedCollaborators ?? post.collaborators ?? undefined}
            onContentChange={setEditedContent}
            onImagesChange={setEditedImages}
            onCollaboratorsChange={setEditedCollaborators}
          />
        </div>
      </main>

      <ActionPanel
        status={post.status as "pending" | "approved" | "rejected" | "draft"}
        onApprove={() => setApproveModalOpen(true)}
        onReject={() => setRejectModalOpen(true)}
        onSendToReview={() => setSendToReviewModalOpen(true)}
        onPostNow={() => setPostNowModalOpen(true)}
        onDelete={() => setDeleteModalOpen(true)}
        onBack={() => setLocation("/review")}
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

      <ConfirmationModal
        open={rejectModalOpen}
        onOpenChange={setRejectModalOpen}
        title="Reject Post"
        description="This post will be marked as rejected and won't be published. This action cannot be undone."
        confirmLabel="Reject Post"
        variant="destructive"
        onConfirm={handleReject}
      />

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
