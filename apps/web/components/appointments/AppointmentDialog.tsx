"use client";

import { RefreshCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Appointment, AvailabilitySlot, Patient, Service } from "../../lib/api/client";
import { dateInputValue, displayDateTime, displayTime } from "../../lib/dates";
import { Button } from "../ui/Button";

export interface AppointmentDialogSubmitInput {
  patientName: string;
  patientPhone: string;
  patientId?: string;
  serviceId: string;
  startsAt: string;
}

export function AppointmentDialog({
  appointment,
  date,
  error,
  isBusy,
  isOpen,
  onCancel,
  onClose,
  onCreate,
  onMarkNoShow,
  onReschedule,
  onSearchPatients,
  onLoadAvailability,
  patients,
  services,
  slots,
}: {
  appointment: Appointment | null;
  date: string;
  error: string;
  isBusy: boolean;
  isOpen: boolean;
  onCancel: (appointment: Appointment) => void;
  onClose: () => void;
  onCreate: (input: AppointmentDialogSubmitInput) => void;
  onMarkNoShow: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment, startsAt: string) => void;
  onSearchPatients: (query: string) => void;
  onLoadAvailability: (serviceId: string, dateValue: string) => void;
  patients: Patient[];
  services: Service[];
  slots: AvailabilitySlot[];
}) {
  const activeServices = services.filter((service) => service.active);
  const defaultServiceId = appointment?.serviceId ?? activeServices[0]?.id ?? "";
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientId, setPatientId] = useState("");
  const [serviceId, setServiceId] = useState(defaultServiceId);
  const [slotDate, setSlotDate] = useState(date);
  const [selectedSlot, setSelectedSlot] = useState("");
  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [serviceId, services],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setServiceId(defaultServiceId);
    setSlotDate(appointment ? dateInputValue(new Date(appointment.startsAt)) : date);
    setSelectedSlot("");
    setPatientName("");
    setPatientPhone("");
    setPatientId("");
  }, [appointment, date, defaultServiceId, isOpen]);

  if (!isOpen) {
    return null;
  }

  const isEditing = Boolean(appointment);
  const title = isEditing ? "Manage appointment" : "Create walk-in";

  function loadSlots() {
    if (serviceId) {
      onLoadAvailability(serviceId, slotDate);
    }
  }

  function submit() {
    if (!selectedSlot || !serviceId) {
      return;
    }

    if (appointment) {
      onReschedule(appointment, selectedSlot);
      return;
    }

    onCreate({
      patientName,
      patientPhone,
      patientId: patientId || undefined,
      serviceId,
      startsAt: selectedSlot,
    });
  }

  return (
    <div aria-modal="true" className="dialog-backdrop" role="dialog">
      <div className="dialog-panel">
        <header className="dialog-header">
          <div>
            <h2>{title}</h2>
            {appointment ? <span>{displayDateTime(appointment.startsAt)}</span> : null}
          </div>
          <Button aria-label="Close" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </header>
        <div className="dialog-body">
          {appointment ? (
            <div className="detail-strip">
              <span>Status</span>
              <strong>{appointment.status}</strong>
            </div>
          ) : (
            <div className="form-grid">
              <label className="field">
                <span>Patient search</span>
                <input
                  className="plain-input"
                  onChange={(event) => onSearchPatients(event.target.value)}
                  placeholder="Search existing patients"
                  type="search"
                />
              </label>
              <label className="field">
                <span>Existing patient</span>
                <select
                  className="plain-input"
                  onChange={(event) => setPatientId(event.target.value)}
                  value={patientId}
                >
                  <option value="">New walk-in</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} · {patient.phone}
                    </option>
                  ))}
                </select>
              </label>
              {!patientId ? (
                <>
                  <label className="field">
                    <span>Name</span>
                    <input
                      className="plain-input"
                      onChange={(event) => setPatientName(event.target.value)}
                      value={patientName}
                    />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input
                      className="plain-input"
                      onChange={(event) => setPatientPhone(event.target.value)}
                      value={patientPhone}
                    />
                  </label>
                </>
              ) : null}
            </div>
          )}
          <div className="form-grid">
            <label className="field">
              <span>Service</span>
              <select
                className="plain-input"
                disabled={isEditing}
                onChange={(event) => setServiceId(event.target.value)}
                value={serviceId}
              >
                {activeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input
                className="plain-input"
                onChange={(event) => setSlotDate(event.target.value)}
                type="date"
                value={slotDate}
              />
            </label>
          </div>
          <div className="slot-toolbar">
            <Button onClick={loadSlots} type="button" variant="secondary">
              <RefreshCcw aria-hidden="true" size={16} />
              Load slots
            </Button>
            <span>{selectedService ? `${selectedService.durationMinutes} min` : ""}</span>
          </div>
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                className={
                  selectedSlot === slot.startsAt ? "slot-button slot-button-active" : "slot-button"
                }
                key={slot.slotId}
                onClick={() => setSelectedSlot(slot.startsAt)}
                type="button"
              >
                {displayTime(slot.startsAt)}
              </button>
            ))}
            {slots.length === 0 ? (
              <span className="muted-note">Load availability to pick a slot.</span>
            ) : null}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        <footer className="dialog-actions">
          {appointment ? (
            <>
              <Button
                disabled={isBusy || appointment.status === "cancelled"}
                onClick={() => onCancel(appointment)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={isBusy || appointment.status === "no_show"}
                onClick={() => onMarkNoShow(appointment)}
                type="button"
                variant="secondary"
              >
                Mark no-show
              </Button>
            </>
          ) : null}
          <Button disabled={isBusy || !selectedSlot || !serviceId} onClick={submit} type="button">
            {appointment ? "Reschedule" : "Create booking"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
