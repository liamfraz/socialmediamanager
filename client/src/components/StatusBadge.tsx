import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, FileEdit } from "lucide-react";

export type PostStatus = "pending" | "approved" | "rejected" | "draft";

interface StatusBadgeProps {
  status: PostStatus;
}

const statusConfig: Record<PostStatus, { label: string; className: string; icon: typeof Check }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: Check,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: X,
  },
  draft: {
    label: "Draft",
    className: "bg-primary/10 text-primary border-primary/20",
    icon: FileEdit,
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} gap-1`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
