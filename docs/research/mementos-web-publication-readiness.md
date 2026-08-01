# Mementos web-publication readiness

## Bottom line

The repository already contains a usable web application. Publishing it is primarily a deployment and product-boundary problem, not a frontend rewrite.

- **Private/demo launch:** feasible with one persistent Linux host and Docker Compose: Next.js, the FastAPI sidecar, Qdrant, and a TLS reverse proxy.
- **Public self-serve launch:** requires authentication, ownership checks, tenant isolation, abuse limits, URL/file validation, durable storage, and an explicit decision about who pays for OpenAI/Tavily usage.
- **Do not start with a static host or a Vercel-only deployment.** The API routes, SSE streams, local embedding model, Qdrant, and file-backed LightRAG state all require server-side runtime services.

The smallest defensible launch is one authenticated user/workspace per account on one host, with a single sidecar worker and persistent volumes. Scale the storage architecture only after usage proves it necessary.

## What the repository currently is

| Area | Current implementation | Publication implication |
|---|---|---|
| UI | Next.js 16 App Router in `app/` | Already a website; `npm run build` and `npm run lint` pass. |
| API layer | Next route handlers under `app/app/api/` | Must run as a Node server or compatible server platform; static export is not sufficient. |
| Research | FastAPI `/research/stream` → LangGraph → OpenAI-compatible LLM + Tavily SSE | Needs a long-lived Python service, server-side secrets, timeouts, and streaming-aware proxying. |
| Knowledge base | Next.js calls Qdrant directly for vectors and proxies chat/ingest work to FastAPI | Qdrant must be private/reachable from the app; all service URLs need deployment configuration. |
| Embeddings | `@huggingface/transformers` in Next.js plus `sentence-transformers` in FastAPI | Two model runtimes are loaded. First-use model downloads/cold starts need persistent cache or a deliberate move to one service. |
| Graph/RAG state | LightRAG uses JSON/GraphML files under `sidecar/data/` and Qdrant for vectors | Files must live on durable storage. Keep one sidecar writer initially; do not scale it horizontally yet. |
| External services | OpenAI-compatible LLM, Tavily, Hugging Face model downloads, Qdrant | Keys and outbound network access must be provisioned. Decide whether the operator or users pay. |
| Authentication | None | Current app is effectively an anonymous shared instance. It is not safe for unrelated users. |
| Authorization | Collection names are client-controlled; `/api/collections` lists all Qdrant collections | A user can select or mutate another user's collection unless ownership checks are added. |
| Abuse controls | No application rate limit, quota, or usage budget | Public endpoints can spend the operator's LLM/search budget and consume storage. |

## Recommended first deployment

```text
Internet
   │ HTTPS
   ▼
Caddy/Nginx ──► Next.js :3000
                 ├──► FastAPI sidecar :8000
                 └──► Qdrant :6333

Persistent volumes:
  sidecar/data        LightRAG JSON/GraphML state
  qdrant_storage      vectors and payloads
  model cache         Transformers.js / sentence-transformers downloads
```

Only the reverse proxy should be public. Qdrant and the sidecar should be on the private Docker network. Next.js can proxy browser requests to the sidecar, preserving one browser origin and avoiding public CORS/API-key exposure.

This matches the repository's current shape and avoids prematurely introducing Kubernetes, a queue, a separate frontend, or several managed databases.

## Minimum work before a private/demo launch

1. **Containerize the three runtime services.**
   - Add production Dockerfiles for `app/` and `sidecar/`.
   - Replace the development-only `start.sh` behavior (`pip install` and `npm install` on every start) with immutable images.
   - Add a production Compose file with health checks, restart policies, persistent volumes, and a pinned Qdrant version instead of `qdrant/qdrant:latest`.

