import { useState, useMemo } from "react";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import PostRow, { type Post } from "@/components/PostRow";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { PostStatus } from "@/components/StatusBadge";

// todo: remove mock functionality - replace with API data
const initialPosts: Post[] = [
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => statusFilter === "all" || post.status === statusFilter)
      .sort((a, b) => a.order - b.order);
  }, [posts, statusFilter]);

  const counts = useMemo(() => ({
    all: posts.length,
    pending: posts.filter((p) => p.status === "pending").length,
    approved: posts.filter((p) => p.status === "approved").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  }), [posts]);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  const handleMoveUp = (postId: string) => {
    setPosts((currentPosts) => {
      const sorted = [...currentPosts].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((p) => p.id === postId);
      if (index <= 0) return currentPosts;

      const newPosts = [...sorted];
      const currentOrder = newPosts[index].order;
      const prevOrder = newPosts[index - 1].order;
      
      newPosts[index] = { ...newPosts[index], order: prevOrder };
      newPosts[index - 1] = { ...newPosts[index - 1], order: currentOrder };
      
      return newPosts;
    });
  };

  const handleMoveDown = (postId: string) => {
    setPosts((currentPosts) => {
      const sorted = [...currentPosts].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((p) => p.id === postId);
      if (index < 0 || index >= sorted.length - 1) return currentPosts;

      const newPosts = [...sorted];
      const currentOrder = newPosts[index].order;
      const nextOrder = newPosts[index + 1].order;
      
      newPosts[index] = { ...newPosts[index], order: nextOrder };
      newPosts[index + 1] = { ...newPosts[index + 1], order: currentOrder };
      
      return newPosts;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Instagram Post Queue" />
      <FilterBar
        onStatusChange={setStatusFilter}
        counts={counts}
      />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          {filteredPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post, index) => (
                <PostRow
                  key={post.id}
                  post={post}
                  index={index}
                  totalPosts={filteredPosts.length}
                  onClick={() => handlePostClick(post.id)}
                  onMoveUp={() => handleMoveUp(post.id)}
                  onMoveDown={() => handleMoveDown(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
