import { Button } from "@/components/ui/button";
import { Check, X, ArrowLeft, MessageSquare } from "lucide-react";

interface ActionPanelProps {
  onApprove?: () => void;
  onReject?: () => void;
  onRequestChanges?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export default function ActionPanel({
  onApprove,
  onReject,
  onRequestChanges,
  onBack,
  isLoading = false,
}: ActionPanelProps) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 border-t bg-background px-6 py-4">
      <Button
        variant="ghost"
        onClick={onBack}
        disabled={isLoading}
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={onRequestChanges}
          disabled={isLoading}
          data-testid="button-request-changes"
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Request Changes
        </Button>

        <Button
          variant="outline"
          onClick={onReject}
          disabled={isLoading}
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          data-testid="button-reject"
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>

        <Button
          onClick={onApprove}
          disabled={isLoading}
          data-testid="button-approve"
        >
          <Check className="mr-2 h-4 w-4" />
          Approve Post
        </Button>
      </div>
    </div>
  );
}
