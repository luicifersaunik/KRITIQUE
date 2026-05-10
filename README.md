# Kritique — AI-Powered Code Review Platform

> Submit code. Get a real-time, structured AI review. Streamed token-by-token.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                       │
│   Monaco Editor → POST /api/reviews → SSE /api/stream/:id  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP
┌───────────────────────────▼─────────────────────────────────┐
│                   BACKEND (Express.js)                      │
│   Auth (JWT) · Reviews API · SSE endpoint (Redis sub)       │
└───────────┬──────────────────────────────┬──────────────────┘
            │ Bull Queue (Redis)            │ Redis Pub/Sub
┌───────────▼────────────┐    ┌────────────▼─────────────────┐
│    WORKER (Node.js)    │    │      REDIS (pub/sub + queue) │
│  Gemini 1.5 Flash API  │───▶│  Streams tokens to SSE       │
│  Prompt Engineering    │    └──────────────────────────────┘
└───────────┬────────────┘
            │ Prisma ORM
┌───────────▼────────────┐
│   PostgreSQL           │
│   Users · Reviews      │
└────────────────────────┘
```

**Flow:**
1. User submits code → `POST /api/reviews` creates a DB record + pushes Bull job
2. Worker picks up job → builds structured prompt → calls Gemini API
3. Gemini streams tokens → Worker publishes each chunk to Redis pub/sub channel
4. Backend SSE route subscribes to Redis channel → pushes chunks to browser
5. React `useSSE` hook accumulates tokens → renders live via `react-markdown`
6. On completion, full result saved to PostgreSQL

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Monaco Editor, React Markdown |
| Backend | Node.js, Express.js, Bull (job queue), JWT, Zod validation |
| Worker | Node.js, `@google/generative-ai` (Gemini 1.5 Flash) |
| Streaming | Server-Sent Events (SSE) + Redis Pub/Sub |
| Database | PostgreSQL + Prisma ORM |
| Queue | Bull + Redis |
| DevOps | Docker, Docker Compose |

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/kritique.git
cd kritique

cp .env.example .env
```

Edit `.env` — fill in your `GEMINI_API_KEY` and set a strong `JWT_SECRET`.

### 2. Run database migrations

```bash
# Start only postgres first
docker compose up postgres -d

# Run migrations from backend
cd backend
npm install
DATABASE_URL="postgresql://kritique:kritique_secret@localhost:5432/kritique_db" npx prisma migrate dev --name init --schema src/prisma/schema.prisma

cd ..
```

### 3. Start everything

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Key Features

- **Real-time streaming** — AI review appears word-by-word via SSE, no waiting for full response
- **Async job queue** — Bull + Redis decouples API from AI inference, handles failures with retry
- **Prompt engineering module** — Structured, consistent reviews with severity levels and scoring
- **Rate limiting** — Per-IP API limit + per-user review limit (20/hour) to control AI costs
- **Auth** — JWT-based authentication with 7-day tokens
- **Review history** — All reviews persisted to PostgreSQL, accessible anytime
- **10 languages** — JS, TS, Python, Java, Go, Rust, C++, C, C#, Ruby

---

## Project Structure

```
kritique/
├── backend/
│   └── src/
│       ├── index.js          # Express app entry
│       ├── routes/
│       │   ├── auth.js       # Register, login, /me
│       │   ├── reviews.js    # CRUD + job dispatch
│       │   └── stream.js     # SSE endpoint
│       ├── middleware/
│       │   ├── auth.js       # JWT verify
│       │   ├── rateLimiter.js
│       │   └── errorHandler.js
│       ├── lib/
│       │   ├── queue.js      # Bull + Redis setup
│       │   └── prisma.js     # Prisma singleton
│       └── prisma/
│           └── schema.prisma
├── worker/
│   └── src/
│       ├── index.js          # Bull consumer + Gemini + Redis pub
│       └── prompt.js         # Prompt engineering module
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── hooks/useSSE.js   # SSE client hook
│       ├── lib/
│       │   ├── api.js        # Axios + JWT interceptor
│       │   └── AuthContext.jsx
│       └── pages/
│           ├── AuthPage.jsx
│           ├── Dashboard.jsx
│           ├── NewReview.jsx
│           └── ReviewPage.jsx
├── docker-compose.yml
└── .env.example
```

---

## License

MIT
