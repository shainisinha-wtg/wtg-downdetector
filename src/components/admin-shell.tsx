import { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

interface AdminShellProps {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function AdminShell({ title, description, children, actions }: Readonly<AdminShellProps>) {
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <Link href="/admin" className="text-sm font-semibold">
            WTG Downdetector
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="admin-shell-content">
        <div className="admin-shell-masthead">
          <h1>{title}</h1>
          <p>{description}</p>
          {actions && <div className="admin-shell-actions">{actions}</div>}
        </div>

        {children}
      </main>
    </div>
  );
}
