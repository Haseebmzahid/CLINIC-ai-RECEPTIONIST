import { z } from "zod";

const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

export const MeSchema = z.object({
  uid: z.string(),
  role: z.enum(["owner", "staff", "platform_admin", "ai_service"]),
  tenantId: z.string().optional(),
});

export type Me = z.infer<typeof MeSchema>;

export const AppointmentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const AppointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  serviceId: z.string(),
  resourceId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: AppointmentStatusSchema,
  source: z.enum(["whatsapp", "dashboard"]),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AvailabilitySlotSchema = z.object({
  slotId: z.string(),
  serviceId: z.string(),
  resourceId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const PatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameLower: z.string(),
  phone: z.string(),
  waId: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
});

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationMinutes: z.number(),
  fee: z.number(),
  currency: z.string(),
  active: z.boolean(),
});

export const ConversationSummarySchema = z.object({
  id: z.string(),
  patientId: z.string(),
  waId: z.string(),
  state: z.string(),
  aiPaused: z.boolean(),
  needsHuman: z.boolean(),
  updatedAt: z.string(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export interface AppointmentListParams {
  from: string;
  to: string;
  status?: AppointmentStatus | "";
}

export interface AvailabilityParams {
  serviceId: string;
  from: string;
  to: string;
}

export interface CreatePatientInput {
  name: string;
  phone: string;
  notes?: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  serviceId: string;
  startsAt: string;
}

export interface UpdateAppointmentInput {
  startsAt?: string;
  status?: AppointmentStatus;
}

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const isE2eApiMock = process.env.NEXT_PUBLIC_E2E_API_MOCK === "true";
const mockService: Service = {
  id: "svc_e2e_cleaning",
  name: "Cleaning",
  durationMinutes: 30,
  fee: 10000,
  currency: "USD",
  active: true,
};
const mockStore: {
  appointments: Appointment[];
  patients: Patient[];
} = {
  appointments: [],
  patients: [],
};

function mockTimestamp(): string {
  return new Date().toISOString();
}

function isInRange(value: string, from: string, to: string): boolean {
  const time = new Date(value).getTime();
  return time >= new Date(from).getTime() && time < new Date(to).getTime();
}

export interface ApiClientOptions {
  getIdToken: () => Promise<string>;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async getMe(): Promise<Me> {
    if (isE2eApiMock) {
      return { uid: "staff-e2e", role: "staff", tenantId: "clinic-e2e" };
    }

    return this.request("/api/me", MeSchema);
  }

  async listAppointments(params: AppointmentListParams): Promise<Appointment[]> {
    if (isE2eApiMock) {
      return mockStore.appointments.filter(
        (appointment) =>
          isInRange(appointment.startsAt, params.from, params.to) &&
          (!params.status || appointment.status === params.status),
      );
    }

    const search = new URLSearchParams({
      from: params.from,
      to: params.to,
    });

    if (params.status) {
      search.set("status", params.status);
    }

    return this.request(`/api/appointments?${search.toString()}`, z.array(AppointmentSchema));
  }

  async listAvailability(params: AvailabilityParams): Promise<AvailabilitySlot[]> {
    if (isE2eApiMock) {
      const from = new Date(params.from);
      const slots = [9, 10, 11, 14].map((hour) => {
        const startsAt = new Date(from);
        startsAt.setHours(hour, 0, 0, 0);
        const endsAt = new Date(startsAt.getTime() + 30 * 60_000);

        return {
          slotId: `slot_${params.serviceId}_${startsAt.toISOString()}`,
          serviceId: params.serviceId,
          resourceId: "res_e2e",
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        };
      });

      return slots.filter(
        (slot) =>
          !mockStore.appointments.some(
            (appointment) =>
              appointment.status !== "cancelled" && appointment.startsAt === slot.startsAt,
          ),
      );
    }

    const search = new URLSearchParams({
      serviceId: params.serviceId,
      from: params.from,
      to: params.to,
    });

    return this.request(`/api/availability?${search.toString()}`, z.array(AvailabilitySlotSchema));
  }

  async listServices(): Promise<Service[]> {
    if (isE2eApiMock) {
      return [mockService];
    }

    return this.request("/api/services", z.array(ServiceSchema));
  }

  async listPatients(query = ""): Promise<Patient[]> {
    if (isE2eApiMock) {
      return mockStore.patients.filter((patient) =>
        `${patient.name} ${patient.phone}`.toLowerCase().includes(query.toLowerCase()),
      );
    }

    const search = new URLSearchParams();

    if (query.trim()) {
      search.set("q", query.trim());
    }

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request(`/api/patients${suffix}`, z.array(PatientSchema));
  }

  async createPatient(input: CreatePatientInput): Promise<Patient> {
    if (isE2eApiMock) {
      const now = mockTimestamp();
      const patient = {
        id: `pat_${mockStore.patients.length + 1}`,
        name: input.name,
        nameLower: input.name.toLowerCase(),
        phone: input.phone,
        waId: input.phone.replace(/\D/g, ""),
        notes: input.notes ?? "",
        createdAt: now,
        lastSeenAt: now,
      };

      mockStore.patients.push(patient);
      return patient;
    }

    return this.request("/api/patients", PatientSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    if (isE2eApiMock) {
      if (
        mockStore.appointments.some(
          (appointment) =>
            appointment.status !== "cancelled" && appointment.startsAt === input.startsAt,
        )
      ) {
        throw new ApiClientError("SLOT_TAKEN", "That time was just booked.");
      }

      const startsAt = new Date(input.startsAt);
      const now = mockTimestamp();
      const appointment = {
        id: `appt_${mockStore.appointments.length + 1}`,
        patientId: input.patientId,
        serviceId: input.serviceId,
        resourceId: "res_e2e",
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
        status: "confirmed" as const,
        source: "dashboard" as const,
        createdBy: "staff-e2e",
        createdAt: now,
        updatedAt: now,
      };

      mockStore.appointments.push(appointment);
      return appointment;
    }

    return this.request("/api/appointments", AppointmentSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateAppointment(
    appointmentId: string,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    if (isE2eApiMock) {
      const existing = mockStore.appointments.find(
        (appointment) => appointment.id === appointmentId,
      );

      if (!existing) {
        throw new ApiClientError("NOT_FOUND", "Appointment not found.");
      }

      if (
        input.startsAt &&
        mockStore.appointments.some(
          (appointment) =>
            appointment.id !== appointmentId &&
            appointment.status !== "cancelled" &&
            appointment.startsAt === input.startsAt,
        )
      ) {
        throw new ApiClientError("SLOT_TAKEN", "That time was just booked.");
      }

      const startsAt = input.startsAt ? new Date(input.startsAt) : null;

      Object.assign(existing, {
        startsAt: input.startsAt ?? existing.startsAt,
        endsAt: startsAt
          ? new Date(startsAt.getTime() + mockService.durationMinutes * 60_000).toISOString()
          : existing.endsAt,
        status: input.status ?? existing.status,
        updatedAt: mockTimestamp(),
      });
      return existing;
    }

    return this.request(`/api/appointments/${appointmentId}`, AppointmentSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    if (isE2eApiMock) {
      const existing = mockStore.appointments.find(
        (appointment) => appointment.id === appointmentId,
      );

      if (existing) {
        existing.status = "cancelled";
      }

      return;
    }

    await this.request(`/api/appointments/${appointmentId}`, z.unknown(), {
      method: "DELETE",
      parseJson: false,
    });
  }

  async listConversations(): Promise<ConversationSummary[]> {
    if (isE2eApiMock) {
      return [];
    }

    return this.request("/api/conversations", z.array(ConversationSummarySchema));
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit & { parseJson?: boolean } = {},
  ): Promise<T> {
    const token = await this.options.getIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const shouldParseJson = init.parseJson ?? true;
    const payload = shouldParseJson ? ((await response.json()) as unknown) : null;

    if (!response.ok) {
      const parsed = ApiErrorEnvelopeSchema.safeParse(payload);

      if (parsed.success) {
        throw new ApiClientError(
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.requestId,
          parsed.data.error.details,
        );
      }

      throw new ApiClientError("HTTP_ERROR", "The API request failed.");
    }

    return schema.parse(payload);
  }
}
