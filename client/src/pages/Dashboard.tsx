import { useState, useMemo } from "react";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import PostCard, { type Post } from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { useLocation } from "wouter";
import type { Platform } from "@/components/PlatformBadge";
import type { PostStatus } from "@/components/StatusBadge";

// todo: remove mock functionality - replace with API data
const mockPosts: Post[] = [
  {
    id: "1",
    content: "Excited to announce our new product launch! Stay tuned for more updates coming next week. We can't wait to share what we've been working on.",
    platform: "instagram",
    status: "pending",
    scheduledDate: new Date("2024-12-15T10:00:00"),
    imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
  },
  {
    id: "2",
    content: "Join us for our upcoming webinar on digital marketing strategies. Learn from industry experts and take your business to the next level.",
    platform: "linkedin",
    status: "pending",
    scheduledDate: new Date("2024-12-16T14:00:00"),
  },
  {
    id: "3",
    content: "Happy Friday everyone! What are your weekend plans? Let us know in the comments below.",
    platform: "facebook",
    status: "approved",
    scheduledDate: new Date("2024-12-13T09:00:00"),
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
  },
  {
    id: "4",
    content: "Check out our latest blog post about sustainable business practices. Link in bio!",
    platform: "twitter",
    status: "rejected",
    scheduledDate: new Date("2024-12-14T11:30:00"),
  },
  {
    id: "5",
    content: "Behind the scenes of our latest photoshoot. Stay tuned for the full reveal!",
    platform: "instagram",
    status: "pending",
    scheduledDate: new Date("2024-12-17T16:00:00"),
    imageUrl: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&h=300&fit=crop",
  },
  {
    id: "6",
    content: "We're hiring! Join our growing team and be part of something amazing. Check out our careers page for open positions.",
    platform: "linkedin",
    status: "approved",
    scheduledDate: new Date("2024-12-18T08:00:00"),
  },
  {
    id: "7",
    content: "Thank you to all our customers for making this year incredible. Here's to an even better next year!",
    platform: "facebook",
    status: "pending",
    scheduledDate: new Date("2024-12-20T12:00:00"),
  },
  {
    id: "8",
    content: "Quick tip: Always proofread your content before posting. A small typo can make a big difference!",
    platform: "twitter",
    status: "pending",
    scheduledDate: new Date("2024-12-19T15:00:00"),
  },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");

  const filteredPosts = useMemo(() => {
    return mockPosts.filter((post) => {
      const matchesPlatform = platformFilter === "all" || post.platform === platformFilter;
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      return matchesPlatform && matchesStatus;
    });
  }, [platformFilter, statusFilter]);

  const counts = useMemo(() => ({
    all: mockPosts.length,
    pending: mockPosts.filter((p) => p.status === "pending").length,
    approved: mockPosts.filter((p) => p.status === "approved").length,
    rejected: mockPosts.filter((p) => p.status === "rejected").length,
  }), []);

  const handlePostClick = (postId: string) => {
    setLocation(`/post/${postId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Post Review Dashboard" />
      <FilterBar
        onPlatformChange={setPlatformFilter}
        onStatusChange={setStatusFilter}
        counts={counts}
      />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          {filteredPosts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => handlePostClick(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
