import PostRow from "../PostRow";

export default function PostRowExample() {
  return (
    <div className="space-y-3">
      <PostRow
        post={{
          id: "1",
          content: "Excited to announce our new product launch! Stay tuned for more updates coming next week.",
          status: "pending",
          scheduledDate: new Date("2024-12-15T10:00:00"),
          images: [
            "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
            "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=300&fit=crop",
          ],
          order: 1,
        }}
        index={0}
        totalPosts={2}
        onClick={() => console.log("Clicked")}
        onMoveUp={() => console.log("Move up")}
        onMoveDown={() => console.log("Move down")}
      />
      <PostRow
        post={{
          id: "2",
          content: "Behind the scenes of our latest photoshoot. Stay tuned for the full reveal!",
          status: "approved",
          scheduledDate: new Date("2024-12-16T14:00:00"),
          order: 2,
        }}
        index={1}
        totalPosts={2}
        onClick={() => console.log("Clicked")}
        onMoveUp={() => console.log("Move up")}
        onMoveDown={() => console.log("Move down")}
      />
    </div>
  );
}
