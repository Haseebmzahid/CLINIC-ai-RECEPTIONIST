import type { LucideIcon } from "lucide-react";

import { Panel } from "../ui/Panel";

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Panel>
      <div className="metric">
        <Icon aria-hidden="true" size={20} />
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Panel>
  );
}