2. **Remove deployment-host assumptions.**
   Centralize service URLs and use environment variables everywhere. The following currently hardcode loopback addresses:
   - `app/lib/index-collection-document.ts`
   - `app/app/api/rag/query/route.ts`
   - `app/app/api/collections/[collection]/stats/route.ts`
   - `app/app/api/collections/[collection]/lightrag-backfill/route.ts`
   - `sidecar/dump_graph.py`

   Use values such as `SIDECAR_URL=http://sidecar:8000` and `QDRANT_URL=http://qdrant:6333` inside Compose. Add `QDRANT_API_KEY` support to both clients if Qdrant is authenticated. The existing `start.sh` is a local launcher, not a production supervisor.

3. **Add TLS and proxy configuration.**
   Configure the reverse proxy for:
   - HTTPS and HTTP-to-HTTPS redirect;
   - request body limits for uploads;
   - long read/connect timeouts for research and chat;
   - disabled response buffering/compression on SSE paths.

   Next.js explicitly recommends a reverse proxy for self-hosting and requires end-to-end streaming support; the application already emits `X-Accel-Buffering: no` on its streams.

4. **Persist and back up data.**
   Mount `sidecar/data` and Qdrant storage to durable disks. Back up both; backing up only Qdrant loses LightRAG's graph/KV/doc-status state. Test restoration before accepting real notes.

5. **Make readiness meaningful.**
   `/health` currently returns `{ "status": "ok" }` without checking Qdrant, model readiness, or LLM availability. Add a separate readiness check for deployment health checks, while retaining a cheap liveness endpoint.

## Minimum work before strangers can use it

### 1. Identity and ownership

Add login/session identity and an ownership table or equivalent. Every request must derive the account from the session, not from a client-supplied collection name.

At minimum:

- create a private workspace/collection for the account;
- list only owned workspaces;
- verify ownership on ingest, search, chat, stats, backfill, and research import;
- remove or redesign the shared `default` collection and the sidecar `/query` path, which currently defaults to the global corpus;
- keep sidecar and Qdrant credentials server-side.

For a beta, an existing hosted auth provider is less code than inventing password storage, email verification, password reset, and session rotation. For a private single-user deployment, basic access protection can be enough; it is not a multi-user product boundary.

### 2. Tenant isolation

The current design uses a separate Qdrant collection per named workspace and separate LightRAG workspaces, but the API does not enforce who may use a name. Fix authorization first.

If the service grows beyond a small number of users, consolidate vectors into shared Qdrant collections with a mandatory tenant payload/filter. Qdrant's own multitenancy guidance recommends payload-based partitioning for most shared deployments and warns that many collections create resource overhead. LightRAG's workspace support can remain the logical boundary, but file-backed per-user state eventually needs a database-backed storage strategy.

### 3. Abuse and cost controls

Before opening registration:

- rate-limit research, chat, ingest, and collection creation per account/IP;
- cap query length, file size, source count, source response size, and concurrent jobs;
- set per-account storage and LLM/search budgets;
- reject or queue work when the sidecar is busy;
- log request IDs, latency, token/cost estimates, and failures without logging document contents or secrets.

The current code has useful validation for collection names, chat history, and some text requests, but it does not establish a public-service budget.

### 4. Server-side fetch safety

`app/app/api/research/ingest/route.ts` fetches client-supplied URLs, first through Tavily when configured and otherwise directly. Before public use, validate `https` URLs, restrict redirects and response sizes, enforce content types/timeouts, and block loopback, link-local, private, and cloud metadata addresses. Otherwise the import endpoint is an SSRF and resource-exhaustion surface.

### 5. Content and privacy policy

Users will send private notes to the service and those notes may be sent to the configured LLM during indexing/querying. Publish a short privacy/data-retention statement, explain third-party processing, and provide deletion/export before positioning it as a personal knowledge-base service.

## Storage and scaling boundary

The current LightRAG setup is appropriate for a small, single-host launch:

- `NetworkXStorage` writes GraphML files;
- JSON KV/doc-status files live under the LightRAG working directory;
- Qdrant is an external vector store;
- the sidecar registry and backfill job state are process-local.

