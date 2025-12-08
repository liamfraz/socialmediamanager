import ActionPanel from "../ActionPanel";

export default function ActionPanelExample() {
  return (
    <ActionPanel
      onApprove={() => console.log("Approved")}
      onReject={() => console.log("Rejected")}
      onRequestChanges={() => console.log("Request changes")}
      onBack={() => console.log("Back")}
    />
  );
}
