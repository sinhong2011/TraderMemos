import { createFileRoute } from "@tanstack/react-router";
import { PublicShareView } from "@/app/screens/PublicShareView";

export const Route = createFileRoute("/s/$token")({
  component: PublicShareScreen,
});

function PublicShareScreen() {
  const { token } = Route.useParams();
  return <PublicShareView token={token} />;
}
