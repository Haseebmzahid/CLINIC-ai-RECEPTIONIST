"use client";

import { AlertCircle, Bot, CirclePause } from "lucide-react";

import type { ConversationSummary } from "../../lib/api/client";
import { displayDateTime } from "../../lib/dates";

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId?: string;
  onSelect: (conversation: ConversationSummary) => void;
}

function badgeText(conversation: ConversationSummary): string {
  if (conversation.aiPaused) {
    return "AI paused";
  }

  if (conversation.needsHuman) {
    return "Needs human";
  }

  return conversation.state;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  return (
    <div className="conversation-list" aria-label="Conversation inbox">
      {conversations.map((conversation) => (
        <button
          className={`conversation-list-item ${conversation.id === selectedId ? "is-selected" : ""}`}
          key={conversation.id}
          onClick={() => onSelect(conversation)}
          type="button"
        >
          <span className="conversation-title">
            <strong>+{conversation.waId}</strong>
            <small>{displayDateTime(conversation.updatedAt)}</small>
          </span>
          <span className="conversation-badges">
            {conversation.needsHuman ? (
              <span className="status-badge status-badge-warning">
                <AlertCircle aria-hidden="true" size={14} />
                Needs human
              </span>
            ) : null}
            {conversation.aiPaused ? (
              <span className="status-badge status-badge-paused">
                <CirclePause aria-hidden="true" size={14} />
                AI paused
              </span>
            ) : null}
            <span className="status-badge">
              <Bot aria-hidden="true" size={14} />
              {badgeText(conversation)}
            </span>
          </span>
        </button>
      ))}
      {conversations.length === 0 ? <div className="empty-state">No conversations</div> : null}
    </div>
  );
}
