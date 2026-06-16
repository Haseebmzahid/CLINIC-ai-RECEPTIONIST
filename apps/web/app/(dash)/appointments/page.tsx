import { CalendarDays } from "lucide-react";

import { SectionHeader } from "../../../components/layout/SectionHeader";
import { Panel } from "../../../components/ui/Panel";

export default function AppointmentsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Appointments" />
      <Panel>
        <div className="empty-state">
          <CalendarDays aria-hidden="true" size={24} />
          <strong>No appointments</strong>
        </div>
      </Panel>
    </div>
  );
}
