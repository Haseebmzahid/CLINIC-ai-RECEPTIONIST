import { SectionHeader } from "../../../../components/layout/SectionHeader";
import { TenantAdminManager } from "../../../../components/admin/TenantAdminManager";

export default function AdminTenantsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Tenants" />
      <TenantAdminManager />
    </div>
  );
}
