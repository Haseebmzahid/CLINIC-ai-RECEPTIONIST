"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, MessageSquareText, ShieldCheck } from "lucide-react";

import { Panel } from "../../../components/ui/Panel";
import { useAuth } from "../../../lib/auth/AuthProvider";

export default function DashboardPage() {
  const { api } = useAuth();
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

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>Dashboard</h1>
        <span className="role-badge">{meQuery.data?.role ?? "loading"}</span>
      </div>
      <div className="metric-grid">
        <Panel>
          <div className="metric">
            <CalendarDays aria-hidden="true" size={20} />
            <span>Appointments</span>
            <strong>0</strong>
          </div>
        </Panel>
        <Panel>
          <div className="metric">
            <MessageSquareText aria-hidden="true" size={20} />
            <span>Conversations</span>
            <strong>0</strong>
          </div>
        </Panel>
        <Panel>
          <div className="metric">
            <AlertCircle aria-hidden="true" size={20} />
            <span>Needs human</span>
            <strong>0</strong>
          </div>
        </Panel>
      </div>
      <Panel title="Account">
        <dl className="detail-list">
          <div>
            <dt>Tenant</dt>
            <dd>{meQuery.data?.tenantId ?? "Platform"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{meQuery.data?.role ?? "loading"}</dd>
          </div>
          <div>
            <dt>User</dt>
            <dd>{meQuery.data?.uid ?? "loading"}</dd>
          </div>
          <div>
            <dt>Request</dt>
            <dd>{meQuery.data?.requestId ?? "loading"}</dd>
          </div>
        </dl>
        <p className="status-line">
          <ShieldCheck aria-hidden="true" size={18} />
          Authenticated
        </p>
      </Panel>
    </div>
  );
}
