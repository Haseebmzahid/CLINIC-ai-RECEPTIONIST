"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  Appointment,
  AppointmentStatus,
  AvailabilitySlot,
  Patient,
} from "../../lib/api/client";
import { ApiClientError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { dateInputValue, dateRangeForDate, displayDateTime } from "../../lib/dates";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { AppointmentDialog, type AppointmentDialogSubmitInput } from "./AppointmentDialog";
import { CalendarView } from "./CalendarView";

const STATUS_OPTIONS: Array<AppointmentStatus | ""> = [
  "",
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
];

function appointmentQueryKey(date: string, mode: "day" | "week", status: AppointmentStatus | "") {
  return ["appointments", date, mode, status] as const;
}

function conflictMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.code === "SLOT_TAKEN") {
    return "That slot was just taken. Pick another available slot.";
  }

  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function AppointmentsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"day" | "week">("day");
  const [date, setDate] = useState(dateInputValue(new Date()));
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dialogError, setDialogError] = useState("");
  const queryKey = appointmentQueryKey(date, mode, status);
  const range = useMemo(() => dateRangeForDate(date, mode), [date, mode]);

  const appointmentsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listAppointments({ ...range, status });
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
    enabled: Boolean(api),
  });
  const services = servicesQuery.data ?? [];
  const appointments = (appointmentsQuery.data ?? []).filter(
    (appointment) => !serviceFilter || appointment.serviceId === serviceFilter,
  );

  const createMutation = useMutation({
    mutationFn: async (input: AppointmentDialogSubmitInput) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      const patientId =
        input.patientId ??
        (
          await api.createPatient({
            name: input.patientName,
            phone: input.patientPhone,
          })
        ).id;

      return api.createAppointment({
        patientId,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
      });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      return { previous: queryClient.getQueryData<Appointment[]>(queryKey) };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setDialogError(conflictMessage(error));
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Appointment[]>(queryKey, (current = []) => [...current, created]);
      setDialogOpen(false);
      setSelectedAppointment(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      startsAt,
      status: nextStatus,
    }: {
      appointmentId: string;
      startsAt?: string;
      status?: AppointmentStatus;
    }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.updateAppointment(appointmentId, { startsAt, status: nextStatus });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Appointment[]>(queryKey);
      queryClient.setQueryData<Appointment[]>(queryKey, (current = []) =>
        current.map((appointment) =>
          appointment.id === input.appointmentId
            ? {
                ...appointment,
                startsAt: input.startsAt ?? appointment.startsAt,
                status: input.status ?? appointment.status,
              }
            : appointment,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setDialogError(conflictMessage(error));
    },
    onSuccess: () => {
      setDialogOpen(false);
      setSelectedAppointment(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      await api.cancelAppointment(appointmentId);
      return appointmentId;
    },
    onMutate: async (appointmentId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Appointment[]>(queryKey);
      queryClient.setQueryData<Appointment[]>(queryKey, (current = []) =>
        current.map((appointment) =>
          appointment.id === appointmentId ? { ...appointment, status: "cancelled" } : appointment,
        ),
      );
      return { previous };
    },
    onError: (error, _appointmentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setDialogError(conflictMessage(error));
    },
    onSuccess: () => {
      setDialogOpen(false);
      setSelectedAppointment(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  async function loadAvailability(serviceId: string, slotDate: string) {
    if (!api) {
      return;
    }

    setDialogError("");
    const slotRange = dateRangeForDate(slotDate, "day");
    setSlots(await api.listAvailability({ serviceId, ...slotRange }));
  }

  async function searchPatients(query: string) {
    if (!api || query.trim().length < 2) {
      setPatients([]);
      return;
    }

    setPatients(await api.listPatients(query));
  }

  function openCreateDialog() {
    setDialogError("");
    setSlots([]);
    setSelectedAppointment(null);
    setDialogOpen(true);
  }

  function openEditDialog(appointment: Appointment) {
    setDialogError("");
    setSlots([]);
    setSelectedAppointment(appointment);
    setDialogOpen(true);
  }

  const isBusy = createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>Appointments</h1>
        <Button onClick={openCreateDialog} type="button">
          <Plus aria-hidden="true" size={18} />
          Walk-in
        </Button>
      </div>
      <Panel>
        <div className="toolbar">
          <label className="field compact-field">
            <span>Date</span>
            <input
              className="plain-input"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="field compact-field">
            <span>View</span>
            <select
              className="plain-input"
              onChange={(event) => setMode(event.target.value as "day" | "week")}
              value={mode}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </label>
          <label className="field compact-field">
            <span>Status</span>
            <select
              className="plain-input"
              onChange={(event) => setStatus(event.target.value as AppointmentStatus | "")}
              value={status}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "all"}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact-field">
            <span>Service</span>
            <select
              className="plain-input"
              onChange={(event) => setServiceFilter(event.target.value)}
              value={serviceFilter}
            >
              <option value="">all</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>
      <Panel>
        <CalendarView
          appointments={appointments}
          mode={mode}
          onSelect={openEditDialog}
          services={services}
          startDate={date}
        />
      </Panel>
      <Panel title="List">
        <div className="appointment-list">
          {appointments.map((appointment) => {
            const serviceName =
              services.find((service) => service.id === appointment.serviceId)?.name ??
              "Appointment";

            return (
              <button
                className="appointment-row"
                key={appointment.id}
                onClick={() => openEditDialog(appointment)}
                type="button"
              >
                <span>{displayDateTime(appointment.startsAt)}</span>
                <strong>{serviceName}</strong>
                <small>{appointment.status}</small>
              </button>
            );
          })}
          {appointments.length === 0 ? <div className="empty-state">No appointments</div> : null}
        </div>
      </Panel>
      <AppointmentDialog
        appointment={selectedAppointment}
        date={date}
        error={dialogError}
        isBusy={isBusy}
        isOpen={dialogOpen}
        onCancel={(appointment) => cancelMutation.mutate(appointment.id)}
        onClose={() => setDialogOpen(false)}
        onCreate={(input) => createMutation.mutate(input)}
        onLoadAvailability={(serviceId, slotDate) => {
          void loadAvailability(serviceId, slotDate);
        }}
        onMarkNoShow={(appointment) =>
          updateMutation.mutate({ appointmentId: appointment.id, status: "no_show" })
        }
        onReschedule={(appointment, startsAt) =>
          updateMutation.mutate({ appointmentId: appointment.id, startsAt })
        }
        onSearchPatients={(query) => {
          void searchPatients(query);
        }}
        patients={patients}
        services={services}
        slots={slots}
      />
    </div>
  );
}
