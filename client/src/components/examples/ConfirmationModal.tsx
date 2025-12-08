import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmationModal from "../ConfirmationModal";

export default function ConfirmationModalExample() {
  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);

  return (
    <div className="flex gap-3">
      <Button onClick={() => setOpenApprove(true)}>Show Approve Modal</Button>
      <Button variant="destructive" onClick={() => setOpenReject(true)}>Show Reject Modal</Button>

      <ConfirmationModal
        open={openApprove}
        onOpenChange={setOpenApprove}
        title="Approve Post"
        description="This post will be scheduled for publishing. Are you sure you want to approve it?"
        confirmLabel="Yes, Approve"
        onConfirm={() => {
          console.log("Post approved");
          setOpenApprove(false);
        }}
      />

      <ConfirmationModal
        open={openReject}
        onOpenChange={setOpenReject}
        title="Reject Post"
        description="This post will be marked as rejected and won't be published. This action cannot be undone."
        confirmLabel="Reject Post"
        variant="destructive"
        onConfirm={() => {
          console.log("Post rejected");
          setOpenReject(false);
        }}
      />
    </div>
  );
}
