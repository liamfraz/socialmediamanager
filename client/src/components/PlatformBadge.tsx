import { Badge } from "@/components/ui/badge";
import { SiFacebook, SiInstagram, SiLinkedin, SiX } from "react-icons/si";

export type Platform = "facebook" | "instagram" | "linkedin" | "twitter";

interface PlatformBadgeProps {
  platform: Platform;
  showLabel?: boolean;
}

const platformConfig: Record<Platform, { label: string; icon: typeof SiFacebook; color: string }> = {
  facebook: {
    label: "Facebook",
    icon: SiFacebook,
    color: "text-blue-600 dark:text-blue-400",
  },
  instagram: {
    label: "Instagram",
    icon: SiInstagram,
    color: "text-pink-600 dark:text-pink-400",
  },
  linkedin: {
    label: "LinkedIn",
    icon: SiLinkedin,
    color: "text-blue-700 dark:text-blue-500",
  },
  twitter: {
    label: "X",
    icon: SiX,
    color: "text-foreground",
  },
};

export default function PlatformBadge({ platform, showLabel = true }: PlatformBadgeProps) {
  const config = platformConfig[platform];
  const Icon = config.icon;

  return (
    <Badge 
      variant="secondary" 
      className="gap-1.5"
      data-testid={`badge-platform-${platform}`}
    >
      <Icon className={`h-3 w-3 ${config.color}`} />
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}
