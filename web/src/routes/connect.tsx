import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ConnectView } from "@/app/screens/ConnectView";
import { findBroker } from "@/lib/brokers";
import { soleAccountId, useFilters } from "@/lib/filters";
import { useUI } from "@/lib/ui";

export function validateConnectSearch(search: Record<string, unknown>): { broker?: string } {
  const key = typeof search.broker === "string" ? search.broker : "";
  // An unknown key falls back to the picker rather than an empty screen.
  return findBroker(key) ? { broker: key } : {};
}

export const Route = createFileRoute("/connect")({
  validateSearch: validateConnectSearch,
  component: ConnectPage,
});

function ConnectPage() {
  const { broker } = Route.useSearch();
  const navigate = useNavigate();
  const openModal = useUI((s) => s.openModal);
  const accountId = useFilters((s) => soleAccountId(s.accountIds));

  return (
    <ConnectView
      brokerKey={broker}
      defaultAccountId={accountId}
      onSelectBroker={(key) =>
        void navigate({ to: "/connect", search: key ? { broker: key } : {} })
      }
      onImport={(account, brokerKey) =>
        void navigate({ to: "/import", search: { account, broker: brokerKey } })
      }
      onLogTrade={() => openModal("new-trade")}
      onDone={() => void navigate({ to: "/home" })}
    />
  );
}
