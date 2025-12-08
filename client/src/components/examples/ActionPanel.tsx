import ActionPanel from "../ActionPanel";

export default function ActionPanelExample() {
  return (
    <ActionPanel
      onApprove={() => console.log("Approved")}
      onReject={() => console.log("Rejected")}
      onBack={() => console.log("Back")}
    />
  );
}
