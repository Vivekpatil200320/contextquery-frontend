# ContextQuery — Frontend

Next.js interface for ContextQuery — upload documents, ask questions, get grounded answers with traceable citations, inside persisted, named conversations.

**Live:** [contextquery-frontend.vercel.app](https://contextquery-frontend.vercel.app)
**Backend repo + full architecture writeup:** [contextquery-backend](https://github.com/vivekpatil200320/contextquery-backend)

---

## Stack

- Next.js 15/16 (App Router)
- Tailwind CSS v4
- shadcn/ui
- Server-Sent Events for streaming answers, consumed via `fetch` + `ReadableStream`

## Features

- **Persisted conversations** — a sidebar lists saved threads (backed by the backend's Supabase-persisted conversation history), with a "New chat" button, inline rename, and delete. Follow-up questions resolve against the active conversation's prior turns instead of starting from scratch each time.
- **Traceable citations** — every answer's "Sources" section renders numbered index-card tabs; clicking one reveals the literal source passage it came from, inline. Citations also surface OKF trust signals (`status`, `verified`) when a source carries them.
- **Responsive layout** — the conversation sidebar is a static column on desktop and an off-canvas drawer (toggled via a "Chats" button, dismissible by tapping the backdrop) below the `md` breakpoint, so the app is fully usable on phone-width screens.

## Design

The interface is built around the product's one real differentiator: every answer is traceable to its exact source. Citations render as numbered index-card tabs — clicking one reveals the literal source passage it came from, inline. The visual language (mono metadata, serif headline, paper/ink/signal palette) is meant to feel like a precision research tool rather than a generic chat UI.

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

Requires the [backend](https://github.com/vivekpatil200320/contextquery-backend) running locally or `NEXT_PUBLIC_API_URL` pointed at a deployed instance.

## Deployment

Deployed on Vercel. The only required environment variable is `NEXT_PUBLIC_API_URL`, pointed at the live backend.

## License

MIT
