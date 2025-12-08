import { FileText } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = "No posts found",
  description = "There are no posts matching your current filters.",
}: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <div className="mb-4 rounded-full bg-muted p-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-medium" data-testid="text-empty-title">
        {title}
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground" data-testid="text-empty-description">
        {description}
      </p>
    </div>
  );
}
