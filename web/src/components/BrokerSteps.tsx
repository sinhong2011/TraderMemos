import type { BrokerDef } from "@/lib/brokers";

/** A broker's export instructions, in its own menu vocabulary. */
export function BrokerSteps({ broker }: { broker: BrokerDef }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {broker.steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <span className="mt-px inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {broker.note ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {broker.note}
        </p>
      ) : null}
      {/* Only meaningful where a file gets mapped — a Flex sync has no columns
          for the trader to bind. */}
      {broker.recognised && broker.kind === "file" ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          We recognise this export&apos;s layout — the column mapping fills itself in.
        </p>
      ) : null}
    </div>
  );
}
