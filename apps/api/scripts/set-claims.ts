import { z } from "zod";

import { getAdminAuth } from "../src/integrations/firebase";

const ArgsSchema = z.object({
  uid: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  role: z.enum(["owner", "staff", "platform_admin"]),
});

function parseArgs(argv: string[]): z.infer<typeof ArgsSchema> {
  const [uid, tenantIdOrRole, maybeRole] = argv;
  const role = maybeRole ?? tenantIdOrRole;
  const tenantId = maybeRole ? tenantIdOrRole : undefined;

  return ArgsSchema.parse({ uid, tenantId, role });
}

const claims = parseArgs(process.argv.slice(2));

await getAdminAuth().setCustomUserClaims(claims.uid, {
  role: claims.role,
  ...(claims.tenantId ? { tenantId: claims.tenantId } : {}),
});

console.log(`Set claims for ${claims.uid}`);
