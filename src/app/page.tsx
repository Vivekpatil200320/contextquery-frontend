"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Source {
  filename: string;
  chunk_index: number;
}

interface IngestedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

export default function Home() {
  // --- Upload state ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [ingestedDocs, setIngestedDocs] = useState<IngestedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Query state ---
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Fetch existing documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const res = await fetch("http://localhost:8000/api/documents");
      const data = await res.json();
      setIngestedDocs(
        data.documents.map((d: any) => ({
          documentId: d.document_id,
          filename: d.filename,
          chunkCount: d.chunk_count,
        }))
      );
    } catch {
      // silent fail on initial load — backend may not be up yet
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await fetch(`http://localhost:8000/api/documents/${documentId}`, {
        method: "DELETE",
      });
      setIngestedDocs((prev) => prev.filter((d) => d.documentId !== documentId));
    } catch {
      setUploadError("Failed to delete document");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".pdf") && !ext.endsWith(".docx")) {
      setUploadError("Only PDF and DOCX files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setIngestedDocs((prev) => [
        ...prev,
        { documentId: data.document_id, filename: data.filename, chunkCount: data.chunk_count },
      ]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!question.trim() || isStreaming) return;

    setAnswer("");
    setSources([]);
    setQueryError("");
    setIsStreaming(true);

    try {
      const response = await fetch("http://localhost:8000/api/query/stream", {
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
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "sources") {
              setSources(event.data);
            } else if (event.type === "token") {
              setAnswer((prev) => prev + event.data);
            } else if (event.type === "done") {
              setIsStreaming(false);
            }
          } catch {
            // skip partial JSON at chunk boundaries
          }
        }
      }
    } catch {
      setQueryError("Something went wrong. Is the backend running on port 8000?");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">ContextQuery</h1>
        <p className="text-sm text-gray-500">
          Upload documents, then ask questions grounded in them.
        </p>
      </div>

      {/* Upload section */}
      <div className="border rounded-md p-4 space-y-3">
        <p className="text-sm font-medium">Upload a document</p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="text-sm"
          />
          {isUploading && <span className="text-xs text-gray-500">Uploading...</span>}
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

        {ingestedDocs.length > 0 && (
          <div className="pt-2 space-y-1">
            <p className="text-xs font-medium text-gray-500">Ingested documents</p>
            {ingestedDocs.map((doc) => (
              <div key={doc.documentId} className="flex items-center justify-between text-xs text-gray-400">
                <span>{doc.filename} — {doc.chunkCount} chunks</span>
                <button
                  onClick={() => handleDelete(doc.documentId)}
                  className="text-red-400 hover:text-red-600 ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query section */}
      <div className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something about your uploaded documents..."
          className="w-full border rounded-md p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-black"
          disabled={isStreaming}
        />
        <Button onClick={handleSubmit} disabled={isStreaming || !question.trim()}>
          {isStreaming ? "Thinking..." : "Ask"}
        </Button>
      </div>

      {queryError && <p className="text-sm text-red-500">{queryError}</p>}

      {answer && (
        <div className="border rounded-md p-4 space-y-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>

          {sources.length > 0 && (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-medium text-gray-500">Sources</p>
              {sources.map((s, i) => (
                <p key={i} className="text-xs text-gray-400">
                  {s.filename} — chunk {s.chunk_index}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}