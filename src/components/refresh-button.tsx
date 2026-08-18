"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface RefreshButtonProps {
  label: string;
}

export function RefreshButton({ label }: Readonly<RefreshButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="button-secondary icon-text-button refresh-button"
      aria-label={label}
      title={label}
      disabled={isPending}
      onClick={() => {
        startTransition(() => router.refresh());
      }}
    >
      <RefreshCw
        size={16}
        aria-hidden="true"
        className={isPending ? "refresh-button__icon--spinning" : undefined}
      />
      <span>Refresh</span>
    </button>
  );
}
