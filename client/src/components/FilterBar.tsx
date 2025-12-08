import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "./StatusBadge";

interface FilterBarProps {
  onStatusChange?: (status: PostStatus | "all") => void;
  counts?: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function FilterBar({ onStatusChange, counts }: FilterBarProps) {
  const [activeStatus, setActiveStatus] = useState<PostStatus | "all">("all");

  const handleStatusClick = (status: PostStatus | "all") => {
    setActiveStatus(status);
    onStatusChange?.(status);
  };

  const statuses: { key: PostStatus | "all"; label: string }[] = [
    { key: "all", label: "All Posts" },
    { key: "pending", label: "Pending Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="flex items-center gap-4 border-b bg-background px-6 py-4">
      <span className="text-sm font-medium text-muted-foreground">Filter:</span>
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map(({ key, label }) => (
          <Button
            key={key}
            variant={activeStatus === key ? "default" : "outline"}
            size="sm"
            onClick={() => handleStatusClick(key)}
            data-testid={`button-filter-status-${key}`}
            className="gap-1.5"
          >
            {label}
            {counts && counts[key as keyof typeof counts] !== undefined && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {counts[key as keyof typeof counts]}
              </Badge>
            )}
          </Button>
        ))}
      </div>
      <div className="ml-auto text-xs text-muted-foreground">
        Posts at the top will be published first
      </div>
    </div>
  );
}
