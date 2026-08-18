"use client";

import { logout } from "@/app/admin/actions";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await logout();
    } catch (error) {
      if (isRedirectError(error)) {
        return;
      }

      console.error("Logout failed");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="button-secondary"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
