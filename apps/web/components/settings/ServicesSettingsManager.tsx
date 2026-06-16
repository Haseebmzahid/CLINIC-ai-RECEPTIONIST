"use client";

import { CreateServiceDtoSchema, UpdateServiceDtoSchema } from "@clinic-ai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Save } from "lucide-react";
import { FormEvent, useState } from "react";

import type { Service } from "../../lib/api/client";
import { ApiClientError, type CreateServiceInput } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { SectionHeader } from "../layout/SectionHeader";
import { Panel } from "../ui/Panel";
import { OwnerGate } from "./OwnerGate";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message;
  }

  return "Service changes could not be saved.";
}

const blankService: CreateServiceInput = {
  name: "",
  durationMinutes: 30,
  fee: 0,
  currency: "USD",
  active: true,
};

export function ServicesSettingsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Service | null>(null);
  const [form, setForm] = useState<CreateServiceInput>(blankService);
  const [error, setError] = useState("");

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
  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listServices();
    },
    enabled: Boolean(api && meQuery.data?.role === "owner"),
  });

  const saveMutation = useMutation({
    mutationFn: async (input: CreateServiceInput & { id?: string }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      if (input.id) {
        const parsed = UpdateServiceDtoSchema.parse({
          active: input.active,
          currency: input.currency,
          durationMinutes: input.durationMinutes,
          fee: input.fee,
          name: input.name,
        });
        return api.updateService(input.id, parsed);
      }

      const parsed = CreateServiceDtoSchema.parse(input);
      return api.createService(parsed);
    },
    onSuccess: async () => {
      setError("");
      setSelected(null);
      setForm(blankService);
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  function editService(service: Service) {
    setSelected(service);
    setForm({
      active: service.active,
      currency: service.currency,
      durationMinutes: service.durationMinutes,
      fee: service.fee,
      name: service.name,
    });
    setError("");
  }

  function newService() {
    setSelected(null);
    setForm(blankService);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveMutation.mutateAsync({ ...form, id: selected?.id });
  }

  return (
    <div className="page-stack">
      <SectionHeader title="Services" />
      <OwnerGate me={meQuery.data}>
        <div className="split-layout">
          <Panel title="Service list">
            <div className="record-list">
              {(servicesQuery.data ?? []).map((service) => (
                <button
                  className={`record-list-item ${service.id === selected?.id ? "is-selected" : ""}`}
                  key={service.id}
                  onClick={() => editService(service)}
                  type="button"
                >
                  <strong>{service.name}</strong>
                  <span>
                    {service.durationMinutes} min · {service.fee} {service.currency} ·{" "}
                    {service.active ? "active" : "inactive"}
                  </span>
                </button>
              ))}
            </div>
            <button className="secondary-button" onClick={newService} type="button">
              <Plus aria-hidden="true" size={18} />
              New service
            </button>
          </Panel>

          <Panel title={selected ? "Edit service" : "Add service"}>
            <form
              className="stack-form"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              <div className="form-grid">
                <label className="field" htmlFor="service-name">
                  Name
                  <input
                    className="plain-input"
                    id="service-name"
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    value={form.name}
                  />
                </label>
                <label className="field" htmlFor="service-duration">
                  Duration minutes
                  <input
                    className="plain-input"
                    id="service-duration"
                    min={1}
                    onChange={(event) =>
                      setForm({ ...form, durationMinutes: Number(event.target.value) })
                    }
                    type="number"
                    value={form.durationMinutes}
                  />
                </label>
                <label className="field" htmlFor="service-fee">
                  Fee minor units
                  <input
                    className="plain-input"
                    id="service-fee"
                    min={0}
                    onChange={(event) => setForm({ ...form, fee: Number(event.target.value) })}
                    type="number"
                    value={form.fee}
                  />
                </label>
                <label className="field" htmlFor="service-currency">
                  Currency
                  <input
                    className="plain-input"
                    id="service-currency"
                    maxLength={3}
                    onChange={(event) =>
                      setForm({ ...form, currency: event.target.value.toUpperCase() })
                    }
                    value={form.currency}
                  />
                </label>
              </div>
              <label className="check-field">
                <input
                  checked={form.active ?? true}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  type="checkbox"
                />
                Active
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="primary-button" disabled={saveMutation.isPending} type="submit">
                {selected ? (
                  <Save aria-hidden="true" size={18} />
                ) : (
                  <Edit3 aria-hidden="true" size={18} />
                )}
                {selected ? "Save service" : "Create service"}
              </button>
            </form>
          </Panel>
        </div>
      </OwnerGate>
    </div>
  );
}
