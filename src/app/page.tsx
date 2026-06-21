"use client";

import { useState, useRef, useEffect, useCallback, useTransition, memo } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_FILE_SIZE_MB = 20;

interface Source {
  filename: string;
  chunk_index: number;
  text?: string;
}

interface IngestedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
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
        id={`citation-${index}`}
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
          {source.text ? (
            <p className="font-mono text-[11px] text-ink leading-relaxed">
              {source.text}
              {source.text.length >= 200 ? "…" : ""}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-ink-muted italic">
              Snippet not available — add text to the sources payload.
            </p>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Upload pulse indicator ───────────────────────────────────────────────────

function UploadSpinner() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-signal">
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-60" />
        <span className="relative inline-flex rounded-full size-2 bg-signal" />
      </span>
      Processing…
    </span>
  );
}

// ─── Answer Panel (isolated so streaming re-renders don't hit the textarea) ──

const AnswerPanel = memo(function AnswerPanel({
  answer,
  isStreaming,
  sources,
}: {
  answer: string;
  isStreaming: boolean;
  sources: Source[];
}) {
  if (!answer && !isStreaming) return null;

  return (
    <section
      className="space-y-6 border-t border-line pt-10"
      aria-live="polite"
      aria-label="Answer"
    >
      {/* Streaming cursor */}
      <p className="text-[15px] leading-[1.75] whitespace-pre-wrap">
        {answer}
        {isStreaming && (
          <span className="inline-block w-[2px] h-[1em] bg-ink-muted ml-0.5 align-middle animate-pulse" />
        )}
      </p>

      {/* Citation tabs */}
      {sources.length > 0 && (
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
      )}
    </section>
  );
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [ingestedDocs, setIngestedDocs] = useState<IngestedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Low-priority transition for per-token answer updates — keeps input responsive
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetchDocuments();
  }, []);

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setUploadError("Only PDF and DOCX files are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is ${MAX_FILE_SIZE_MB} MB.`
      );
      return;
    }

    setIsUploading(true);
    setUploadError("");

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
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await fetch(`${API_BASE}/api/documents/${documentId}`, {
        method: "DELETE",
      });
      setIngestedDocs((prev) => prev.filter((d) => d.documentId !== documentId));
    } catch {
      setUploadError("Failed to remove document.");
    }
  }

  // Stable reference — won't cause textarea to remount/rerender unnecessarily
  const handleSubmit = useCallback(async () => {
    if (!question.trim() || isStreaming) return;

    setAnswer("");
    setSources([]);
    setQueryError("");
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
              setSources(event.data);
            } else if (event.type === "token") {
              // Wrap in startTransition so token appends are low-priority
              // and yield to any pending user input (keystrokes, clicks)
              startTransition(() => {
                setAnswer((prev) => prev + event.data);
              });
            } else if (event.type === "done") {
              setIsStreaming(false);
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
  }, [question, isStreaming, startTransition]);

  // Stable reference — avoids textarea getting a new onKeyDown prop every render
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-14">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="space-y-4 border-b border-line pb-10">
          <p className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase">
            Document intelligence
          </p>
          <h1 className="font-display text-[2.6rem] font-medium leading-[1.1] tracking-tight">
            Ask your documents.
          </h1>
          <p className="text-sm text-ink-muted max-w-sm leading-relaxed">
            Every answer is traced to the exact passage it came from —
            nothing else.
          </p>
        </header>

        {/* ── Intake / Upload ───────────────────────────────────────────────── */}
        <section className="space-y-4" aria-labelledby="intake-heading">
          <h2
            id="intake-heading"
            className="font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase"
          >
            Intake
          </h2>

          <div className="border border-dashed border-line rounded-lg p-5 space-y-4 transition-colors hover:border-ink-muted">
            {/* File input row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="text-sm font-mono text-ink-muted file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-line file:bg-signal-soft file:text-signal file:font-mono file:text-xs file:cursor-pointer hover:file:border-signal transition-colors disabled:opacity-50"
              />
              <span className="font-mono text-[11px] text-ink-muted shrink-0">
                PDF or DOCX · up to {MAX_FILE_SIZE_MB} MB
              </span>
            </div>

            {isUploading && <UploadSpinner />}

            {uploadError && (
              <p className="font-mono text-[11px] text-red-700" role="alert">
                {uploadError}
              </p>
            )}

            {/* Ingested doc list */}
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
                      id={`remove-${doc.documentId}`}
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

        {/* ── Inquiry / Query ───────────────────────────────────────────────── */}
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
            placeholder="What do you want to know?"
            disabled={isStreaming}
            rows={4}
            className="w-full bg-transparent border border-line rounded-lg p-4 text-sm leading-relaxed resize-none focus:outline-none focus:border-signal placeholder:text-ink-muted/50 transition-colors disabled:opacity-60"
          />

          <div className="flex items-center gap-4">
            <button
              id="ask-button"
              onClick={handleSubmit}
              disabled={isStreaming || !question.trim()}
              className="font-mono text-[11px] tracking-[0.12em] uppercase bg-ink text-paper px-5 py-2.5 rounded-md hover:bg-signal transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStreaming ? "Reading…" : "Ask"}
            </button>
            <span className="font-mono text-[11px] text-ink-muted">
              {isStreaming ? "" : "⌘ Return to submit"}
            </span>
          </div>

          {queryError && (
            <p className="font-mono text-[11px] text-red-700" role="alert">
              {queryError}
            </p>
          )}
        </section>

        {/* ── Answer (isolated component — streaming updates won't re-render textarea) */}
        <AnswerPanel answer={answer} isStreaming={isStreaming} sources={sources} />

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-line pt-6">
          <p className="font-mono text-[10px] text-ink-muted/50 tracking-wide">
            ContextQuery · grounded document Q&A
          </p>
        </footer>

      </div>
    </main>
  );
}