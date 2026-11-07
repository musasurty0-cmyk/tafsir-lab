import StatusPage from "@/components/StatusPage";

export default function WorkspaceNotFound() {
  return (
    <StatusPage
      title="This workspace isn’t open to you."
      body="It may have been deleted, or you haven’t been added to it yet. An invite link from its owner will let you in."
    />
  );
}
