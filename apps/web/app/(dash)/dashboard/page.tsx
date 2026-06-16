"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, MessageSquareText, ShieldCheck } from "lucide-react";

import { StatCard } from "../../../components/dashboard/StatCard";
import { Panel } from "../../../components/ui/Panel";
import { useAuth } from "../../../lib/auth/AuthProvider";
import { dateRangeForDate, dateInputValue, displayDateTime } from "../../../lib/dates";

export default function DashboardPage() {
  const { api } = useAuth();
  const today = dateInputValue(new Date());
  const todayRange = dateRangeForDate(today, "day");
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
  const appointmentsQuery = useQuery({
    queryKey: ["dashboard-appointments", today],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listAppointments(todayRange);
    },
    enabled: Boolean(api),
  });
  const conversationsQuery = useQuery({
    queryKey: ["dashboard-conversations"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listConversations();
    },
    enabled: Boolean(api),
  });
  const servicesQuery = useQuery({
    queryKey: ["dashboard-services"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listServices();
    },
    enabled: Boolean(api),
  });
  const appointments = appointmentsQuery.data ?? [];
  const serviceNames = new Map(
    (servicesQuery.data ?? []).map((service) => [service.id, service.name]),
  );
  const upcomingCount = appointments.filter(
    (appointment) =>
      appointment.status === "confirmed" && new Date(appointment.startsAt).getTime() >= Date.now(),
  ).length;
  const pendingCount = appointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;
  const cancellationCount = appointments.filter(
    (appointment) => appointment.status === "cancelled",
  ).length;
  const needsHumanCount = (conversationsQuery.data ?? []).filter(
    (conversation) => conversation.needsHuman,
  ).length;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>Dashboard</h1>
        <span className="role-badge">{meQuery.data?.role ?? "loading"}</span>
      </div>
      <div className="metric-grid">
        <StatCard icon={CalendarDays} label="Upcoming" value={upcomingCount} />
        <StatCard icon={MessageSquareText} label="Pending" value={pendingCount} />
        <StatCard icon={AlertCircle} label="Cancellations" value={cancellationCount} />
      </div>
      {needsHumanCount > 0 ? (
        <Panel>
          <p className="alert-line">
            <AlertCircle aria-hidden="true" size={18} />
            {needsHumanCount} conversation{needsHumanCount === 1 ? "" : "s"} need human attention.
          </p>
        </Panel>
      ) : null}
      <Panel title="Today">
        <div className="appointment-list">
          {appointments.map((appointment) => (
            <div className="appointment-row appointment-row-static" key={appointment.id}>
              <span>{displayDateTime(appointment.startsAt)}</span>
              <strong>{serviceNames.get(appointment.serviceId) ?? appointment.serviceId}</strong>
              <small>{appointment.status}</small>
            </div>
          ))}
          {appointments.length === 0 ? (
            <div className="empty-state">No appointments today</div>
          ) : null}
        </div>
      </Panel>
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
            <dt>Today</dt>
            <dd>{today}</dd>
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
