import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, ArrowLeft, RotateCcw, Send, Trash2, MoveRight } from "lucide-react";

interface ActionPanelProps {
  status?: "pending" | "approved" | "rejected" | "draft" | "posted";
  onApprove?: () => void;
  onReject?: () => void;
  onSendToReview?: () => void;
  onPostNow?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  isPostingNow?: boolean;
}

export default function ActionPanel({
  status = "pending",
  onApprove,
  onReject,
  onSendToReview,
  onPostNow,
  onDelete,
  onBack,
  isLoading = false,
  isPostingNow = false,
}: ActionPanelProps) {
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isPosted = status === "posted";

  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 border-t bg-background px-6 py-4">
      <Button
        variant="ghost"
        onClick={onBack}
        disabled={isLoading || isPostingNow}
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {isPosted ? "Back to Posted" : "Back to Review Posts"}
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        {isPosted ? (
          showMoveOptions ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowMoveOptions(false)}
                disabled={isLoading}
                data-testid="button-cancel-move"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={onSendToReview}
                disabled={isLoading}
                data-testid="button-move-to-review"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Move to Review
              </Button>
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isLoading}
                data-testid="button-delete-post"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Post
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowMoveOptions(true)}
              disabled={isLoading}
              data-testid="button-move-post"
            >
              <MoveRight className="mr-2 h-4 w-4" />
              Move Post
            </Button>
          )
        ) : isApproved ? (
          <>
            <Button
              variant="outline"
              onClick={onSendToReview}
              disabled={isLoading || isPostingNow}
              data-testid="button-send-to-review"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Send to Review
            </Button>
            <Button
              onClick={onPostNow}
              disabled={isLoading || isPostingNow}
              data-testid="button-post-now"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPostingNow ? "Posting..." : "Post Now"}
            </Button>
          </>
        ) : isRejected ? (
          <>
            <Button
              variant="outline"
              onClick={onSendToReview}
              disabled={isLoading}
              data-testid="button-send-to-review"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Send to Review
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isLoading}
              data-testid="button-delete-post"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Post
            </Button>
          </>
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
