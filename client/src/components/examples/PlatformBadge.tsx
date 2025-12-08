import PlatformBadge from "../PlatformBadge";

export default function PlatformBadgeExample() {
  return (
    <div className="flex flex-wrap gap-3">
      <PlatformBadge platform="facebook" />
      <PlatformBadge platform="instagram" />
      <PlatformBadge platform="linkedin" />
      <PlatformBadge platform="twitter" />
    </div>
  );
}
