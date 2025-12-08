import PostCard from "../PostCard";

export default function PostCardExample() {
  return (
    <div className="max-w-sm">
      <PostCard
        post={{
          id: "1",
          content: "Excited to announce our new product launch! Stay tuned for more updates coming next week. We can't wait to share what we've been working on.",
          platform: "instagram",
          status: "pending",
          scheduledDate: new Date("2024-12-15T10:00:00"),
          imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
        }}
        onClick={() => console.log("Card clicked")}
      />
    </div>
  );
}
