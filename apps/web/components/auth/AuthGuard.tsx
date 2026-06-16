"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "../../lib/auth/AuthProvider";

export function AuthGuard({
  children,
  requirePlatformAdmin = false,
}: {
  children: ReactNode;
  requirePlatformAdmin?: boolean;
}) {
  const { api, isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.getMe();
    },
    enabled: Boolean(api),
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, router, user]);

  if (isLoading || !user || meQuery.isLoading) {
    return <main className="auth-status">Loading</main>;
  }

  if (meQuery.isError) {
    return <main className="auth-status">Unable to load account</main>;
  }

  if (requirePlatformAdmin && meQuery.data?.role !== "platform_admin") {
    return <main className="auth-status">Access denied</main>;
  }

  return children;
}
