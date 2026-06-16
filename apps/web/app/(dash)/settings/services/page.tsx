import { ClipboardList } from "lucide-react";

import { SectionHeader } from "../../../../components/layout/SectionHeader";
import { Panel } from "../../../../components/ui/Panel";

export default function ServicesSettingsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Services" />
      <Panel>
        <div className="empty-state">
          <ClipboardList aria-hidden="true" size={24} />
          <strong>No services loaded</strong>
        </div>
      </Panel>
    </div>
  );
}
