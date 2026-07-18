import { Button } from "./ui/button";

export function RouteErrorPanel({ error }: { error: Error }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-8">
      <p className="text-[11px] tracking-[0.1em] text-signal uppercase">Screen error</p>
      <p className="max-w-[480px] text-center text-[13px] text-text">
        This screen crashed. The rest of the app is unaffected.
      </p>
      <pre className="max-w-full overflow-x-auto rounded-control border border-border bg-bg-inset px-3 py-2 text-[11px] text-loss">
        {error.message}
      </pre>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