That implies one sidecar process/worker is the safe starting point. Multiple workers or replicas can have independent in-memory registries and competing file-backed writers. If concurrent public traffic makes this a bottleneck, migrate LightRAG KV/doc-status/graph storage to supported shared backends and introduce a job queue before adding replicas. Do not solve it by merely increasing Uvicorn workers.

The two embedding implementations also deserve one later cleanup. They both target 384-dimensional MiniLM vectors, but they use different runtimes and caches. Keeping them is acceptable for the first launch if retrieval quality is verified; moving embedding generation behind one service reduces memory, cold-start, and model-version drift.

## Hosting choices

### Recommended: one Docker host

Best fit for the current code. It provides private service networking, persistent disks, predictable SSE behavior, and one place to run the Python model. It is the shortest path to a real URL.

### Split hosting: Next.js platform + separate API/database

Possible, but not the first move. It requires fixing every loopback URL, hosting the sidecar elsewhere, using Qdrant Cloud or a private Qdrant service, and validating serverless function limits for the SSE and local Transformers.js model. It creates more failure modes without removing the need for auth and storage work.

Vercel supports Next.js Node/Docker deployments and configurable function durations, but a function can still be terminated at its maximum duration and long idle HTTP/1.1 streams need heartbeat/proxy care. The current 90-second research deadline is within common limits, but the local model cache and external FastAPI dependency make a single host simpler.

### Static hosting

Not viable for the full app. Static export cannot provide the route handlers, Qdrant access, FastAPI proxying, or SSE behavior. It could host a landing page, not Mementos itself.

## Suggested delivery order

1. **Deployment skeleton:** Dockerfiles, Compose, env-driven URLs, private network, TLS, volumes, backup/restore.
2. **Single-user smoke launch:** run a real ingest → research → import → RAG chat flow from a public domain.
3. **Public safety:** auth, ownership checks, request limits, URL/file validation, Qdrant security, readiness checks.
4. **Beta UX:** onboarding creates a first private collection; add delete/export and clear service/privacy copy.
5. **Scale only when measured:** shared tenant filtering, database-backed LightRAG storage, background jobs, replicas, billing/usage metering.

## Verification baseline from this checkout

- `cd app && npm run lint`: passes.
- `cd app && npm run build`: passes, but build-time Qdrant client calls logged “Failed to obtain server version” because the local Qdrant service was unavailable; the routes still compiled.
- `sidecar/venv/bin/pytest -q`: 69 passed, 1 failed, 1 collection error. The failure is a stale `/insert` test that omits the now-required collection; the collection error is a helper named `test` being collected as a pytest test. This is not a hosting blocker, but it should be green before using CI as the deployment gate.

## Primary sources consulted

- [Next.js: Deploying](https://nextjs.org/docs/app/getting-started/deploying) — Node.js/Docker support and static-export limitations.
- [Next.js: Self-hosting](https://nextjs.org/docs/app/guides/self-hosting) — reverse proxy, persistent cache, streaming, and multi-instance considerations.
- [Vercel: Function duration](https://vercel.com/docs/functions/configuring-functions/duration) — maximum execution duration and streaming constraints.
- [Hugging Face Transformers.js: Node.js](https://huggingface.co/docs/transformers.js/en/tutorials/node) — server-side inference, lazy model loading, and filesystem model caching.
- [Qdrant: Production checklist](https://qdrant.tech/documentation/production-checklist/) — authentication, TLS, private binding, storage, and production readiness.
- [Qdrant: Securing a self-hosted instance](https://qdrant.tech/documentation/tutorials-operations/secure-qdrant/) — self-hosted defaults, API keys, TLS, and read-only keys.
- [Qdrant: Multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/) — payload partitioning versus many collections.
- [LightRAG: Programming with Core](https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md) — persisted working directories, initialization, and storage backend choices.
- [LightRAG: API Server](https://github.com/HKUDS/LightRAG/blob/main/docs/LightRAG-API-Server.md) — deployment, storage, workspace, and reverse-proxy guidance.
