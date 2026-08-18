import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AccountDetailView } from "@/app/screens/AccountDetailView";

export const Route = createFileRoute("/accounts/$accountId")({
  component: AccountDetailPage,
});

function AccountDetailPage() {
  const { accountId } = Route.useParams();
  const navigate = useNavigate();
  const backToAccounts = () => void navigate({ to: "/settings", hash: "accounts" });

  return (
    <AccountDetailView accountId={accountId} onBack={backToAccounts} onDeleted={backToAccounts} />
  );
}
