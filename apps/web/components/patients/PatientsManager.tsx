"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { Patient } from "../../lib/api/client";
import { ApiClientError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { displayDateTime } from "../../lib/dates";
import { SectionHeader } from "../layout/SectionHeader";
import { Panel } from "../ui/Panel";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message;
  }

  return "The patient action failed.";
}

export function PatientsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const patientsQuery = useQuery({
    queryKey: ["patients", query],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listPatients(query);
    },
    enabled: Boolean(api),
  });
  const patients = patientsQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && patients[0]) {
      setSelectedId(patients[0].id);
    }
  }, [patients, selectedId]);

  const detailQuery = useQuery({
    queryKey: ["patient-detail", selectedId],
    queryFn: async () => {
      if (!api || !selectedId) {
        throw new Error("Patient is unavailable.");
      }

      return api.getPatient(selectedId);
    },
    enabled: Boolean(api && selectedId),
  });

  useEffect(() => {
    if (detailQuery.data?.patient) {
      setName(detailQuery.data.patient.name);
      setPhone(detailQuery.data.patient.phone);
      setNotes(detailQuery.data.patient.notes);
    }
  }, [detailQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; phone: string; notes: string }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.createPatient(input);
    },
    onSuccess: async (patient) => {
      setError("");
      setSelectedId(patient.id);
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { patientId: string; name: string; notes: string }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.updatePatient(input.patientId, { name: input.name, notes: input.notes });
    },
    onSuccess: async () => {
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["patient-detail", selectedId] }),
      ]);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }

    if (selectedId) {
      await updateMutation.mutateAsync({ patientId: selectedId, name, notes });
      return;
    }

    await createMutation.mutateAsync({ name, phone, notes });
  }

  function startNew() {
    setSelectedId(undefined);
    setName("");
    setPhone("");
    setNotes("");
    setError("");
  }

  return (
    <div className="page-stack">
      <SectionHeader title="Patients" />
      <div className="split-layout">
        <Panel title="Patient search">
          <label className="field" htmlFor="patient-search">
            Search
            <span className="input-wrap">
              <Search aria-hidden="true" size={18} />
              <input
                id="patient-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or phone"
                value={query}
              />
            </span>
          </label>
          <div className="record-list">
            {patients.map((patient: Patient) => (
              <button
                className={`record-list-item ${patient.id === selectedId ? "is-selected" : ""}`}
                key={patient.id}
                onClick={() => setSelectedId(patient.id)}
                type="button"
              >
                <strong>{patient.name}</strong>
                <span>{patient.phone}</span>
              </button>
            ))}
            {patients.length === 0 ? <div className="empty-state">No patients</div> : null}
          </div>
          <button className="secondary-button" onClick={startNew} type="button">
            <Plus aria-hidden="true" size={18} />
            New patient
          </button>
        </Panel>

        <Panel title={selectedId ? "Patient detail" : "Create patient"}>
          <form
            className="stack-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="form-grid">
              <label className="field" htmlFor="patient-name">
                Name
                <input
                  className="plain-input"
                  id="patient-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>
              <label className="field" htmlFor="patient-phone">
                Phone
                <input
                  className="plain-input"
                  disabled={Boolean(selectedId)}
                  id="patient-phone"
                  onChange={(event) => setPhone(event.target.value)}
                  value={phone}
                />
              </label>
            </div>
            <label className="field" htmlFor="patient-notes">
              Notes
              <textarea
                className="plain-textarea"
                id="patient-notes"
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                value={notes}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" type="submit">
              <Edit3 aria-hidden="true" size={18} />
              {selectedId ? "Save patient" : "Create patient"}
            </button>
          </form>

          {detailQuery.data ? (
            <div className="section-stack">
              <h3>Booking history</h3>
              <div className="appointment-list">
                {detailQuery.data.appointments.map((appointment) => (
                  <div className="appointment-row appointment-row-static" key={appointment.id}>
                    <span>{displayDateTime(appointment.startsAt)}</span>
                    <strong>{appointment.serviceId}</strong>
                    <small>{appointment.status}</small>
                  </div>
                ))}
                {detailQuery.data.appointments.length === 0 ? (
                  <div className="empty-state">No bookings</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
