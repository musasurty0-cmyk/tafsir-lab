import StatusPage from "@/components/StatusPage";

export default function SurahNotFound() {
  return (
    <StatusPage
      title="This sūrah isn’t open here."
      body="It may not have been added to this workspace yet, or the workspace isn’t open to you."
    />
  );
}
