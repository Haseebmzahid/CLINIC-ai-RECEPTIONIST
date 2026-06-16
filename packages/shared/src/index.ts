import type { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

function hasToDate(value: unknown): value is { toDate: () => Date } {
  if (typeof value !== "object" || value === null || !("toDate" in value)) {
    return false;
  }

  return typeof value.toDate === "function";
}

export const FirestoreTimestampSchema = z.custom<Timestamp>(
  (value) => hasToDate(value),
  "Expected Firestore Timestamp",
);

export type FirestoreTimestamp = z.infer<typeof FirestoreTimestampSchema>;

export const MoneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export type Money = z.infer<typeof MoneySchema>;

export const TenantStatusSchema = z.enum(["active", "suspended", "trial"]);
export const UserRoleSchema = z.enum(["owner", "staff", "platform_admin", "ai_service"]);
export const AppointmentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
export const AppointmentSourceSchema = z.enum(["whatsapp", "dashboard"]);
export const ConversationStateSchema = z.enum([
  "new",
  "greeting",
  "browsing",
  "faq",
  "collecting",
  "collecting_info",
  "scheduling",
  "confirming",
  "confirmed",
  "booked",
  "handoff",
  "closed",
]);
export const MessageDirectionSchema = z.enum(["in", "out"]);
export const MessageTypeSchema = z.enum(["text", "interactive", "image", "system"]);
export const MessageAuthorSchema = z.enum(["patient", "ai", "staff", "system"]);
export const MessageStatusSchema = z.enum(["received", "sent", "delivered", "read", "failed"]);
export const ResourceTypeSchema = z.enum(["practitioner", "room", "equipment"]);
export const WebhookProviderSchema = z.enum(["whatsapp"]);

export const TenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  status: TenantStatusSchema,
  whatsapp: z.object({
    phoneNumberId: z.string().min(1),
    displayPhone: z.string().min(1),
    wabaId: z.string().min(1),
    accessTokenRef: z.string().min(1),
  }),
  subscription: z.object({
    plan: z.string().min(1),
    seats: z.number().int().positive(),
    renewsAt: FirestoreTimestampSchema,
  }),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export type Tenant = z.infer<typeof TenantSchema>;

export const TimeRangeSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

export const SettingsProfileSchema = z.object({
  timezone: z.string().min(1),
  locale: z.string().min(2),
  location: z.object({
    address: z.string().min(1),
    mapsUrl: z.string().url().optional(),
  }),
  workingHours: z.record(z.string().regex(/^[0-6]$/), z.array(TimeRangeSchema)),
  slotLengthMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().nonnegative(),
  minLeadTimeMinutes: z.number().int().nonnegative(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export type SettingsProfile = z.infer<typeof SettingsProfileSchema>;

export const UserSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: UserRoleSchema.extract(["owner", "staff"]),
  active: z.boolean(),
  createdAt: FirestoreTimestampSchema,
});

export type User = z.infer<typeof UserSchema>;

export const ServiceSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  fee: z.number().int().nonnegative(),
  currency: z.string().length(3),
  active: z.boolean(),
});

export type Service = z.infer<typeof ServiceSchema>;

export const ResourceSchema = z.object({
  name: z.string().min(1),
  type: ResourceTypeSchema,
  active: z.boolean(),
});

export type Resource = z.infer<typeof ResourceSchema>;

export const PatientSchema = z.object({
  waId: z.string().min(1),
  phone: z.string().min(1),
  name: z.string().min(1),
  nameLower: z.string().min(1),
  notes: z.string(),
  lastSeenAt: FirestoreTimestampSchema,
  createdAt: FirestoreTimestampSchema,
});

export type Patient = z.infer<typeof PatientSchema>;

