"use client";

import { useAuthUser } from "@/components/auth/use-auth-user";
import Link from "next/link";

export function OperatorGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser({ requireOperator: true });
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-mist">
        Checking operator access…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-mist">
        <p>Operator access required.</p>
        <Link className="btn btn-primary btn-sm" href="/dashboard">
          Back to workspace
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
