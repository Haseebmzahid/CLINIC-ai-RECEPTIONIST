import { Users } from "lucide-react";

import { SectionHeader } from "../../../components/layout/SectionHeader";
import { Panel } from "../../../components/ui/Panel";

export default function PatientsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Patients" />
      <Panel>
        <div className="empty-state">
          <Users aria-hidden="true" size={24} />
          <strong>No patients</strong>
        </div>
      </Panel>
    </div>
  );
}
