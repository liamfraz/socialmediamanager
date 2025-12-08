import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Platform } from "./PlatformBadge";
import type { PostStatus } from "./StatusBadge";

interface FilterBarProps {
  onPlatformChange?: (platform: Platform | "all") => void;
  onStatusChange?: (status: PostStatus | "all") => void;
  counts?: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

export default function FilterBar({ onPlatformChange, onStatusChange, counts }: FilterBarProps) {
  const [activePlatform, setActivePlatform] = useState<Platform | "all">("all");
  const [activeStatus, setActiveStatus] = useState<PostStatus | "all">("all");

  const handlePlatformClick = (platform: Platform | "all") => {
    setActivePlatform(platform);
    onPlatformChange?.(platform);
  };

  const handleStatusClick = (status: PostStatus | "all") => {
    setActiveStatus(status);
    onStatusChange?.(status);
  };

  const platforms: (Platform | "all")[] = ["all", "facebook", "instagram", "linkedin", "twitter"];
  const statuses: { key: PostStatus | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="flex flex-col gap-4 border-b bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Platform:</span>
        {platforms.map((platform) => (
          <Button
            key={platform}
            variant={activePlatform === platform ? "default" : "outline"}
            size="sm"
            onClick={() => handlePlatformClick(platform)}
            data-testid={`button-filter-platform-${platform}`}
            className="capitalize"
          >
            {platform === "all" ? "All" : platform}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
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
    </div>
  );
}
