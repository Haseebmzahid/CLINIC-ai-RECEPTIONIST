"use client";

import { CreateFaqDtoSchema, UpdateFaqDtoSchema } from "@clinic-ai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import type { Faq } from "../../lib/api/client";
import { ApiClientError, type CreateFaqInput } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/AuthProvider";
import { SectionHeader } from "../layout/SectionHeader";
import { Panel } from "../ui/Panel";
import { OwnerGate } from "./OwnerGate";

const blankFaq: CreateFaqInput = {
  question: "",
  answer: "",
  tags: [],
  active: true,
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError || error instanceof Error) {
    return error.message;
  }

  return "FAQ changes could not be saved.";
}

export function FaqSettingsManager() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Faq | null>(null);
  const [form, setForm] = useState<CreateFaqInput>(blankFaq);
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.getMe();
    },
    enabled: Boolean(api),
  });
  const faqsQuery = useQuery({
    queryKey: ["faqs"],
    queryFn: async () => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      return api.listFaqs();
    },
    enabled: Boolean(api && meQuery.data?.role === "owner"),
  });

  const saveMutation = useMutation({
    mutationFn: async (input: CreateFaqInput & { id?: string }) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      if (input.id) {
        const parsed = UpdateFaqDtoSchema.parse({
          active: input.active,
          answer: input.answer,
          question: input.question,
          tags: input.tags,
        });
        return api.updateFaq(input.id, parsed);
      }

      const parsed = CreateFaqDtoSchema.parse(input);
      return api.createFaq(parsed);
    },
    onSuccess: async (faq) => {
      setError("");
      setSelected(faq);
      setForm({ active: faq.active, answer: faq.answer, question: faq.question, tags: faq.tags });
      setTags(faq.tags.join(", "));
      await queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (faqId: string) => {
      if (!api) {
        throw new Error("API client is unavailable.");
      }

      await api.deleteFaq(faqId);
    },
    onSuccess: async () => {
      setSelected(null);
      setForm(blankFaq);
      setTags("");
      await queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  function editFaq(faq: Faq) {
    setSelected(faq);
    setForm({ active: faq.active, answer: faq.answer, question: faq.question, tags: faq.tags });
    setTags(faq.tags.join(", "));
    setError("");
  }

  function newFaq() {
    setSelected(null);
    setForm(blankFaq);
    setTags("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      ...form,
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    await saveMutation.mutateAsync({ ...next, id: selected?.id });
  }

  return (
    <div className="page-stack">
      <SectionHeader title="FAQs" />
      <OwnerGate me={meQuery.data}>
        <div className="split-layout">
          <Panel title="FAQ list">
            <div className="record-list">
              {(faqsQuery.data ?? []).map((faq) => (
                <button
                  className={`record-list-item ${faq.id === selected?.id ? "is-selected" : ""}`}
                  key={faq.id}
                  onClick={() => editFaq(faq)}
                  type="button"
                >
                  <strong>{faq.question}</strong>
                  <span>{faq.active ? "active" : "inactive"}</span>
                </button>
              ))}
            </div>
            <button className="secondary-button" onClick={newFaq} type="button">
              <Plus aria-hidden="true" size={18} />
              New FAQ
            </button>
          </Panel>

          <Panel title={selected ? "Edit FAQ" : "Add FAQ"}>
            <form
              className="stack-form"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              <label className="field" htmlFor="faq-question">
                Question
                <input
                  className="plain-input"
                  id="faq-question"
                  onChange={(event) => setForm({ ...form, question: event.target.value })}
                  value={form.question}
                />
              </label>
              <label className="field" htmlFor="faq-answer">
                Answer
                <textarea
                  className="plain-textarea"
                  id="faq-answer"
                  onChange={(event) => setForm({ ...form, answer: event.target.value })}
                  rows={5}
                  value={form.answer}
                />
              </label>
              <label className="field" htmlFor="faq-tags">
                Tags
                <input
                  className="plain-input"
                  id="faq-tags"
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="hours, location"
                  value={tags}
                />
              </label>
              <label className="check-field">
                <input
                  checked={form.active ?? true}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  type="checkbox"
                />
                Active
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="button-row">
                <button className="primary-button" disabled={saveMutation.isPending} type="submit">
                  <Save aria-hidden="true" size={18} />
                  {selected ? "Save FAQ" : "Create FAQ"}
                </button>
                {selected ? (
                  <button
                    className="danger-button"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void deleteMutation.mutateAsync(selected.id);
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </Panel>
        </div>
      </OwnerGate>
    </div>
  );
}
