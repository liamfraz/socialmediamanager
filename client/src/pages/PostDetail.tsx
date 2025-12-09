import { useState } from "react";
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
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [editedImages, setEditedImages] = useState<string[] | null>(null);

  const { data: post, isLoading } = useQuery<Post>({
    queryKey: ["/api/posts", params.id],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/posts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { content?: string; images?: string[] } }) => {
      return apiRequest("PUT", `/api/posts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted-foreground" data-testid="loading-indicator">Loading post...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold" data-testid="text-not-found">Post not found</h2>
          <p className="text-muted-foreground">The post you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const handleApprove = async () => {
    if (editedContent !== null || editedImages !== null) {
      const data: { content?: string; images?: string[] } = {};
      if (editedContent !== null) data.content = editedContent;
      if (editedImages !== null) data.images = editedImages;
      await updatePostMutation.mutateAsync({ id: post.id, data });
    }

    await updateStatusMutation.mutateAsync({ id: post.id, status: "approved" });
    
    toast({
      title: "Post Approved",
      description: "The post has been approved and scheduled for publishing.",
    });
    setApproveModalOpen(false);
    setLocation("/");
  };

  const handleReject = async () => {
    await updateStatusMutation.mutateAsync({ id: post.id, status: "rejected" });
    
    toast({
      title: "Post Rejected",
      description: "The post has been rejected and won't be published.",
      variant: "destructive",
    });
    setRejectModalOpen(false);
    setLocation("/");
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
            scheduledDate={new Date(post.scheduledDate)}
            images={editedImages ?? post.images ?? undefined}
            onContentChange={setEditedContent}
            onImagesChange={setEditedImages}
          />
        </div>
      </main>

      <ActionPanel
        onApprove={() => setApproveModalOpen(true)}
        onReject={() => setRejectModalOpen(true)}
        onBack={() => setLocation("/")}
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
    </div>
  );
}
