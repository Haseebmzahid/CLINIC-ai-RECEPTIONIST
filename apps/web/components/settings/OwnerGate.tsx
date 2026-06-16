"use client";

import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { Me } from "../../lib/api/client";
import { Panel } from "../ui/Panel";

interface OwnerGateProps {
  me?: Me;
  children: ReactNode;
}

export function OwnerGate({ me, children }: OwnerGateProps) {
  if (!me) {
    return (
      <Panel>
        <div className="empty-state">Loading access</div>
      </Panel>
    );
  }

  if (me.role !== "owner") {
    return (
      <Panel>
        <div className="empty-state">
          <ShieldAlert aria-hidden="true" size={24} />
          <strong>Owner access required</strong>
        </div>
      </Panel>
    );
  }

  return children;
}
