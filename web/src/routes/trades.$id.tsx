import { createFileRoute } from "@tanstack/react-router";

// Placeholder route so /trades/$id navigation resolves. The full trade-detail
// screen (journal, fills, screenshots) is built in a later task.
export const Route = createFileRoute("/trades/$id")({
  component: TradeDetailPage,
});

function TradeDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
      Trade detail for {id} - coming soon.
    </div>
  );
}
