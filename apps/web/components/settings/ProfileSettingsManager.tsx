"use client";

import { UpsertSettingsDtoSchema } from "@clinic-ai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { SettingsProfile } from "../../lib/api/client";
import { ApiClientError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { SectionHeader } from "../layout/SectionHeader";
import { Panel } from "../ui/Panel";
import { OwnerGate } from "./OwnerGate";

const DAYS = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
] as const;

const emptyProfile: SettingsProfile = {
  timezone: "America/Los_Angeles",
  locale: "en-US",
  location: { address: "", mapsUrl: "" },
  workingHours: {
    "0": [],
    "1": [{ open: "09:00", close: "17:00" }],
    "2": [{ open: "09:00", close: "17:00" }],
    "3": [{ open: "09:00", close: "17:00" }],
    "4": [{ open: "09:00", close: "17:00" }],
    "5": [{ open: "09:00", close: "17:00" }],
    "6": [],
  },
  slotLengthMinutes: 30,
  bufferMinutes: 0,
  minLeadTimeMinutes: 30,
  holidays: [],
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message;
  }

  return "Settings could not be saved.";
}

export function ProfileSettingsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsProfile>(emptyProfile);
  const [holidays, setHolidays] = useState("");
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
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.getSettings();
    },
    enabled: Boolean(api && meQuery.data?.role === "owner"),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data);
      setHolidays(settingsQuery.data.holidays.join(", "));
    }
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: async (input: SettingsProfile) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.updateSettings(input);
    },
    onSuccess: async () => {
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  function updateDay(day: string, field: "open" | "close", value: string) {
    setForm((current) => ({
      ...current,
      workingHours: {
        ...current.workingHours,
        [day]: [
          {
            ...(current.workingHours[day]?.[0] ?? { open: "09:00", close: "17:00" }),
            [field]: value,
          },
        ],
      },
    }));
  }

  function toggleDay(day: string, isOpen: boolean) {
    setForm((current) => ({
      ...current,
      workingHours: {
        ...current.workingHours,
        [day]: isOpen ? [{ open: "09:00", close: "17:00" }] : [],
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProfile = {
      ...form,
      holidays: holidays
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      location: {
        address: form.location.address,
        mapsUrl: form.location.mapsUrl?.trim() || undefined,
      },
    };
    const parsed = UpsertSettingsDtoSchema.safeParse(nextProfile);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Settings are invalid.");
      return;
    }

    await mutation.mutateAsync(parsed.data);
  }

  return (
    <div className="page-stack">
      <SectionHeader title="Profile" />
      <OwnerGate me={meQuery.data}>
        <Panel title="Clinic profile">
          <form
            className="stack-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="form-grid">
              <label className="field" htmlFor="timezone">
                Timezone
                <input
                  className="plain-input"
                  id="timezone"
                  onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                  value={form.timezone}
                />
              </label>
              <label className="field" htmlFor="locale">
                Locale
                <input
                  className="plain-input"
                  id="locale"
                  onChange={(event) => setForm({ ...form, locale: event.target.value })}
                  value={form.locale}
                />
              </label>
              <label className="field" htmlFor="address">
                Address
                <input
                  className="plain-input"
                  id="address"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: { ...form.location, address: event.target.value },
                    })
                  }
                  value={form.location.address}
                />
              </label>
              <label className="field" htmlFor="maps-url">
                Maps URL
                <input
                  className="plain-input"
                  id="maps-url"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: { ...form.location, mapsUrl: event.target.value },
                    })
                  }
                  value={form.location.mapsUrl ?? ""}
                />
              </label>
              <label className="field" htmlFor="slot-length">
                Slot length minutes
                <input
                  className="plain-input"
                  id="slot-length"
                  min={5}
                  onChange={(event) =>
                    setForm({ ...form, slotLengthMinutes: Number(event.target.value) })
                  }
                  type="number"
                  value={form.slotLengthMinutes}
                />
              </label>
              <label className="field" htmlFor="buffer-minutes">
                Buffer minutes
                <input
                  className="plain-input"
                  id="buffer-minutes"
                  min={0}
                  onChange={(event) =>
                    setForm({ ...form, bufferMinutes: Number(event.target.value) })
                  }
                  type="number"
                  value={form.bufferMinutes}
                />
              </label>
              <label className="field" htmlFor="lead-time">
                Minimum lead time minutes
                <input
                  className="plain-input"
                  id="lead-time"
                  min={0}
                  onChange={(event) =>
                    setForm({ ...form, minLeadTimeMinutes: Number(event.target.value) })
                  }
                  type="number"
                  value={form.minLeadTimeMinutes}
                />
              </label>
              <label className="field" htmlFor="holidays">
                Holidays
                <input
                  className="plain-input"
                  id="holidays"
                  onChange={(event) => setHolidays(event.target.value)}
                  placeholder="2026-12-25, 2027-01-01"
                  value={holidays}
                />
              </label>
            </div>

            <div className="hours-grid">
              {DAYS.map(([day, label]) => {
                const range = form.workingHours[day]?.[0];

                return (
                  <div className="hours-row" key={day}>
                    <label className="check-field">
                      <input
                        checked={Boolean(range)}
                        onChange={(event) => toggleDay(day, event.target.checked)}
                        type="checkbox"
                      />
                      {label}
                    </label>
                    <input
                      aria-label={`${label} open`}
                      className="plain-input"
                      disabled={!range}
                      onChange={(event) => updateDay(day, "open", event.target.value)}
                      type="time"
                      value={range?.open ?? "09:00"}
                    />
                    <input
                      aria-label={`${label} close`}
                      className="plain-input"
                      disabled={!range}
                      onChange={(event) => updateDay(day, "close", event.target.value)}
                      type="time"
                      value={range?.close ?? "17:00"}
                    />
                  </div>
                );
              })}
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={mutation.isPending} type="submit">
              <Save aria-hidden="true" size={18} />
              Save profile
            </button>
          </form>
        </Panel>
      </OwnerGate>
    </div>
  );
}
