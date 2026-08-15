import { Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { BrokerMark } from "@/components/BrokerMark";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import {
  type BrokerConnectKind,
  type BrokerDef,
  KIND_LABEL,
  KIND_ORDER,
  searchBrokers,
} from "@/lib/brokers";
import { cn } from "@/lib/cn";

const GROUP_HINT: Record<BrokerConnectKind, string> = {
  sync: "Connect once — new fills arrive on their own.",
  file: "Export a file from the broker; we read the columns for you.",
  manual: "No export needed.",
};

function BrokerCard({ broker, onSelect }: { broker: BrokerDef; onSelect: (key: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(broker.key)}
      className={cn(
        "flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3 text-left",
        "transition-colors hover:bg-accent",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      )}
    >
      <BrokerMark broker={broker} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">{broker.name}</span>
          {/* Sits with the name, not floated right: it is a property of this
              broker, not a status of the row. */}
          {broker.recognised ? (
            <Sparkles
              size={12}
              strokeWidth={1.75}
              aria-label="Columns map themselves"
              className="shrink-0 text-primary"
            />
          ) : null}
        </span>
        {broker.formats ? (
          <span className="truncate text-[11px] text-muted-foreground">{broker.formats}</span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * Step one of the Connect flow: find your broker.
 *
 * Grouped by how the data actually arrives rather than alphabetically — the
 * choice a trader is making here is "sync, file, or by hand", and the broker
 * name is how they find their row within that.
 */
export function BrokerPicker({ onSelect }: { onSelect: (key: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchBrokers(query), [query]);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    brokers: matches.filter((b) => b.kind === kind),
  })).filter((group) => group.brokers.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full sm:max-w-sm">
        <Search
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brokers and platforms"
          aria-label="Search brokers"
          className="w-full *:data-[slot=input]:ps-9"
        />
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title={`No broker matches “${query.trim()}”`}
            hint="Pick “Other broker” to map any CSV by hand, or start a manual account."
            icon={<Search size={28} strokeWidth={1.5} />}
          />
        </Card>
      ) : (
        groups.map((group) => (
          <Card
            key={group.kind}
            title={KIND_LABEL[group.kind]}
            description={GROUP_HINT[group.kind]}
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.brokers.map((broker) => (
                <BrokerCard key={broker.key} broker={broker} onSelect={onSelect} />
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
