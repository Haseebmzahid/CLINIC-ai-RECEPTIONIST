import { CircleHelp } from "lucide-react";

import { SectionHeader } from "../../../../components/layout/SectionHeader";
import { Panel } from "../../../../components/ui/Panel";

export default function FaqSettingsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="FAQs" />
      <Panel>
        <div className="empty-state">
          <CircleHelp aria-hidden="true" size={24} />
          <strong>No FAQs loaded</strong>
        </div>
      </Panel>
    </div>
  );
}
