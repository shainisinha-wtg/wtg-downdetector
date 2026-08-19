"use client";

import { useActionState } from "react";

type CancelActionState = {
  error?: string;
  success?: boolean;
};

type MaintenanceCancelButtonProps = Readonly<{
  action: () => Promise<CancelActionState>;
}>;

export function MaintenanceCancelButton({
  action,
}: MaintenanceCancelButtonProps) {
  const [state, formAction, isPending] = useActionState(
    async () => action(),
    {},
  );

  return (
    <form action={formAction}>
      <button type="submit" className="button-secondary" disabled={isPending}>
        {isPending ? "Canceling..." : "Cancel"}
      </button>
      {state.error && (
        <span className="cell-meta" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
