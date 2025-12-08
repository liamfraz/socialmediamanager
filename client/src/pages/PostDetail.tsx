import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import Header from "@/components/Header";
import Breadcrumb from "@/components/Breadcrumb";
import PostDetailCard from "@/components/PostDetailCard";
import ActionPanel from "@/components/ActionPanel";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@/components/PostRow";

// todo: remove mock functionality - replace with API data
const mockPosts: Post[] = [
  {
    id: "1",
    content: "Excited to announce our new product launch! Stay tuned for more updates coming next week. We can't wait to share what we've been working on.",
    status: "pending",
    scheduledDate: new Date("2024-12-15T10:00:00"),
    images: [
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=600&h=600&fit=crop",
    ],
    order: 1,
  },
  {
    id: "2",
    content: "Join us for our upcoming webinar on digital marketing strategies. Learn from industry experts and take your business to the next level.",
    status: "pending",
    scheduledDate: new Date("2024-12-16T14:00:00"),
    images: ["https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=600&fit=crop"],
    order: 2,
  },
  {
    id: "3",
    content: "Happy Friday everyone! What are your weekend plans? Let us know in the comments below.",
    status: "approved",
    scheduledDate: new Date("2024-12-13T09:00:00"),
    images: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=600&fit=crop",
    ],
    order: 3,
  },
  {
    id: "4",
    content: "Check out our latest blog post about sustainable business practices. Link in bio!",
    status: "rejected",
    scheduledDate: new Date("2024-12-14T11:30:00"),
    order: 4,
  },
  {
    id: "5",
    content: "Behind the scenes of our latest photoshoot. Stay tuned for the full reveal!",
    status: "pending",
    scheduledDate: new Date("2024-12-17T16:00:00"),
    images: [
      "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=600&h=600&fit=crop",
    ],
    order: 5,
  },
  {
    id: "6",
    content: "We're hiring! Join our growing team and be part of something amazing. Check out our careers page for open positions.",
    status: "approved",
    scheduledDate: new Date("2024-12-18T08:00:00"),
    images: ["https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=600&fit=crop"],
    order: 6,
  },
  {
    id: "7",
    content: "Thank you to all our customers for making this year incredible. Here's to an even better next year!",
    status: "pending",
    scheduledDate: new Date("2024-12-20T12:00:00"),
    order: 7,
  },
  {
    id: "8",
    content: "Quick tip: Always proofread your content before posting. A small typo can make a big difference!",
    status: "pending",
    scheduledDate: new Date("2024-12-19T15:00:00"),
    images: [
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=600&fit=crop",
      "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=600&h=600&fit=crop",
    ],
    order: 8,
  },
];

export default function PostDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [editedImages, setEditedImages] = useState<string[] | null>(null);

  const post = useMemo(() => {
    return mockPosts.find((p) => p.id === params.id);
  }, [params.id]);

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header title="Post Not Found" />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold">Post not found</h2>
            <p className="text-muted-foreground">The post you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const handleApprove = () => {
    // todo: replace with API call
    toast({
      title: "Post Approved",
      description: "The post has been approved and scheduled for publishing.",
    });
    setApproveModalOpen(false);
    setLocation("/");
  };

  const handleReject = () => {
    // todo: replace with API call
    toast({
      title: "Post Rejected",
      description: "The post has been rejected and won't be published.",
      variant: "destructive",
    });
    setRejectModalOpen(false);
    setLocation("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Review Post" />
      
      <div className="border-b px-6 py-3">
        <Breadcrumb
          items={[
            { label: "Post Queue", href: "/" },
            { label: "Review Post" },
          ]}
        />
      </div>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <PostDetailCard
            id={post.id}
            content={editedContent ?? post.content}
            status={post.status}
            scheduledDate={post.scheduledDate}
            images={editedImages ?? post.images}
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
