import { Building2 } from "lucide-react";

import { SectionHeader } from "../../../../components/layout/SectionHeader";
import { Panel } from "../../../../components/ui/Panel";

export default function AdminTenantsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Tenants" />
      <Panel>
        <div className="empty-state">
          <Building2 aria-hidden="true" size={24} />
          <strong>No tenants loaded</strong>
        </div>
      </Panel>
    </div>
  );
}
