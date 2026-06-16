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

export const SettingsProfileSchema = z.object({
  timezone: z.string(),
  locale: z.string(),
  location: z.object({
    address: z.string(),
    mapsUrl: z.string().optional(),
  }),
  workingHours: z.record(
    z.string(),
    z.array(
      z.object({
        open: z.string(),
        close: z.string(),
      }),
    ),
  ),
  slotLengthMinutes: z.number(),
  bufferMinutes: z.number(),
  minLeadTimeMinutes: z.number(),
  holidays: z.array(z.string()),
});

export const FaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  tags: z.array(z.string()),
  active: z.boolean(),
  updatedAt: z.string(),
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

export const ConversationMessageSchema = z.object({
  id: z.string(),
  direction: z.enum(["in", "out"]),
  channel: z.literal("whatsapp"),
  waMessageId: z.string().optional(),
  type: z.enum(["text", "interactive", "image", "system"]),
  text: z.string(),
  author: z.enum(["patient", "ai", "staff", "system"]),
  status: z.enum(["received", "sent", "delivered", "read", "failed"]),
  createdAt: z.string(),
});

export const SendConversationMessageResultSchema = z.object({
  messageId: z.string(),
  waMessageId: z.string().optional(),
  status: z.enum(["sent", "failed"]),
  usedTemplate: z.boolean(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type SettingsProfile = z.infer<typeof SettingsProfileSchema>;
export type Faq = z.infer<typeof FaqSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type SendConversationMessageResult = z.infer<typeof SendConversationMessageResultSchema>;

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

export interface UpdatePatientInput {
  name?: string;
  notes?: string;
}

export interface PatientDetail {
  patient: Patient;
  appointments: Appointment[];
}

export interface CreateServiceInput {
  name: string;
  durationMinutes: number;
  fee: number;
  currency: string;
  active?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  durationMinutes?: number;
  fee?: number;
  currency?: string;
  active?: boolean;
}

export interface CreateFaqInput {
  question: string;
  answer: string;
  tags: string[];
  active?: boolean;
}

export type UpdateFaqInput = Partial<Required<CreateFaqInput>>;

export interface CreateAppointmentInput {
  patientId: string;
  serviceId: string;
  startsAt: string;
}

export interface UpdateAppointmentInput {
  startsAt?: string;
  status?: AppointmentStatus;
}

export interface ConversationListParams {
  state?: string;
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
const mockProfile: SettingsProfile = {
  timezone: "America/Los_Angeles",
  locale: "en-US",
  location: { address: "123 Care Ave", mapsUrl: "https://maps.example.test/clinic" },
  workingHours: {
    "0": [],
    "1": [{ open: "09:00", close: "17:00" }],
    "2": [{ open: "09:00", close: "17:00" }],
    "3": [{ open: "09:00", close: "17:00" }],
    "4": [{ open: "09:00", close: "17:00" }],
    "5": [{ open: "09:00", close: "15:00" }],
    "6": [],
  },
  slotLengthMinutes: 30,
  bufferMinutes: 0,
  minLeadTimeMinutes: 30,
  holidays: [],
};
const mockStore: {
  appointments: Appointment[];
  conversations: ConversationSummary[];
  faqs: Faq[];
  messages: Record<string, ConversationMessage[]>;
  patients: Patient[];
  profile: SettingsProfile;
  services: Service[];
} = {
  appointments: [],
  conversations: [
    {
      id: "conv_e2e",
      patientId: "pat_e2e_thread",
      waId: "15550111",
      state: "handoff",
      aiPaused: false,
      needsHuman: true,
      updatedAt: new Date().toISOString(),
    },
  ],
  messages: {
    conv_e2e: [
      {
        id: "msg_e2e_1",
        direction: "in",
        channel: "whatsapp",
        waMessageId: "wamid.e2e.1",
        type: "text",
        text: "Hi, I need help with my appointment.",
        author: "patient",
        status: "received",
        createdAt: new Date(Date.now() - 120_000).toISOString(),
      },
      {
        id: "msg_e2e_2",
        direction: "out",
        channel: "whatsapp",
        waMessageId: "wamid.e2e.2",
        type: "system",
        text: "Staff notification: AI marked this conversation for staff review.",
        author: "system",
        status: "sent",
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ],
  },
  faqs: [
    {
      id: "faq_e2e_location",
      question: "Where are you located?",
      answer: "We are located at 123 Care Ave.",
      tags: ["location"],
      active: true,
      updatedAt: new Date().toISOString(),
    },
  ],
  patients: [],
  profile: mockProfile,
  services: [mockService],
};

function mockTimestamp(): string {
  return new Date().toISOString();
}

function loadMockFaqs(): Faq[] {
  if (typeof window === "undefined") {
    return mockStore.faqs;
  }

  const stored = window.localStorage.getItem("clinic-ai-e2e-faqs");

  if (!stored) {
    return mockStore.faqs;
  }

  let value: unknown;

  try {
    value = JSON.parse(stored);
  } catch {
    return mockStore.faqs;
  }

  const parsed = z.array(FaqSchema).safeParse(value);

  if (!parsed.success) {
    return mockStore.faqs;
  }

  mockStore.faqs = parsed.data;
  return mockStore.faqs;
}

function saveMockFaqs(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem("clinic-ai-e2e-faqs", JSON.stringify(mockStore.faqs));
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
      return { uid: "owner-e2e", role: "owner", tenantId: "clinic-e2e" };
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
      return mockStore.services;
    }

    return this.request("/api/services", z.array(ServiceSchema));
  }

  async createService(input: CreateServiceInput): Promise<Service> {
    if (isE2eApiMock) {
      const service = {
        id: `svc_e2e_${mockStore.services.length + 1}`,
        active: input.active ?? true,
        currency: input.currency,
        durationMinutes: input.durationMinutes,
        fee: input.fee,
        name: input.name,
      };

      mockStore.services.push(service);
      return service;
    }

    return this.request("/api/services", ServiceSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateService(serviceId: string, input: UpdateServiceInput): Promise<Service> {
    if (isE2eApiMock) {
      const service = mockStore.services.find((item) => item.id === serviceId);

      if (!service) {
        throw new ApiClientError("NOT_FOUND", "Service not found.");
      }

      Object.assign(service, input);
      return service;
    }

    return this.request(`/api/services/${serviceId}`, ServiceSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
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

  async getPatient(patientId: string): Promise<PatientDetail> {
    const PatientDetailSchema = z.object({
      patient: PatientSchema,
      appointments: z.array(AppointmentSchema),
    });

    if (isE2eApiMock) {
      const patient = mockStore.patients.find((item) => item.id === patientId);

      if (!patient) {
        throw new ApiClientError("NOT_FOUND", "Patient not found.");
      }

      return {
        patient,
        appointments: mockStore.appointments.filter(
          (appointment) => appointment.patientId === patientId,
        ),
      };
    }

    return this.request(`/api/patients/${patientId}`, PatientDetailSchema);
  }

  async updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient> {
    if (isE2eApiMock) {
      const patient = mockStore.patients.find((item) => item.id === patientId);

      if (!patient) {
        throw new ApiClientError("NOT_FOUND", "Patient not found.");
      }

      Object.assign(patient, {
        name: input.name ?? patient.name,
        nameLower: input.name ? input.name.toLowerCase() : patient.nameLower,
        notes: input.notes ?? patient.notes,
      });
      return patient;
    }

    return this.request(`/api/patients/${patientId}`, PatientSchema, {
      method: "PATCH",
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

  async listConversations(params: ConversationListParams = {}): Promise<ConversationSummary[]> {
    if (isE2eApiMock) {
      return mockStore.conversations.filter(
        (conversation) => !params.state || conversation.state === params.state,
      );
    }

    const search = new URLSearchParams();

    if (params.state) {
      search.set("state", params.state);
    }

    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request(`/api/conversations${suffix}`, z.array(ConversationSummarySchema));
  }

  async listConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    if (isE2eApiMock) {
      return mockStore.messages[conversationId] ?? [];
    }

    return this.request(
      `/api/conversations/${conversationId}/messages`,
      z.array(ConversationMessageSchema),
    );
  }

  async sendConversationMessage(
    conversationId: string,
    text: string,
  ): Promise<SendConversationMessageResult> {
    if (isE2eApiMock) {
      const id = `msg_e2e_${(mockStore.messages[conversationId] ?? []).length + 1}`;
      const now = mockTimestamp();
      const message: ConversationMessage = {
        id,
        direction: "out",
        channel: "whatsapp",
        waMessageId: `wamid.e2e.staff.${id}`,
        type: "text",
        text,
        author: "staff",
        status: "sent",
        createdAt: now,
      };

      mockStore.messages[conversationId] = [...(mockStore.messages[conversationId] ?? []), message];
      mockStore.conversations = mockStore.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, needsHuman: true, updatedAt: now }
          : conversation,
      );

      return {
        messageId: id,
        waMessageId: message.waMessageId,
        status: "sent",
        usedTemplate: false,
      };
    }

    return this.request(
      `/api/conversations/${conversationId}/messages`,
      SendConversationMessageResultSchema,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      },
    );
  }

  async updateConversation(
    conversationId: string,
    input: { aiPaused: boolean },
  ): Promise<ConversationSummary> {
    if (isE2eApiMock) {
      const now = mockTimestamp();
      const updated = mockStore.conversations.map((conversation) => {
        if (conversation.id !== conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          state: input.aiPaused ? "handoff" : "browsing",
          aiPaused: input.aiPaused,
          needsHuman: input.aiPaused,
          updatedAt: now,
        };
      });

      mockStore.conversations = updated;
      const conversation = updated.find((item) => item.id === conversationId);

      if (!conversation) {
        throw new ApiClientError("NOT_FOUND", "Conversation not found.");
      }

      return conversation;
    }

    return this.request(`/api/conversations/${conversationId}`, ConversationSummarySchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async getSettings(): Promise<SettingsProfile> {
    if (isE2eApiMock) {
      return mockStore.profile;
    }

    return this.request("/api/settings", SettingsProfileSchema);
  }

  async updateSettings(input: SettingsProfile): Promise<SettingsProfile> {
    if (isE2eApiMock) {
      mockStore.profile = input;
      return mockStore.profile;
    }

    return this.request("/api/settings", SettingsProfileSchema, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  async listFaqs(): Promise<Faq[]> {
    if (isE2eApiMock) {
      return loadMockFaqs();
    }

    return this.request("/api/faqs", z.array(FaqSchema));
  }

  async createFaq(input: CreateFaqInput): Promise<Faq> {
    if (isE2eApiMock) {
      const faq = {
        id: `faq_e2e_${mockStore.faqs.length + 1}`,
        active: input.active ?? true,
        answer: input.answer,
        question: input.question,
        tags: input.tags,
        updatedAt: mockTimestamp(),
      };

      mockStore.faqs.push(faq);
      saveMockFaqs();
      return faq;
    }

    return this.request("/api/faqs", FaqSchema, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateFaq(faqId: string, input: UpdateFaqInput): Promise<Faq> {
    if (isE2eApiMock) {
      const faq = mockStore.faqs.find((item) => item.id === faqId);

      if (!faq) {
        throw new ApiClientError("NOT_FOUND", "FAQ not found.");
      }

      Object.assign(faq, input, { updatedAt: mockTimestamp() });
      saveMockFaqs();
      return faq;
    }

    return this.request(`/api/faqs/${faqId}`, FaqSchema, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteFaq(faqId: string): Promise<void> {
    if (isE2eApiMock) {
      mockStore.faqs = mockStore.faqs.filter((item) => item.id !== faqId);
      saveMockFaqs();
      return;
    }

    await this.request(`/api/faqs/${faqId}`, z.unknown(), {
      method: "DELETE",
      parseJson: false,
    });
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
