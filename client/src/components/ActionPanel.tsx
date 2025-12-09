import { Button } from "@/components/ui/button";
import { Check, X, ArrowLeft, RotateCcw } from "lucide-react";

interface ActionPanelProps {
  status?: "pending" | "approved" | "rejected" | "draft";
  onApprove?: () => void;
  onReject?: () => void;
  onSendToReview?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export default function ActionPanel({
  status = "pending",
  onApprove,
  onReject,
  onSendToReview,
  onBack,
  isLoading = false,
}: ActionPanelProps) {
  const isApproved = status === "approved";

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
        {isApproved ? (
          <Button
            variant="outline"
            onClick={onSendToReview}
            disabled={isLoading}
            data-testid="button-send-to-review"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Send to Review
          </Button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
