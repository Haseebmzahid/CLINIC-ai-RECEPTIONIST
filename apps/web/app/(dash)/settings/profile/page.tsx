import { MapPin } from "lucide-react";

import { SectionHeader } from "../../../../components/layout/SectionHeader";
import { Panel } from "../../../../components/ui/Panel";

export default function ProfileSettingsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Profile" />
      <Panel>
        <div className="empty-state">
          <MapPin aria-hidden="true" size={24} />
          <strong>No profile changes</strong>
        </div>
      </Panel>
    </div>
  );
}
