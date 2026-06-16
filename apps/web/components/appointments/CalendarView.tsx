"use client";

import type { Appointment, Service } from "../../lib/api/client";
import { addDays, dateInputValue, displayTime } from "../../lib/dates";

export function CalendarView({
  appointments,
  mode,
  services,
  startDate,
  onSelect,
}: {
  appointments: Appointment[];
  mode: "day" | "week";
  services: Service[];
  startDate: string;
  onSelect: (appointment: Appointment) => void;
}) {
  const baseDate = new Date(`${startDate}T00:00:00`);
  const days = Array.from({ length: mode === "day" ? 1 : 7 }, (_, index) =>
    addDays(baseDate, index),
  );

  return (
    <div className={mode === "day" ? "calendar-grid calendar-grid-day" : "calendar-grid"}>
      {days.map((day) => {
        const dayKey = dateInputValue(day);
        const dayAppointments = appointments.filter(
          (appointment) => dateInputValue(new Date(appointment.startsAt)) === dayKey,
        );

        return (
          <section className="calendar-day" key={dayKey}>
            <header>
              <strong>
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(day)}
              </strong>
              <span>{dayAppointments.length}</span>
            </header>
            <div className="calendar-events">
              {dayAppointments.length === 0 ? <span className="calendar-empty">Open</span> : null}
              {dayAppointments.map((appointment) => {
                const serviceName =
                  services.find((service) => service.id === appointment.serviceId)?.name ??
                  "Appointment";

                return (
                  <button
                    className="calendar-event"
                    key={appointment.id}
                    onClick={() => onSelect(appointment)}
                    type="button"
                  >
                    <strong>{displayTime(appointment.startsAt)}</strong>
                    <span>{serviceName}</span>
                    <small>{appointment.status}</small>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
