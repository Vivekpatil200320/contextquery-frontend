# ContextQuery — Frontend

![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)

Next.js interface for ContextQuery — upload documents, ask questions, get grounded answers with traceable citations, inside persisted, named conversations that survive a refresh.

**Live:** [contextquery-frontend.vercel.app](https://contextquery-frontend.vercel.app)
**Backend repo + full architecture writeup:** [contextquery-backend](https://github.com/vivekpatil200320/contextquery-backend)

---

## Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS v4, shadcn/ui scaffolding
- No external state library — everything is `useState`/`useRef` inside a single page component
- Server-Sent Events for streaming answers, consumed via `fetch` + a manually-parsed `ReadableStream`

## Features

- **Persisted conversations** — a sidebar lists saved threads (backed by the backend's Supabase-persisted conversation history), with a "New chat" button, inline rename (double-click a title), and delete (with an inline yes/no confirmation, not a browser `confirm()` dialog). Follow-up questions resolve against the active conversation's prior turns instead of starting from scratch every time. Selecting a conversation replays its full message history — including each message's original citations.
- **Traceable citations** — every answer's "Sources" section renders numbered index-card tabs; clicking one expands it to show the filename, chunk index, and the literal passage the answer drew from. Citations also surface OKF trust signals (`status`, `verified`) when a source carries them, so a reader can see at a glance whether an answer leaned on a draft or unverified document.
- **Responsive layout** — the conversation sidebar is a static column on desktop and an off-canvas drawer below the `md` breakpoint: hidden by default, opened via a "☰ Chats" toggle, closable by tapping its own × button or the dimmed backdrop behind it. The per-conversation delete control (hover-revealed on desktop) is always visible on mobile, since there's no hover state on a touchscreen.
- **Streaming answers** — tokens render as they arrive over SSE rather than waiting for the full answer; retrieval stats (chunks retrieved vs. used, mode, latency) surface once the stream completes.
- **Retrieval mode toggle** — switch between semantic-only and hybrid (BM25 + semantic) retrieval per-question, mirroring the backend's `RETRIEVAL_MODE` switch.
- **Drag-and-drop document upload** with inline progress for multi-file batches, and a document list showing per-file chunk counts.

## Design

The interface is built around the product's one real differentiator: every answer is traceable to its exact source. Citations render as numbered index-card tabs — clicking one reveals the literal source passage it came from, inline. The visual language (mono metadata, serif headline, paper/ink/signal palette) is meant to feel like a precision research tool rather than a generic chat UI.

## Talking to the backend

[`src/lib/api.ts`](src/lib/api.ts) is a thin wrapper around the backend's `/api/conversations*` endpoints (`listConversations`, `getConversation`, `createConversation`, `renameConversation`, `deleteConversation`) — no fetch client library, just a small typed `request<T>` helper. Document upload and the query/streaming flow call the backend directly with plain `fetch` inside [`src/app/page.tsx`](src/app/page.tsx): `POST /api/ingest` (multipart, one or more files), `POST /api/query/stream` (SSE, parsed manually via `response.body.getReader()` — no EventSource, since it doesn't support POST bodies).

## Local development

```bash
git clone https://github.com/vivekpatil200320/contextquery-frontend.git
cd contextquery-frontend
npm install
```

`.env.local` (optional — defaults to `localhost:8000` if unset):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Requires the [backend](https://github.com/vivekpatil200320/contextquery-backend) running locally (including its Supabase env vars, for conversation persistence) or `NEXT_PUBLIC_API_URL` pointed at a deployed instance.

## Deployment

Deployed on Vercel. The only required environment variable is `NEXT_PUBLIC_API_URL`, pointed at the live backend.

## License

MIT
