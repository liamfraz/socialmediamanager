import PostDetailCard from "../PostDetailCard";

export default function PostDetailCardExample() {
  return (
    <div className="max-w-2xl">
      <PostDetailCard
        id="1"
        content="Excited to announce our new product launch! Stay tuned for more updates coming next week."
        status="pending"
        scheduledDate={new Date("2024-12-15T10:00:00")}
        images={[
          "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=600&fit=crop",
          "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&h=600&fit=crop",
        ]}
        onContentChange={(c) => console.log("Content changed:", c)}
      />
    </div>
  );
}
