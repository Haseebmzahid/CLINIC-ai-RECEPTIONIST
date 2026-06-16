"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { ConversationSummary } from "../../lib/api/client";
import { ApiClientError } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { SectionHeader } from "../layout/SectionHeader";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The conversation action failed.";
}

export function ConversationsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [stateFilter, setStateFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [actionError, setActionError] = useState("");
  const conversationKey = useMemo(() => ["conversations", stateFilter] as const, [stateFilter]);

  const conversationsQuery = useQuery({
    queryKey: conversationKey,
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listConversations({ state: stateFilter || undefined });
    },
    enabled: Boolean(api),
    refetchInterval: 5000,
  });
  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

  useEffect(() => {
    if (!selectedId && conversations[0]) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const messagesQuery = useQuery({
    queryKey: ["conversation-messages", selectedId],
    queryFn: async () => {
      if (!api || !selectedId) {
        throw new Error("Conversation is unavailable.");
      }

      return api.listConversationMessages(selectedId);
    },
    enabled: Boolean(api && selectedId),
    refetchInterval: 3000,
  });

  const updateConversationMutation = useMutation({
    mutationFn: async (input: { conversationId: string; aiPaused: boolean }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.updateConversation(input.conversationId, { aiPaused: input.aiPaused });
    },
    onMutate: async (input) => {
      setActionError("");
      await queryClient.cancelQueries({ queryKey: conversationKey });
      const previous = queryClient.getQueryData<ConversationSummary[]>(conversationKey);

      queryClient.setQueryData<ConversationSummary[]>(conversationKey, (current = []) =>
        current.map((conversation) =>
          conversation.id === input.conversationId
            ? {
                ...conversation,
                state: input.aiPaused ? "handoff" : "browsing",
                aiPaused: input.aiPaused,
                needsHuman: input.aiPaused,
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );

      return { previous };
    },
    onError: (error, _input, context) => {
      setActionError(errorMessage(error));
      queryClient.setQueryData(conversationKey, context?.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: conversationKey });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: { conversationId: string; text: string }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.sendConversationMessage(input.conversationId, input.text);
    },
    onSuccess: async () => {
      setActionError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversation-messages", selectedId] }),
        queryClient.invalidateQueries({ queryKey: conversationKey }),
      ]);
    },
    onError: (error) => {
      setActionError(errorMessage(error));
    },
  });

  return (
    <div className="page-stack">
      <SectionHeader title="Conversations" />
      <div className="conversation-toolbar">
        <label className="field compact-field" htmlFor="conversation-state">
          State
          <select
            id="conversation-state"
            onChange={(event) => setStateFilter(event.target.value)}
            value={stateFilter}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="browsing">Browsing</option>
            <option value="collecting">Collecting</option>
            <option value="scheduling">Scheduling</option>
            <option value="handoff">Handoff</option>
            <option value="booked">Booked</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      <div className="conversation-layout">
        <ConversationList
          conversations={conversations}
          onSelect={(conversation) => setSelectedId(conversation.id)}
          selectedId={selectedId}
        />
        <ConversationThread
          conversation={selectedConversation}
          error={actionError}
          isSending={sendMessageMutation.isPending}
          isUpdating={updateConversationMutation.isPending}
          messages={messagesQuery.data ?? []}
          onSend={async (text) => {
            if (!selectedId) {
              return;
            }

            await sendMessageMutation.mutateAsync({ conversationId: selectedId, text });
          }}
          onToggleAiPaused={async (aiPaused) => {
            if (!selectedId) {
              return;
            }

            await updateConversationMutation.mutateAsync({ conversationId: selectedId, aiPaused });
          }}
        />
      </div>
    </div>
  );
}