export const AppointmentSchema = z.object({
  patientId: z.string().min(1),
  serviceId: z.string().min(1),
  resourceId: z.string().min(1),
  startsAt: FirestoreTimestampSchema,
  endsAt: FirestoreTimestampSchema,
  status: AppointmentStatusSchema,
  source: AppointmentSourceSchema,
  createdBy: z.string().min(1),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export type Appointment = z.infer<typeof AppointmentSchema>;

export const ConversationSchema = z.object({
  patientId: z.string().min(1),
  waId: z.string().min(1),
  state: ConversationStateSchema,
  aiPaused: z.boolean(),
  needsHuman: z.boolean(),
  summary: z.string(),
  context: z.record(z.string(), z.unknown()),
  lastInboundAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  direction: MessageDirectionSchema,
  channel: z.literal("whatsapp"),
  waMessageId: z.string().min(1).optional(),
  type: MessageTypeSchema,
  text: z.string(),
  author: MessageAuthorSchema,
  status: MessageStatusSchema,
  createdAt: FirestoreTimestampSchema,
});

export type Message = z.infer<typeof MessageSchema>;

export const FaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string().min(1)),
  active: z.boolean(),
  updatedAt: FirestoreTimestampSchema,
});

export type Faq = z.infer<typeof FaqSchema>;

export const AuditLogSchema = z.object({
  actorUid: z.string().min(1),
  role: UserRoleSchema,
  action: z.string().min(1),
  target: z.string().min(1),
  meta: z.record(z.string(), z.unknown()),
  at: FirestoreTimestampSchema,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const WebhookEventSchema = z.object({
  provider: WebhookProviderSchema,
  externalId: z.string().min(1),
  processedAt: FirestoreTimestampSchema,
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const CreateServiceDtoSchema = ServiceSchema.pick({
  name: true,
  durationMinutes: true,
  fee: true,
  currency: true,
}).extend({
  active: z.boolean().optional(),
});

export type CreateServiceDto = z.infer<typeof CreateServiceDtoSchema>;

export const UpdateServiceDtoSchema = ServiceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one service field is required",
);

export type UpdateServiceDto = z.infer<typeof UpdateServiceDtoSchema>;

export const UpsertSettingsDtoSchema = SettingsProfileSchema;

export type UpsertSettingsDto = z.infer<typeof UpsertSettingsDtoSchema>;

export const CreateFaqDtoSchema = FaqSchema.pick({
  question: true,
  answer: true,
  tags: true,
}).extend({
  active: z.boolean().optional(),
});

export type CreateFaqDto = z.infer<typeof CreateFaqDtoSchema>;

export const UpdateFaqDtoSchema = FaqSchema.pick({
  question: true,
  answer: true,
  tags: true,
  active: true,
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one FAQ field is required");

export type UpdateFaqDto = z.infer<typeof UpdateFaqDtoSchema>;

export const PatientSearchQuerySchema = z.object({
  q: z.string().trim().optional(),
});

export type PatientSearchQuery = z.infer<typeof PatientSearchQuerySchema>;

export const CreatePatientDtoSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  waId: z.string().trim().min(1).optional(),
  notes: z.string().optional(),
});

export type CreatePatientDto = z.infer<typeof CreatePatientDtoSchema>;

export const UpdatePatientDtoSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one patient field is required");

export type UpdatePatientDto = z.infer<typeof UpdatePatientDtoSchema>;

export const AvailabilityQuerySchema = z.object({
  serviceId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  resourceId: z.string().min(1).optional(),
});

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

export const AppointmentListQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  status: AppointmentStatusSchema.optional(),
});

export type AppointmentListQuery = z.infer<typeof AppointmentListQuerySchema>;

export const CreateAppointmentDtoSchema = z.object({
  serviceId: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  patientId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
});

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentDtoSchema>;

export const UpdateAppointmentDtoSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }).optional(),
    status: AppointmentStatusSchema.optional(),
    resourceId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one appointment field is required");

export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentDtoSchema>;

export const HealthStatusSchema = z.object({
  status: z.literal("ok"),
});

export type HealthStatusDto = z.infer<typeof HealthStatusSchema>;

export const productName = "Clinic AI Receptionist";
