"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useAuth } from "../../lib/auth/AuthProvider";
import { Button } from "../ui/Button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { api, signOut, user } = useAuth();
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

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-mark" aria-label="Clinic AI Receptionist">
          <span className="brand-symbol">CA</span>
          <span>
            <strong>Clinic AI</strong>
            <small>Receptionist</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Dashboard">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={isActive ? "nav-link nav-link-active" : "nav-link"}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
                {isActive ? <ChevronRight aria-hidden="true" size={16} /> : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div>
            <span className="topbar-label">Tenant</span>
            <strong>{meQuery.data?.tenantId ?? "Platform"}</strong>
          </div>
          <div className="topbar-actions">
            <span className="role-badge">{meQuery.data?.role ?? "loading"}</span>
            <span className="user-email">{user?.email ?? user?.uid}</span>
            <Button
              aria-label="Sign out"
              onClick={() => {
                void handleSignOut();
              }}
              type="button"
              variant="ghost"
            >
              <LogOut aria-hidden="true" size={18} />
            </Button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
