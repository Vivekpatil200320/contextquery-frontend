# ContextQuery — Frontend

Next.js interface for ContextQuery — upload documents, ask questions, get grounded answers with traceable citations.

**Live:** [contextquery-frontend.vercel.app](https://contextquery-frontend.vercel.app)
**Backend repo + full architecture writeup:** [contextquery-backend](https://github.com/vivekpatil200320/contextquery-backend)

---

## Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- shadcn/ui
- Server-Sent Events for streaming answers, consumed via `fetch` + `ReadableStream`

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
