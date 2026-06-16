"use client";

import { Send, ToggleLeft, ToggleRight } from "lucide-react";
import { FormEvent, useState } from "react";

import type { ConversationMessage, ConversationSummary } from "../../lib/api/client";
import { displayDateTime } from "../../lib/dates";

interface ConversationThreadProps {
  conversation?: ConversationSummary;
  error?: string;
  isSending: boolean;
  isUpdating: boolean;
  messages: ConversationMessage[];
  onSend: (text: string) => Promise<void>;
  onToggleAiPaused: (aiPaused: boolean) => Promise<void>;
}

function bubbleLabel(message: ConversationMessage): string {
  if (message.author === "patient") {
    return "Patient";
  }

  if (message.author === "staff") {
    return "Staff";
  }

  if (message.author === "system") {
    return "System";
  }

  return "AI";
}

export function ConversationThread({
  conversation,
  error,
  isSending,
  isUpdating,
  messages,
  onSend,
  onToggleAiPaused,
}: ConversationThreadProps) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text) {
      return;
    }

    await onSend(text);
    setDraft("");
  }

  if (!conversation) {
    return <div className="conversation-thread-empty">Select a conversation</div>;
  }

  return (
    <section className="conversation-thread" aria-label="Conversation transcript">
      <header className="conversation-thread-header">
        <div>
          <h2>+{conversation.waId}</h2>
          <p>{conversation.aiPaused ? "AI paused" : `AI active - ${conversation.state}`}</p>
        </div>
        <button
          className="secondary-button"
          disabled={isUpdating}
          onClick={() => {
            void onToggleAiPaused(!conversation.aiPaused);
          }}
          type="button"
        >
          {conversation.aiPaused ? (
            <ToggleRight aria-hidden="true" size={18} />
          ) : (
            <ToggleLeft aria-hidden="true" size={18} />
          )}
          {conversation.aiPaused ? "Resume AI" : "Take over"}
        </button>
      </header>

      <div className="message-transcript">
        {messages.map((message) => (
          <article className={`message-bubble message-bubble-${message.author}`} key={message.id}>
            <div className="message-meta">
              <strong>{bubbleLabel(message)}</strong>
              <span>{displayDateTime(message.createdAt)}</span>
            </div>
            <p>{message.text}</p>
            <small>{message.status}</small>
          </article>
        ))}
        {messages.length === 0 ? <div className="empty-state">No messages yet</div> : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <form
        className="composer"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <label htmlFor="staff-reply">Reply</label>
        <div className="composer-row">
          <textarea
            id="staff-reply"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a WhatsApp reply"
            rows={3}
            value={draft}
          />
          <button className="primary-button" disabled={isSending || !draft.trim()} type="submit">
            <Send aria-hidden="true" size={18} />
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
