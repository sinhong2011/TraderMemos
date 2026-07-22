import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TradeDetailView } from "../app/screens/TradeDetailView";
import { useToastManager } from "../components/Toast";
import { useDeleteTrade, useTradeDetail } from "../lib/hooks/useTradeDetail";
import { useUI } from "../lib/ui";

export const Route = createFileRoute("/trades/$id")({
  component: TradeDetailPage,
});

function TradeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const toast = useToastManager();
  const openTradeEdit = useUI((s) => s.openTradeEdit);
  const detailQ = useTradeDetail(id);
  const deleteTrade = useDeleteTrade();

  return (
    <TradeDetailView
      trade={detailQ.data}
      loading={detailQ.isLoading}
      error={detailQ.isError}
      onBack={() => navigate({ to: "/trades" })}
      onEdit={() => {
        if (detailQ.data) openTradeEdit(detailQ.data);
      }}
      deleting={deleteTrade.isPending}
      onDelete={async () => {
        try {
          await deleteTrade.mutateAsync(id);
          toast.add({ title: "Trade removed", description: detailQ.data?.symbol });
          await navigate({ to: "/trades" });
        } catch {
          toast.add({
            title: "Could not remove trade",
            description: "Try again in a moment",
          });
        }
      }}
    />
  );
}
