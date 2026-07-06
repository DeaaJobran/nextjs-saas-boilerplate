import { EmptyState, ErrorState, LoadingState } from "./states";

const meta = {
  title: "UI/States",
};

export default meta;

export function States() {
  return (
    <div className="grid w-[min(56rem,calc(100vw-2rem))] gap-4">
      <EmptyState
        action={{ label: "Create item" }}
        description="Use this when a feature has no records yet."
        title="No records"
      />
      <LoadingState
        description="Use this while content is being prepared."
        title="Loading content"
      />
      <ErrorState
        action={{ label: "Retry" }}
        description="Use this when the user needs a recovery action."
        title="Unable to load"
      />
    </div>
  );
}
