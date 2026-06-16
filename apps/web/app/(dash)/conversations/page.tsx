import { MessageSquareText } from "lucide-react";

import { SectionHeader } from "../../../components/layout/SectionHeader";
import { Panel } from "../../../components/ui/Panel";

export default function ConversationsPage() {
  return (
    <div className="page-stack">
      <SectionHeader title="Conversations" />
      <Panel>
        <div className="empty-state">
          <MessageSquareText aria-hidden="true" size={24} />
          <strong>No conversations</strong>
        </div>
      </Panel>
    </div>
  );
}
