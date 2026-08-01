"use client";

import { useState, useRef, useEffect, useCallback, useTransition, memo } from "react";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import {
  API_BASE,
  createConversation,
  deleteConversation as deleteConversationApi,
  getConversation,
  listConversations,
  renameConversation as renameConversationApi,
  type Conversation,
  type Message,
  type Source,
} from "@/lib/api";

const MAX_FILE_SIZE_MB = 20;

interface IngestedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

interface QueryStats {
  chunksRetrieved: number;
  chunksUsed: number;
  mode: "semantic" | "hybrid";
  elapsedMs: number;
}

interface UploadProgress {
  current: number;
  total: number;
  filename: string;
}

// ─── Citation Tab ────────────────────────────────────────────────────────────

const CitationTab = memo(function CitationTab({
  index,
  source,
}: {
  index: number;
  source: Source;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="inline-block align-top mr-1.5 mb-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={`Source ${index}: ${source.filename}`}
        className={`font-mono text-xs px-2 py-1 rounded border transition-all duration-150 ${
          expanded
            ? "bg-signal text-paper border-signal shadow-sm"
            : "bg-signal-soft text-signal border-line hover:border-signal"
        }`}
      >
        {String(index).padStart(2, "0")}
      </button>

      {expanded && (
        <div className="mt-1.5 w-72 p-3 border border-line rounded-md bg-paper shadow-md">
          <p className="font-mono text-[11px] text-ink-muted mb-1.5 leading-snug">
            {source.filename}
            <span className="mx-1 text-line">·</span>
            chunk {source.chunk_index}
          </p>

          {(source.status || source.verified) && (
            <p className="font-mono text-[10px] mb-1.5 flex flex-wrap gap-1.5">
              {source.status && (
                <span
                  className={`px-1.5 py-0.5 rounded border ${
                    source.status === "draft"
                      ? "text-amber-700 border-amber-700/40"
                      : "text-signal border-signal/30"
                  }`}
                >
                  {source.status}
                </span>
              )}
              {source.verified && (
                <span className="px-1.5 py-0.5 rounded border text-ink-muted border-line">
                  {source.verified}-verified
                </span>
              )}
            </p>
          )}

          {source.text ? (
            <p className="font-mono text-[11px] text-ink leading-relaxed">
              {source.text}
              {source.text.length >= 200 ? "…" : ""}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-ink-muted italic">
              Snippet not available.
            </p>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Sources block (shared by streaming answer and persisted messages) ───────

const SourceList = memo(function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="pt-2">
      <p className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase mb-3">
        Sources
      </p>
      <div className="flex flex-wrap gap-0">
        {sources.map((s, i) => (
          <CitationTab key={i} index={i + 1} source={s} />
        ))}
      </div>
      <p className="font-mono text-[10px] text-ink-muted/60 mt-2">
        Click an index card to reveal the source passage.
      </p>
    </div>
  );
});

// ─── One persisted message ───────────────────────────────────────────────────

const MessageBlock = memo(function MessageBlock({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-ink-muted/60 uppercase">
          You
        </p>
        <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-l-2 border-line pl-5">
      <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">
        {message.content}
      </p>
      <SourceList sources={message.sources} />
    </div>
  );
});

// ─── Live streaming answer ───────────────────────────────────────────────────

const StreamingAnswer = memo(function StreamingAnswer({
  question,
  answer,
  isStreaming,
  sources,
  queryStats,
}: {
  question: string;
  answer: string;
  isStreaming: boolean;
  sources: Source[];
  queryStats: QueryStats | null;
}) {
  if (!isStreaming && !answer) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-ink-muted/60 uppercase">
          You
        </p>
        <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">{question}</p>
      </div>

      <div className="space-y-4 border-l-2 border-line pl-5" aria-live="polite">
        <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">
          {answer}
          {isStreaming && (
            <span className="inline-block w-[2px] h-[1em] bg-ink-muted ml-0.5 align-middle animate-pulse" />
          )}
        </p>

        {queryStats && !isStreaming && (
          <p className="font-mono text-[11px] text-ink-muted">
            {queryStats.chunksRetrieved} chunks retrieved · {queryStats.chunksUsed} used ·{" "}
            {queryStats.mode} · {(queryStats.elapsedMs / 1000).toFixed(1)}s
          </p>
        )}

        <SourceList sources={sources} />
      </div>
    </div>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [ingestedDocs, setIngestedDocs] = useState<IngestedDoc[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<"semantic" | "hybrid">("semantic");
  const [queryStats, setQueryStats] = useState<QueryStats | null>(null);

  const currentAnswerRef = useRef("");
  const currentSourcesRef = useRef<Source[]>([]);
  const queryStartRef = useRef<number>(0);

  const [, startTransition] = useTransition();

  useEffect(() => {
    fetchDocuments();
    refreshConversations();
  }, []);

  async function refreshConversations() {
    try {
      const data = await listConversations();
      setConversations(data.conversations);
    } catch {
      // backend may not be reachable on first load
    }
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      const data = await res.json();
      setIngestedDocs(
        data.documents.map(
          (d: { document_id: string; filename: string; chunk_count: number }) => ({
            documentId: d.document_id,
            filename: d.filename,
            chunkCount: d.chunk_count,
          })
        )
      );
    } catch {
      // silent — backend may not be reachable on first load
    }
  }

  function clearThreadView() {
    setAnswer("");
    setAskedQuestion("");
    setSources([]);
    setQueryStats(null);
    setQueryError("");
  }

  async function handleSelectConversation(id: string) {
    if (isStreaming) return;
    clearThreadView();
    setActiveId(id);
    try {
      const detail = await getConversation(id);
      setMessages(detail.messages);
    } catch {
      setQueryError("Couldn't load that conversation.");
    }
  }

  function handleNewChat() {
    if (isStreaming) return;
    clearThreadView();
    setActiveId(null);
    setMessages([]);
    setQuestion("");
  }

  async function handleRename(id: string, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    try {
      await renameConversationApi(id, title);
    } catch {
      refreshConversations();
    }
  }

  async function handleDeleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
      clearThreadView();
    }
    try {
      await deleteConversationApi(id);
    } catch {
      refreshConversations();
    }
  }

  async function handleFilesUpload(files: File[]) {
    const valid: File[] = [];
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
        setUploadError(`${file.name}: Only PDF and DOCX files are supported.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(
          `${file.name}: File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
        );
        return;
      }
      valid.push(file);
    }

    if (valid.length === 0) return;

    setIsUploading(true);
    setUploadError("");

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setUploadProgress({ current: i + 1, total: valid.length, filename: file.name });

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`${API_BASE}/api/ingest`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Upload failed");

        setIngestedDocs((prev) => [
          ...prev,
          {
            documentId: data.document_id,
            filename: data.filename,
            chunkCount: data.chunk_count,
          },
        ]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        break;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFilesUpload(files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      e.preventDefault();
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".pdf") || n.endsWith(".docx");
    });
    if (files.length > 0) handleFilesUpload(files);
  }

  async function handleDelete(documentId: string) {
    try {
      await fetch(`${API_BASE}/api/documents/${documentId}`, { method: "DELETE" });
      setIngestedDocs((prev) => prev.filter((d) => d.documentId !== documentId));
    } catch {
      setUploadError("Failed to remove document.");
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!question.trim() || isStreaming) return;

    // Fold the previous exchange into the thread before starting a new one.
    if (currentAnswerRef.current && askedQuestion) {
      const previousQuestion = askedQuestion;
      const previousAnswer = currentAnswerRef.current;
      const previousSources = currentSourcesRef.current;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-user-${Date.now()}`,
          role: "user",
          content: previousQuestion,
          sources: [],
          created_at: new Date().toISOString(),
        },
        {
          id: `local-assistant-${Date.now()}`,
          role: "assistant",
          content: previousAnswer,
          sources: previousSources,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    let conversationId = activeId;
    if (!conversationId) {
      try {
        const conversation = await createConversation();
        conversationId = conversation.id;
        setActiveId(conversation.id);
        setConversations((prev) => [conversation, ...prev]);
      } catch {
        setQueryError("Couldn't start a conversation. Is the backend running?");
        return;
      }
    }

    const submitted = question;
    currentAnswerRef.current = "";
    currentSourcesRef.current = [];
    queryStartRef.current = Date.now();

    setAskedQuestion(submitted);
    setQuestion("");
    setAnswer("");
    setSources([]);
    setQueryError("");
    setQueryStats(null);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: submitted,
          retrieval_mode: retrievalMode,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "sources") {
              const src: Source[] = Array.isArray(event.data) ? event.data : [];
              currentSourcesRef.current = src;
              setSources(src);
              setQueryStats({
                chunksRetrieved: event.chunks_retrieved ?? src.length,
                chunksUsed: event.chunks_used ?? src.length,
                mode: retrievalMode,
                elapsedMs: Date.now() - queryStartRef.current,
              });
            } else if (event.type === "token") {
              currentAnswerRef.current += event.data;
              startTransition(() => {
                setAnswer((prev) => prev + event.data);
              });
            } else if (event.type === "done") {
              const elapsed = Date.now() - queryStartRef.current;
              setIsStreaming(false);
              setQueryStats((prev) =>
                prev
                  ? { ...prev, elapsedMs: elapsed }
                  : {
                      chunksRetrieved: currentSourcesRef.current.length,
                      chunksUsed: currentSourcesRef.current.length,
                      mode: retrievalMode,
                      elapsedMs: elapsed,
                    }
              );
              refreshConversations();
            }
          } catch {
            /* partial chunk boundary — skip */
          }
        }
      }
    } catch {
      setQueryError("Couldn't reach the backend. Check it's running and try again.");
    } finally {
      setIsStreaming(false);
    }
  }, [question, isStreaming, startTransition, retrievalMode, activeId, askedQuestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const totalChunks = ingestedDocs.reduce((sum, d) => sum + d.chunkCount, 0);
  const hasThread = messages.length > 0 || Boolean(answer) || isStreaming;

  return (
    <main className="min-h-screen bg-paper text-ink flex">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onRename={handleRename}
        onDelete={handleDeleteConversation}
      />

      <div className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto px-6 py-16 space-y-14">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <header className="space-y-4 border-b border-line pb-10">
            <p className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase">
              Document intelligence
            </p>
            <h1 className="font-display text-[2.6rem] font-medium leading-[1.1] tracking-tight">
              Ask your documents.
            </h1>
            <p className="text-sm text-ink-muted max-w-sm leading-relaxed">
              Every answer is traced to the exact passage it came from — nothing else.
            </p>
          </header>

          {/* ── Intake / Upload ───────────────────────────────────────────── */}
          <section className="space-y-4" aria-labelledby="intake-heading">
            <h2
              id="intake-heading"
              className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase"
            >
              Intake
              {ingestedDocs.length > 0 && (
                <span className="normal-case tracking-normal ml-2 text-ink-muted/70">
                  ({ingestedDocs.length} {ingestedDocs.length === 1 ? "document" : "documents"} · {totalChunks} chunks)
                </span>
              )}
            </h2>

            <div
              className={`border border-dashed rounded-lg p-5 space-y-4 transition-colors ${
                isDragOver
                  ? "border-signal bg-signal-soft/20"
                  : "border-line hover:border-ink-muted"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx"
                  multiple
                  onChange={handleFileInputChange}
                  disabled={isUploading}
                  className="text-sm font-mono text-ink-muted file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-line file:bg-signal-soft file:text-signal file:font-mono file:text-xs file:cursor-pointer hover:file:border-signal transition-colors disabled:opacity-50"
                />
                <span className="font-mono text-[11px] text-ink-muted shrink-0">
                  PDF or DOCX · up to {MAX_FILE_SIZE_MB} MB
                </span>
              </div>

              {isUploading && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-signal">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-60" />
                    <span className="relative inline-flex rounded-full size-2 bg-signal" />
                  </span>
                  {uploadProgress && uploadProgress.total > 1
                    ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}: ${uploadProgress.filename}`
                    : uploadProgress
                    ? `Uploading: ${uploadProgress.filename}`
                    : "Processing…"}
                </span>
              )}

              {uploadError && (
                <p className="font-mono text-[11px] text-red-700" role="alert">
                  {uploadError}
                </p>
              )}

              {!isUploading && ingestedDocs.length === 0 && (
                <p className="font-mono text-[11px] text-ink-muted/60 italic">
                  No documents yet. Upload a PDF or DOCX to begin.
                </p>
              )}

              {ingestedDocs.length > 0 && (
                <div className="pt-3 border-t border-line space-y-2">
                  {ingestedDocs.map((doc) => (
                    <div
                      key={doc.documentId}
                      className="flex items-center justify-between gap-3 group"
                    >
                      <span className="font-mono text-xs text-ink-muted truncate">
                        {doc.filename}
                        <span className="mx-1.5 text-line">·</span>
                        <span className="text-ink-muted/60">{doc.chunkCount} chunks</span>
                      </span>
                      <button
                        onClick={() => handleDelete(doc.documentId)}
                        className="font-mono text-[11px] text-ink-muted hover:text-red-700 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Conversation thread ───────────────────────────────────────── */}
          {hasThread && (
            <section className="space-y-8 border-t border-line pt-10" aria-label="Conversation">
              {messages.map((message) => (
                <MessageBlock key={message.id} message={message} />
              ))}
              <StreamingAnswer
                question={askedQuestion}
                answer={answer}
                isStreaming={isStreaming}
                sources={sources}
                queryStats={queryStats}
              />
            </section>
          )}

          {/* ── Inquiry / Query ───────────────────────────────────────────── */}
          <section className="space-y-4" aria-labelledby="inquiry-heading">
            <h2
              id="inquiry-heading"
              className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase"
            >
              Inquiry
            </h2>

            <textarea
              id="question-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasThread ? "Ask a follow-up…" : "What do you want to know?"
              }
              disabled={isStreaming}
              rows={4}
              className="w-full bg-transparent border border-line rounded-lg p-4 text-sm leading-relaxed resize-none focus:outline-none focus:border-signal placeholder:text-ink-muted/50 transition-colors disabled:opacity-60"
            />

            <div className="flex items-center gap-4 flex-wrap">
              <button
                id="ask-button"
                onClick={handleSubmit}
                disabled={isStreaming || !question.trim()}
                className="font-mono text-[11px] tracking-[0.12em] uppercase bg-ink text-paper px-5 py-2.5 rounded-md hover:bg-signal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isStreaming ? "Reading…" : "Ask"}
              </button>

              <div className="flex items-center border border-line rounded-full overflow-hidden">
                <button
                  onClick={() => setRetrievalMode("semantic")}
                  disabled={isStreaming}
                  className={`font-mono text-[10px] px-3 py-1 transition-colors disabled:cursor-not-allowed ${
                    retrievalMode === "semantic"
                      ? "bg-signal text-paper"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Semantic
                </button>
                <button
                  onClick={() => setRetrievalMode("hybrid")}
                  disabled={isStreaming}
                  className={`font-mono text-[10px] px-3 py-1 transition-colors disabled:cursor-not-allowed ${
                    retrievalMode === "hybrid"
                      ? "bg-signal text-paper"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Hybrid
                </button>
              </div>

              <span className="font-mono text-[11px] text-ink-muted">
                {isStreaming ? "" : "⌘ Return to submit"}
              </span>
            </div>

            {queryError && (
              <div className="flex items-center gap-3">
                <p className="font-mono text-[11px] text-red-700" role="alert">
                  {queryError}
                </p>
                <button
                  onClick={handleSubmit}
                  className="font-mono text-[11px] text-ink-muted hover:text-ink transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </section>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <footer className="border-t border-line pt-6">
            <p className="font-mono text-[10px] text-ink-muted/50 tracking-wide">
              ContextQuery · grounded document Q&amp;A
            </p>
          </footer>

        </div>
      </div>
    </main>
  );
}
