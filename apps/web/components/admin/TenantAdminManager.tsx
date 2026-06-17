"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, HeartPulse, Save } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../lib/auth/AuthProvider";
import type { CreateTenantInput, Tenant } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

const defaultRenewal = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

const initialForm: CreateTenantInput = {
  id: "clinic_b",
  name: "Clinic B",
  slug: "clinic-b",
  status: "trial",
  whatsapp: {
    phoneNumberId: "",
    displayPhone: "",
    wabaId: "",
    accessTokenRef: "secret://wa_clinic_b",
  },
  subscription: {
    plan: "professional",
    seats: 3,
    renewsAt: defaultRenewal,
  },
};

export function TenantAdminManager() {
  const { api } = useAuth();
  const [form, setForm] = useState<CreateTenantInput>(initialForm);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const healthQuery = useQuery({
    queryKey: ["admin-health"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.getAdminHealth();
    },
    enabled: Boolean(api),
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.createTenant(form);
    },
    onSuccess: setTenant,
  });
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!api || !tenant) {
        throw new Error("Tenant is unavailable.");
      }

      return api.updateTenant(tenant.id, { status: "active" });
    },
    onSuccess: setTenant,
  });

  return (
    <div className="split-layout">
      <Panel title="Onboard Tenant">
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <label className="field compact-field">
            Tenant ID
            <input
              className="plain-input"
              value={form.id}
              onChange={(event) => setForm({ ...form, id: event.target.value })}
            />
          </label>
          <label className="field compact-field">
            Name
            <input
              className="plain-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="field compact-field">
            Slug
            <input
              className="plain-input"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="field compact-field">
              Phone Number ID
              <input
                className="plain-input"
                value={form.whatsapp.phoneNumberId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    whatsapp: { ...form.whatsapp, phoneNumberId: event.target.value },
                  })
                }
              />
            </label>
            <label className="field compact-field">
              Display Phone
              <input
                className="plain-input"
                value={form.whatsapp.displayPhone}
                onChange={(event) =>
                  setForm({
                    ...form,
                    whatsapp: { ...form.whatsapp, displayPhone: event.target.value },
                  })
                }
              />
            </label>
            <label className="field compact-field">
              WABA ID
              <input
                className="plain-input"
                value={form.whatsapp.wabaId}
                onChange={(event) =>
                  setForm({ ...form, whatsapp: { ...form.whatsapp, wabaId: event.target.value } })
                }
              />
            </label>
            <label className="field compact-field">
              Seats
              <input
                className="plain-input"
                type="number"
                min={1}
                value={form.subscription.seats}
                onChange={(event) =>
                  setForm({
                    ...form,
                    subscription: { ...form.subscription, seats: Number(event.target.value) },
                  })
                }
              />
            </label>
          </div>
          {createMutation.isError ? <p className="form-error">Tenant onboarding failed.</p> : null}
          <Button type="submit" disabled={createMutation.isPending}>
            <Save aria-hidden="true" size={16} />
            Create Tenant
          </Button>
        </form>
      </Panel>

      <div className="section-stack">
        <Panel title="Admin Health">
          <div className="status-line">
            <HeartPulse aria-hidden="true" size={18} />
            {healthQuery.data?.status ?? "Checking"}
          </div>
        </Panel>

        <Panel title="Tenant Status">
          {tenant ? (
            <div className="record-list">
              <div className="record-list-item appointment-row-static">
                <strong>{tenant.name}</strong>
                <span>{tenant.id}</span>
                <span>{tenant.status}</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={activateMutation.isPending || tenant.status === "active"}
                onClick={() => activateMutation.mutate()}
              >
                <Building2 aria-hidden="true" size={16} />
                Activate
              </Button>
            </div>
          ) : (
            <div className="empty-state">
              <Building2 aria-hidden="true" size={24} />
              <strong>No tenant selected</strong>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
