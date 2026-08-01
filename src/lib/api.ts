export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Source {
  filename: string;
  chunk_index: number;
  text?: string;
  verified?: string | null;
  status?: string | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status}`);
  }
  return response.json();
}

export function listConversations(): Promise<{ conversations: Conversation[] }> {
  return request("/api/conversations");
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return request(`/api/conversations/${id}`);
}

export function createConversation(): Promise<Conversation> {
  return request("/api/conversations", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function renameConversation(id: string, title: string): Promise<Conversation> {
  return request(`/api/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(id: string): Promise<{ status: string }> {
  return request(`/api/conversations/${id}`, { method: "DELETE" });
}
