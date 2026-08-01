"use client";

import { useState } from "react";
import type { Conversation } from "@/lib/api";

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function startEditing(conversation: Conversation) {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  }

  function commitRename() {
    if (editingId && draftTitle.trim()) {
      onRename(editingId, draftTitle.trim());
    }
    setEditingId(null);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-line px-4 py-8 flex flex-col gap-5">
      <button
        onClick={onNewChat}
        className="font-mono text-[11px] tracking-[0.12em] uppercase border border-line rounded-md px-3 py-2 text-ink-muted hover:border-signal hover:text-signal transition-colors"
      >
        + New chat
      </button>

      <div className="space-y-1 overflow-y-auto">
        <p className="font-mono text-[10px] tracking-[0.18em] text-ink-muted/60 uppercase px-1 pb-1">
          Conversations
        </p>

        {conversations.length === 0 && (
          <p className="font-mono text-[11px] text-ink-muted/60 italic px-1 py-2">
            No conversations yet.
          </p>
        )}

        {conversations.map((conversation) => {
          const isActive = conversation.id === activeId;

          if (editingId === conversation.id) {
            return (
              <input
                key={conversation.id}
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full font-mono text-xs bg-transparent border border-signal rounded px-2 py-1.5 focus:outline-none"
              />
            );
          }

          return (
            <div
              key={conversation.id}
              className={`group flex items-center gap-1 rounded px-2 py-1.5 transition-colors ${
                isActive ? "bg-signal-soft" : "hover:bg-signal-soft/40"
              }`}
            >
              <button
                onClick={() => onSelect(conversation.id)}
                onDoubleClick={() => startEditing(conversation)}
                title={`${conversation.title} — double-click to rename`}
                className={`flex-1 text-left font-mono text-xs truncate transition-colors ${
                  isActive ? "text-signal" : "text-ink-muted hover:text-ink"
                }`}
              >
                {conversation.title}
              </button>

              {confirmingId === conversation.id ? (
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onDelete(conversation.id);
                      setConfirmingId(null);
                    }}
                    className="font-mono text-[10px] text-red-700 hover:underline"
                  >
                    yes
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="font-mono text-[10px] text-ink-muted hover:text-ink"
                  >
                    no
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmingId(conversation.id)}
                  title="Delete conversation"
                  className="font-mono text-[10px] text-ink-muted hover:text-red-700 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
