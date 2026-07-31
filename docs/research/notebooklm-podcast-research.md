# NotebookLM-style source-grounded podcast research

- **Status:** Research only; no application code was changed.
- **Access date:** 2026-07-31
**Research method:** Web discovery was performed with Tavily and the findings were checked against the linked first-party documentation, API references, specifications, and repository code. Provider prices and quotas are volatile; the values below are a dated snapshot, not a contract.

## Executive recommendation

A NotebookLM-style Audio Overview is not just a text-to-speech button. It is a persisted, source-versioned artifact pipeline:

1. freeze the selected source set and provenance;
2. retrieve evidence from the collection;
3. write a structured, multi-turn script whose factual turns carry source/chunk references;
4. reject or revise unsupported turns;
5. synthesize the validated script in bounded audio chunks;
6. store the audio, transcript, source map, settings, provider/model, and generation status;
7. let the UI play, seek, download, and inspect the transcript/citations after the browser disconnects.

**Recommended MVP:** generate from already-indexed sources in one selected collection, not directly from uncommitted web-search results. Start with a short two-host overview and a `brief`/`deep_dive` choice, with a hard output cap and segment-level citations. Defer interactive mode, public sharing, voice cloning, music, debate/adversarial mode, and exact word-level audio citations. A single bite-sized vertical slice is the safest first validation if the team wants the smallest possible scope.

**Provider recommendation:** keep the existing OpenAI-compatible model path for script generation, but use Gemini Flash TTS for the first two-host experiment if NotebookLM-like dialogue and style control are the priority. Gemini documents native two-speaker TTS, promptable style/pace/tone, and PCM output, but its TTS models are preview and longer output needs chunking. If adding a second provider is unacceptable, OpenAI TTS is the lowest-friction fallback because the repository already has OpenAI-compatible credentials and it supports MP3/Opus/AAC/WAV/PCM; it requires per-turn voice synthesis and assembly rather than native dialogue. ElevenLabs is the strongest specialized dialogue alternative, with a native Text-to-Dialogue endpoint and timestamps, but has a practical 2,000-character dialogue request size and separate retention/concurrency considerations.

## Current repository baseline

The repository is a single-user Mementos application with a Next.js frontend, a FastAPI sidecar, Qdrant, local embeddings, and LightRAG. The existing design documentation explicitly calls the current workflow ephemeral and leaves authentication, saved sessions, and multi-user behavior out of scope ([`docs/deep-research-design-overhaul-spec.md`](../deep-research-design-overhaul-spec.md), [`docs/knowledge-base-design-overhaul-spec.md`](../knowledge-base-design-overhaul-spec.md)). An audio artifact would be the first feature that needs durable output and a lifecycle beyond the browser session.

| Area | What exists | Consequence for Audio Overview |
| --- | --- | --- |
| Manual ingestion | [`app/app/api/ingest/route.ts`](../../app/app/api/ingest/route.ts) accepts TXT/Markdown, validates the file, and sends text to the shared indexer. | An MVP can stay inside the existing text corpus. NotebookLM-like PDF, audio, YouTube, Drive, and DOCX parity is a separate ingestion project, not a prerequisite. |
| Research ingestion | [`app/app/api/research/ingest/route.ts`](../../app/app/api/research/ingest/route.ts) fetches Tavily `extract` content when available, falls back to direct HTML stripping, and imports selected URLs sequentially. | The source is fetched at import time rather than frozen at discovery time. Store a content hash and retrieved snapshot before generating a script, otherwise a changed URL can invalidate citations. |
| Vector index | [`app/lib/index-collection-document.ts`](../../app/lib/index-collection-document.ts) splits text into 500-character chunks with 50-character overlap, embeds with local 384-dimensional MiniLM, and stores `filename`, `chunk_index`, `char_start`, and `char_end` in Qdrant. | This is a useful grounding substrate. Preserve its offsets and expose stable document/chunk IDs to the script validator instead of using only filenames or URLs. |
| Graph/RAG index | The same indexer calls the sidecar `/insert`; LightRAG uses Qdrant plus NetworkX. [`sidecar/knowledge_base.py`](../../sidecar/knowledge_base.py) requests hybrid retrieval with references and emits source IDs, paths, and 500-character snippets. | Existing RAG provenance is a good starting seam, but a podcast needs per-turn references and source passages, not only a final source list. |
| RAG UI | [`app/app/components/knowledge-base/RagChat.tsx`](../../app/app/components/knowledge-base/RagChat.tsx) consumes SSE deltas, source events, insufficient-evidence events, and numbered citations. [`CitationList.tsx`](../../app/app/components/knowledge-base/CitationList.tsx) renders source links/snippets. | Reuse the citation language for a transcript view. Add segment IDs and time ranges; do not put citations only in the player or only in a final source list. |
| Research UI | [`DeepResearch.tsx`](../../app/app/components/deep-research/DeepResearch.tsx) streams a run, lets the user select URLs, and then imports them. | The existing source-selection step is reusable, but the MVP should generate after import so source identity and content are stable. |
| Research execution | [`sidecar/research/graph.py`](../../sidecar/research/graph.py) has a three-iteration cap and a 90-second deadline; [`sidecar/main.py`](../../sidecar/main.py) exposes `/research/stream` as an SSE request tied to the running task. | Suitable for discovery, not for a multi-minute audio artifact. Audio must have a job ID and status that survive an SSE disconnect or page navigation. |
| Existing jobs | LightRAG backfill uses `_backfill_jobs` and `asyncio.create_task` in [`sidecar/main.py`](../../sidecar/main.py), with a polling route used by [`RagChat.tsx`](../../app/app/components/knowledge-base/RagChat.tsx). | Reuse the status shape and polling UX, but the in-memory dictionary loses jobs on process restart and is unsafe for multiple workers. Persist audio job metadata. |
| Storage | Qdrant has a Docker volume; LightRAG data is under ignored `sidecar/data/`. No audio endpoint, object store, job database, or audio dependency is present. | A local MVP can use a small SQLite job table plus an ignored audio directory. Production needs object storage, authorization, range requests, retention, and cleanup. |
| Text generation | [`sidecar/research/sketch.py`](../../sidecar/research/sketch.py) already uses `langchain-openai`, an OpenAI-compatible base URL, temperature 0, retries, and a JSON-shaped prompt. | Reuse the configured model path, but replace “JSON-shaped prompt” with provider-enforced structured output and add a script/evidence schema. |
| Privacy boundary | The current routes do not show authentication or per-user authorization; the design docs say single-user. | Do not add public audio links or collection sharing in the MVP. Treat every generated file as private to the current application until access control exists. |

### The main grounding gap

The current `Source` contract contains `url`, `title`, `snippet`, `score`, and optional metadata, but no immutable source version, extracted body hash, stable document ID, or chunk reference. Research ranking is based on search snippets; the selected URL is fetched later. Qdrant does retain chunk text and offsets, but the RAG chat surface reduces the returned evidence to a path and truncated snippet. This is enough for a useful chat prototype, not enough to prove that each spoken factual claim came from the selected corpus.

## What NotebookLM documents as the target behavior

The current first-party help pages use the name **Gemini Notebook**; the original NotebookLM product posts and the help pages describe the same Audio Overview family. The documented behavior is a useful product benchmark, not an API contract to copy.

### Formats, dialogue, style, and length

- **Deep Dive** is the default: two hosts unpack and connect topics from the sources in a lively conversation.
- **The Brief** is a quick overview delivered by one speaker in under two minutes.
- **The Critique** uses two hosts for constructive evaluation of material such as an essay or design document.
- **The Debate** uses two hosts for a formal back-and-forth exploring multiple perspectives.
- The generation panel supports language selection, `Shorter`, `Default`, and `Longer` length choices; the help page notes that length choices are English-only. A custom prompt can focus topics or adjust expertise level. [NLM-1]
- The original product description calls the output a reflection of the uploaded sources, not a comprehensive or objective view of the whole topic; it also warns of inaccuracies and audio glitches. [NLM-2]

**Implication:** model styles should be an explicit enum, not a free-form “make it adversarial” string. Map the requested `adversarial` idea to a constrained `critique` or `debate` policy: every criticism, counterclaim, and alleged gap must identify the supporting source or be labelled as an unresolved question. Do not let a lively host persona create unsupported “balance.” Length should be a target word budget with a hard upper bound, followed by measured duration; it cannot be promised as an exact runtime because voice pace, pauses, and provider chunking change duration.

**Repo fit:** the existing research sketch already exposes concepts, terms, patterns, preferred domains, subquestions, confidence, and gap analysis. Those are useful planning inputs, but a podcast script needs a second structured output containing turns and evidence references. No current component has a style or length state.

### Background generation and artifact lifecycle

The Audio Overview help page says generation runs in the background, so users can create other artifacts or navigate elsewhere; it may take a couple of minutes. Users can load a previous overview, inspect the custom prompt, listen while querying sources, and download the generated audio on desktop. [NLM-1]

The mobile help page documents play/pause, skip forward/back, playback speed, background playback, and offline access. It also contains an important product distinction: mobile audio can be downloaded for offline access but cannot be downloaded as a file to the device. [NLM-3] The desktop help page separately documents a Download action and share links, with sharing requiring access to the full notebook and being disabled for some Workspace Enterprise/Education cases. [NLM-1]

**Implication:** the feature needs a durable artifact record, not a request that remains open until TTS finishes:

```text
queued → scripting → validating → synthesizing → ready
                         ↘ failed / cancelled
```

The record should contain the collection/source snapshot, style, length target, language, provider/model, prompt version, progress, errors, audio object key, transcript, segment timing, and citation map. A client can poll a status endpoint or subscribe to a short-lived event stream. The browser must not be the source of truth for completion.

### Source limits and input normalization

The current source help page documents support for copied text, PDFs, DOCX, Markdown, Google files, web URLs, public YouTube URLs, images, ePub, and audio files. A source can contain up to 500,000 words or 200 MB for uploaded files; free users can include up to 50 sources. Web imports scrape HTML text only, excluding images, embedded videos, nested pages, and paywalled content. YouTube imports use only the transcript and require a public video with captions; new videos may be unavailable for 72 hours. Audio files are transcribed at import, and speechless/low-quality audio can fail. [NLM-4]

The limits page says that very short source content may be referenced as the entire document without individual text citations. [NLM-5] Plan tables list higher source and Audio Overview quotas, including 3/day on standard access, 6/day on Plus, 20/day on Pro, and higher paid/enterprise tiers; these limits are explicitly subject to change. [NLM-6]

**Implication:** source ingestion and audio generation must be separate concerns. For this repository, the MVP should use the existing TXT/Markdown/URL-to-text path and make its narrower promise explicit. If later adding PDF/audio/YouTube, retain the original media metadata and the transcript/source snapshot used for retrieval. A “source URL” alone is not evidence.

### Citations and trust

NotebookLM positions source grounding, citations, and relevant quotes as central, but also explicitly warns that generated discussions can be inaccurate. [NLM-2] The product lets a user explore quotes and citations while listening, which implies that audio needs a parallel text evidence surface rather than citations spoken into the recording. [NLM-1]

**Implication:** citations should attach to transcript segments or claims. The spoken audio can remain natural; the UI should show a timestamped transcript where each factual paragraph has clickable source references and the exact supporting snippet. For the MVP, segment-level citations are sufficient. Word-level synchronization is a later enhancement.

## Grounding and citation-fidelity design

### Provider citations are useful metadata, not a proof of correctness

OpenAI File Search returns a `file_search_call` and message annotations containing an output character index, file ID, and filename; full retrieval results are opt-in through `include: ["file_search_call.results"]`. It can limit result count and filter by file metadata. [OAI-1] Google Gemini File Search returns `file_citation` annotations, optional PDF page numbers, and custom metadata; the raw uploaded `File` is deleted after 48 hours while imported store data persists until manually deleted. [G-1] Vertex grounding metadata can associate answer character segments with supporting chunk indices and retrieved-context URIs. [G-2]

Those contracts show the shape of a good provenance model, but provider annotations do not guarantee that every sentence is supported or that a citation is the best passage. The repository already owns the source corpus and has better local identifiers available in Qdrant payloads.

### Recommended source-bound script contract

Before sending text to TTS, produce and validate a document like:

```json
{
  "style": "deep_dive",
  "length_target": "short",
  "language": "en",
  "turns": [
    {
      "id": "turn-001",
      "speaker": "host_a",
      "text": "…",
      "claim_refs": [
        {"source_id": "doc-7", "chunk_id": "chunk-19", "char_start": 420, "char_end": 812}
      ],
      "kind": "factual"
    },
    {
      "id": "turn-002",
      "speaker": "host_b",
      "text": "That leaves an open question…",
      "claim_refs": [],
      "kind": "transition_or_question"
    }
  ]
}
```

The exact schema can be smaller, but it must support:

1. immutable `source_id` and `source_version`;
2. Qdrant/LightRAG chunk or passage IDs and offsets;
3. speaker and turn order;
4. a distinction between factual claims, transitions, questions, and clearly marked speculation;
5. a refusal/insufficient-evidence outcome;
6. a prompt/model version for reproducibility.

Validation should reject a factual turn with an unknown reference, a reference to a chunk outside the frozen source version, or a script that exceeds the selected word/character budget. A second entailment check can be added later; the MVP should at least require explicit evidence references and show the evidence to the user.

### Grounding pipeline for this repository

1. **Freeze:** select a collection and source document IDs, not only URLs. Record retrieval time, canonical URL/filename, content hash, and the exact text used for generation.
2. **Retrieve:** use Qdrant chunks for local evidence and LightRAG hybrid retrieval for broader connections. Keep the existing `char_start`/`char_end` metadata.
3. **Plan:** ask the text model for a topic outline and evidence map, with a strict schema. The existing `sketch.py` retry logic is a precedent, but provider-enforced JSON is safer.
4. **Write:** generate turns only from the evidence map. Tell the model that a missing answer must become “the sources do not establish this,” not general model knowledge.
5. **Validate:** check references, source version, length, forbidden unsupported claims, and style-specific rules before spending on TTS.
6. **Synthesize:** pass only validated turn text to TTS. TTS should never be asked to decide facts or citations.
7. **Publish:** persist the transcript and source map next to the audio. Render citation links and snippets alongside the player.

The current research ingestion fetches the URL after selection and does not persist a source manifest. That is the first fidelity issue to resolve; changing models or voices will not fix citation drift.

## Provider tradeoffs

### OpenAI

**Text/script:** The Responses API is the recommended direct text-generation path. OpenAI documents Structured Outputs with JSON Schema, including schema adherence, explicit refusals, streaming, and model snapshot pinning/evaluation guidance. [OAI-2] This maps well to a turn/evidence schema and the existing OpenAI-compatible configuration in `sidecar/research/sketch.py`.

**Speech:** `gpt-4o-mini-tts` accepts text and produces audio, supports natural-language instructions for accent, emotional range, intonation, speed, tone, and whispering, and lists built-in voices that are currently optimized for English. The documented input limit is 2,000 tokens. The default is MP3; Opus, AAC, FLAC, WAV, and PCM are also supported. The speech API can stream chunks, and OpenAI recommends WAV/PCM for fastest response times. [OAI-3] OpenAI's guide requires a clear disclosure that the voice is AI-generated. [OAI-3]

**Async and grounding:** Responses background mode supports long-running text requests, polling, streaming reconnection, and cancellation. Background responses can temporarily store data for roughly ten minutes even when `store=false` in a zero-data-retention project. [OAI-4] This is useful for script generation, but the documented background API is a Responses feature; the application still needs its own job state around speech calls. OpenAI File Search provides hosted retrieval and file citations, but moving this repository's Qdrant/LightRAG corpus there would add a second source of truth. [OAI-1]

**Cost/fit:** The current OpenAI model page lists `gpt-4o-mini-tts` at $0.60 per million input text tokens and $12 per million output audio tokens; the pricing page is the authority for changes. [OAI-5] OpenAI is the least operationally surprising option for this repository because `OPENAI_API_KEY`, `OPENAI_API_BASE`, and `OPENAI_MODEL_NAME` already exist. Its weakness for a NotebookLM clone is that the speech endpoint is voice-per-request, not a native multi-speaker dialogue endpoint. Generate one turn at a time and assemble the result, or accept a one-speaker MVP.

### Gemini API and Vertex/Cloud

**Text/grounding:** Gemini supports multimodal input, streaming, system instructions, maximum output token controls, JSON response MIME types, and response schemas. Its response structures can carry citation metadata with source URI/title and byte offsets; Google File Search adds file citations, PDF page numbers, and custom metadata. [G-3] [G-1] Vertex grounding with enterprise data can associate answer segments with retrieved chunks, which is a useful model for claim-to-evidence mapping, but it introduces Google Cloud data-store/IAM setup and a separate managed corpus. [G-2]

**Speech:** Gemini TTS is explicitly designed for exact text recitation and podcast/audiobook generation rather than Live API's interactive unstructured audio. It supports single- and multi-speaker output, up to two configured speakers, promptable style/accent/pace/tone, 30 named voices, and many languages. The current examples write 24 kHz PCM into a WAV container. [G-4]

Important limits in the current TTS guide:

- TTS accepts text input and produces audio; a TTS session has a 32k-token context limit.
- Streaming is supported only by `gemini-3.1-flash-tts-preview` in the documented model set.
- Speech quality and consistency can drift for outputs longer than a few minutes; Google recommends splitting transcripts.
- The 3.1 preview can occasionally return text tokens instead of audio and may fail with a 500, so automated retry is required.

[G-4]

**Async and cost/fit:** Gemini background interactions return an ID, expose `in_progress`, `completed`, `failed`, and `cancelled` states, support polling and stream reconnection from an event ID, and support cancellation/deletion. [G-5] Gemini Batch API is 50% of standard cost with a 24-hour target turnaround, 48-hour expiry, polling, and webhooks; it is appropriate for offline pre-generation, not a user waiting at a button. [G-6]

The current Gemini pricing page lists:

- Gemini 2.5 Flash Preview TTS: $0.50 per million input text tokens and $10 per million output audio tokens;
- Gemini 3.1 Flash TTS Preview: $1 per million input text tokens and $20 per million output audio tokens;
- audio billing at 25 tokens per second.

[G-7] At those rates, ten minutes of output is approximately 15,000 audio tokens, or about $0.15 on the 2.5 Flash TTS rate or $0.30 on the 3.1 rate, before script generation, retries, storage, and egress. Actual usage should be measured from API metadata.

Gemini is the best direct match for a two-host NotebookLM-like MVP because multi-speaker TTS is native and the script can be written in the same ecosystem. The tradeoffs are preview-model stability, raw PCM/WAV handling, chunking, and a new Google credential/data policy. For a short asynchronous MVP, 2.5 Flash Preview TTS is cheaper and does not require live audio streaming; use 3.1 only when first-audio streaming is worth its preview and retry costs.

Google File Search is a plausible alternative to local RAG: indexing embeddings is billed, storage and query-time embeddings are free, and citations can carry custom metadata. It has a 100 MB per-document limit and tiered project store limits. [G-1] It should not be introduced merely to generate audio; it would duplicate Qdrant and make deletion/privacy semantics more complex.

**Cloud TTS alternative:** Chirp 3 HD in Cloud Text-to-Speech offers MP3/OGG_OPUS/PCM for batch synthesis, streaming formats including OGG_OPUS/PCM, pace control from 0.25x to 2x, and regional availability. Its published price is $30 per million characters after the free tier. [G-8] It is attractive for a Cloud/IAM/region-controlled deployment, but it is a conventional voice synthesis service rather than the direct two-host dialogue workflow documented for Gemini TTS.

### ElevenLabs

**Dialogue:** ElevenLabs v3 has a native Text-to-Dialogue API. It accepts a list of text/voice pairs, supports up to 10 unique voice IDs, and recommends keeping the total text at or below 2,000 characters per request for reliable generation; the default model is `eleven_v3`. [EL-1] The streaming dialogue-with-timestamps endpoint returns base64 audio, voice segments, and character alignment timestamps. [EL-2] This is the most direct provider contract for a podcast script with multiple hosts and a future transcript-to-audio timeline.

**Quality, chunking, and formats:** ElevenLabs documents v3 as expressive speech across 70+ languages and gives it a 5,000-character/roughly five-minute single-request TTS limit; longer content should be split. Its Flash v2.5 model is documented at roughly 75 ms model latency excluding application/network latency. [EL-3] The default output is `mp3_44100_128`; high-bitrate MP3 and 44.1 kHz PCM/WAV require higher plans. [EL-1] [EL-4]

**Privacy, cost, and fit:** The API defaults `enable_logging` to true; `enable_logging=false` activates zero-retention mode and is documented as enterprise-only. [EL-1] The public API pricing page lists Flash/Turbo at $0.05 per 1,000 characters and Multilingual v2/v3 at $0.10 per 1,000 characters, with approximate per-minute examples. [EL-5] The models page documents plan-specific concurrency and queue behavior. [EL-3] ElevenLabs is a strong quality/dialogue candidate, but it adds a credential, a 2,000-character chunking/muxing problem, provider retention decisions, and concurrency management. Its voice-cloning and safety documentation also makes clear that high-risk voice cloning is restricted and professional cloning requires verification. [EL-6]

### Provider choice summary

| Requirement | OpenAI TTS | Gemini TTS | ElevenLabs |
| --- | --- | --- | --- |
| Existing repo integration | Best: existing OpenAI-compatible text path | New API/credential | New API/credential |
| Native two-speaker artifact | No; synthesize turns separately | Yes, up to two speakers | Yes, up to ten voice IDs |
| Style control | Natural-language instructions | Natural-language directing and audio tags | Voice/settings and expressive v3 dialogue |
| Long output | 2,000 input tokens per speech request; chunk | 32k TTS context; split after a few minutes | Split; dialogue guidance at 2,000 chars/request |
| Convenient formats | MP3, Opus, AAC, FLAC, WAV, PCM | PCM/WAV examples; encode if another format is needed | MP3 default; PCM/WAV plan restrictions |
| Async documented by provider | Responses background for text; own TTS job needed | Background interactions and Batch | Request/stream APIs reviewed; own job needed |
| Best first use | Lowest integration risk or one-speaker brief | NotebookLM-like two-host MVP | Highest direct dialogue specialization |

Do not expose provider-specific voice cloning in the MVP. Use stable built-in voices, label the output as AI-generated, and record the provider/model in the artifact manifest.

## Audio formats, playback, and download

### MVP browser path

The browser can use a normal `<audio controls preload="metadata" src="…">` element. MDN documents that native controls provide volume, seeking, pause, and resume; `preload="metadata"` requests metadata without requiring the whole file, although `preload` is only a hint. `HTMLMediaElement.currentTime`, `duration`, `timeupdate`, `canplay`, `waiting`, and `ended` are enough for a basic player and progress display. [WEB-1] [WEB-2]

Serve one complete, same-origin artifact first. A conservative MVP can expose `audio/mpeg` when the selected provider returns MP3, or `audio/wav` when using Gemini PCM wrapped in a WAV header. Use `canPlayType()` and multiple `<source>` elements only if a real browser compatibility requirement appears; do not add MediaSource just to play a completed file.

### Streaming and seeking

MediaSource is the browser API for appending media segments through a `SourceBuffer`; it requires a supported MIME/codec and explicit `sourceopen`/`endOfStream` handling. [WEB-3] It is appropriate for a future “start listening while later chunks synthesize” experience, but it adds codec, buffering, reconnection, and ordering complexity. For the MVP, generate the full short artifact first and stream it progressively from storage using ordinary HTTP.

For seeking and resumable playback, the audio response should support byte ranges: accept `Range: bytes=…`, return `206 Partial Content` with `Content-Range`, `Content-Length`, and `Accept-Ranges: bytes`, plus a stable `ETag` when possible. MDN documents the range semantics, and S3 `GetObject` implements range reads and these response headers. [WEB-4] [WEB-5] Without ranges, a long file may need to be re-downloaded when the user seeks.

### Download and privacy

An `<a download>` link is simple for a same-origin API route or a `blob:` URL, but MDN notes that the attribute only works for same-origin, `blob:`, and `data:` URLs and that browser behavior varies. [WEB-6] Prefer a same-origin download endpoint that sets `Content-Disposition: attachment; filename="…"` and an inline playback endpoint that sets `Content-Disposition: inline`. If a future object-store URL is used directly, do not assume the cross-origin `download` attribute will force a download.

If the browser receives a `Blob` and creates an object URL, call `URL.revokeObjectURL()` when the component no longer needs it. [WEB-7] Do not fetch a large artifact into a Blob just to play it when a protected streaming URL is available; that doubles browser memory and delays first playback.

Spoken audio needs an accessible text alternative. MDN notes that `<audio>` does not directly support WebVTT captions and recommends a transcript/custom display (or a video element when a timed track is required). [WEB-1] The source-grounded transcript is therefore not optional polish: it is the citation surface, accessibility surface, and debugging record.

### Object storage

For production, keep artifacts private in object storage and issue short-lived authorized playback/download URLs. S3 documents that presigned URLs grant time-limited access and can be used in a browser; the URL's expiry must exceed a normal playback/download window or the player can fail mid-session. [WEB-8] S3 `GetObject` also supports range reads, content-type/content-disposition overrides, ETags, and checksums. [WEB-5]

The repository's single-user local MVP can avoid an object-store dependency: store a SQLite job row and immutable files under ignored sidecar data, expose them through an authenticated application route, and add cleanup by age. Move to S3-compatible storage when there are multiple application workers, deployment restarts, large artifacts, sharing, or a need for lifecycle policies. Do not put provider API URLs in the browser; the server should own credentials and storage authorization.

## Async jobs, cost, and latency

### Why a job is required

NotebookLM documents couple-minute generation, OpenAI documents background Responses for long-running text work, and Gemini documents background interactions specifically to avoid connection timeouts. [NLM-1] [OAI-4] [G-5] Audio generation is a pipeline with multiple external calls, retries, and potentially several chunks. A single Next.js route that waits for all of it would inherit the current research SSE timeout/disconnect problem.

Minimal job API shape:

```text
POST /api/audio-overviews
  → 202 { id, status: "queued" }
GET  /api/audio-overviews/:id
  → status, progress, error, transcript, source map, audio metadata
GET  /api/audio-overviews/:id/audio
  → range-capable inline playback
GET  /api/audio-overviews/:id/download
  → range-capable attachment download
```

A short-lived SSE endpoint can report `script_started`, `script_validated`, `chunk_started`, `chunk_completed`, `failed`, and `ready`, but status polling must remain sufficient. The existing backfill polling pattern is adequate for a single browser; the job record must be persisted before the feature is shared or deployed with more than one process.

### Idempotency and failure handling

Use an idempotency key derived from the source-version hashes, selected source IDs, style, language, length target, provider, model, and prompt version. Store provider request IDs and retry counts. A retry must not silently create a second billable artifact or overwrite a ready artifact.

Use explicit failures for:

- no usable evidence;
- invalid structured script or missing claim reference;
- provider refusal/content filter;
- quota/rate limit;
- TTS chunk failure after retry;
- audio assembly or integrity failure;
- source version deleted or changed before synthesis.

Keep successful chunks and the script for diagnosis, but do not publish an artifact as ready until the final audio and citation manifest are consistent. Add cancellation at the job level; a browser abort should stop queued work where possible, but cancellation cannot undo a provider request already billed.

### Cost model

Track actual provider usage in the job record:

```text
script input tokens + script output/reasoning tokens
+ TTS input text tokens/characters
+ TTS output audio tokens/characters
+ retries
+ storage and egress
```

Current published examples:

- OpenAI `gpt-4o-mini-tts`: $0.60/M input text tokens and $12/M output audio tokens. [OAI-5]
- Gemini 2.5 Flash Preview TTS: $0.50/M input text tokens and $10/M output audio tokens; 25 audio tokens/second. [G-7]
- ElevenLabs: $0.05/1,000 characters for Flash/Turbo and $0.10/1,000 for Multilingual v2/v3. [EL-5]
- Cloud Chirp 3 HD: $30/M characters after its listed free tier. [G-8]

The largest avoidable cost is synthesizing an unvalidated or duplicate script. Validate and deduplicate before TTS; cache artifacts by source/settings hash; expose a maximum length; and cap concurrent jobs per collection/provider.

### Latency model

- **Script generation:** one structured planning call plus one script call is preferable to many independent host turns. Use cached/reused evidence context where the provider supports it.
- **TTS:** synthesize bounded chunks. Parallel chunk synthesis can reduce wall-clock time, but it may damage continuity; serial synthesis or provider continuity/request IDs are safer for a first version.
- **First audio:** OpenAI and Gemini 3.1 can stream, and ElevenLabs documents low-latency/streaming paths, but first-byte latency does not make the final artifact ready. Surface “preview” versus “ready” only if the product can keep the segment order and citation map correct.
- **Offline scale:** Gemini Batch is cheaper but targets up to 24 hours and can expire after 48 hours. [G-6] It should be a later pre-generation mode, not the interactive default.

## Privacy, safety, and licensing

### Provider data handling

The repository already sends research prompts and RAG generation context to an OpenAI-compatible model and sends search requests/content through Tavily. Audio adds the script and possibly source-derived text to a TTS provider. Make the data path visible in settings or an artifact detail panel.

- Gemini API pricing states that free-tier content may be used to improve Google products, while paid-tier content is not; verify the account tier before sending private collections. [G-7]
- Gemini Notebook says user data is not used to train its foundational models unless feedback is provided, but feedback can include prompts, customizations, sources, uploads, and generated Audio Overviews; reviewed feedback can be retained for up to three years. Workspace/Education handling is different. [NLM-7]
- OpenAI background Responses temporarily store response data for asynchronous execution even with `store=false` in ZDR projects. [OAI-4]
- ElevenLabs defaults logging on; zero-retention mode is enterprise-only according to the TTS API documentation. [EL-1]
- Google Cloud/Vertex and enterprise NotebookLM options offer stronger IAM, regional, and enterprise data controls, but at the cost of Cloud setup and provider coupling. [NLM-6] [G-2]

For a personal knowledge base, add an explicit “send selected source text to provider” boundary and a provider policy setting. Do not use feedback/evaluation flows containing sensitive source text without user consent.

### Copyright and synthetic voices

NotebookLM's help page tells users not to upload or share material without the necessary rights and notes that copyright complaints can remove content or terminate accounts. [NLM-8] The same rule applies here: the user must have the right to ingest, transform, synthesize, and share each source. A generated audio file does not erase source licensing obligations.

OpenAI requires a clear end-user disclosure for synthetic TTS voices. [OAI-3] ElevenLabs documents safeguards against celebrity/high-risk voice cloning and verification for professional cloning. [EL-6] Use provider-owned built-in voices only in the MVP, display “AI-generated audio,” and do not accept user voice samples. Music beds and sound effects add separate licensing and content-moderation obligations; leave them out.

### Sharing and access

The current product has no visible authentication boundary and its design scope is single-user. Do not implement public share links analogous to NotebookLM until collection ownership, source permissions, artifact authorization, revocation, and audit logging exist. A private application route with server-side access checks is the minimum acceptable path even for a download button.

## Recommended MVP contract

### Scope

- Input: one existing collection, with a selected set of immutable indexed source versions.
- Styles: `brief` (one speaker, under a short cap) and `deep_dive` (two speakers, source-backed connections). Treat `adversarial` as a future `critique`/`debate` mode after conflict/evidence rules exist.
- Length: `short` and `default` target budgets with hard caps; expose measured duration after generation. Do not promise exact minutes.
- Language: English first, because NotebookLM's richer length controls and the current OpenAI voices are English-oriented; add language validation before showing unsupported options.
- Evidence: segment-level source/chunk references and a transcript shown beside/below the player.
- TTS: one provider, two fixed built-in voices, no custom cloning, no background music.
- Delivery: private, authenticated (or explicitly single-user local), range-capable playback and download.

### Stages

1. **Prepare:** select indexed sources and create a frozen manifest/hash.
2. **Retrieve:** use existing Qdrant/LightRAG provenance to assemble evidence passages.
3. **Script:** return strict JSON turns with source refs, speaker, style, and length metadata.
4. **Validate:** fail closed for unsupported factual claims, missing evidence, invalid refs, or over-budget scripts.
5. **Synthesize:** generate one short artifact or bounded chunks; persist usage and provider IDs.
6. **Publish:** store audio, transcript, manifest, duration, MIME type, and status.
7. **UI:** show progress, retry/cancel, native player, transcript citations, and download.

### MVP acceptance checks

- A user can prove which source chunk supports every factual transcript paragraph.
- A changed/deleted source version cannot silently produce a stale artifact.
- Disconnecting or navigating away does not lose a queued/running job.
- A provider error leaves an explicit failed job and does not show a partial file as ready.
- Repeating the same request reuses or explicitly versions the artifact rather than double-generating invisibly.
- Playback supports pause, seek, resume, and download in current Chrome/Chromium/Safari.
- The transcript remains usable without audio and carries the same source citations.
- The UI labels the output as AI-generated and does not offer unauthorized voice cloning or public sharing.

## Open questions

1. Is an overview tied to a **collection**, a **research run**, or an explicit source selection? The MVP recommendation is collection plus frozen source versions.
2. Should new web research be required before generation, or must the user import sources first? Import-first gives the strongest current provenance.
3. Is a two-host dialogue mandatory for MVP, or is a one-speaker Brief sufficient to validate demand and grounding?
4. Which provider's output wins a blinded listening evaluation on 5–10 representative source sets: Gemini 2.5 Flash TTS, OpenAI TTS, or ElevenLabs v3?
5. Is WAV acceptable for the first artifact, or is MP3 required for storage/download compatibility? If Gemini is selected, who owns PCM-to-WAV/MP3 assembly?
6. What is the maximum acceptable job age, audio retention period, and storage quota per collection?
7. Can the current LightRAG/Qdrant metadata be extended with stable document/version/chunk IDs without reindexing existing collections?
8. Should citations be per transcript segment, per claim, or both? The MVP should choose segment-level citations and preserve the schema for claim-level data.
9. What evidence threshold makes a critique/adversarial line safe? How should conflicting sources be represented rather than flattened into one host opinion?
10. Are source permissions, deletion, and provider data-region requirements strong enough to justify a managed Google/OpenAI/ElevenLabs store, or should all source snapshots and artifacts remain local?
11. Does the product need artifact history and regeneration, which would reopen the current design decision that sessions are ephemeral and unauthenticated?
12. Is browser-only playback enough, or is mobile offline/file export a required product promise? NotebookLM's mobile help distinguishes offline access from downloading a file.

## Sources and evidence register

All URLs below were accessed on **2026-07-31**.

### NotebookLM / Gemini Notebook

- **[NLM-1]** [Generate Audio Overview in Gemini Notebook](https://support.google.com/notebooklm/answer/16212820?hl=en) — formats, two-host Deep Dive, Brief/Critique/Debate, language, length, custom prompt, background generation, loading, sharing, desktop download, interactive mode, and warnings.
- **[NLM-2]** [NotebookLM now lets you listen to a conversation about your sources](https://blog.google/technology/ai/notebooklm-audio-overviews) — original two-host behavior, source-reflection caveat, download, experimental limitations, generation time, inaccuracies, and English-only launch behavior.
- **[NLM-3]** [Get started with the Gemini Notebook mobile app](https://support.google.com/notebooklm/answer/16296687?hl=en) — supported source types in the mobile app, background playback, skip/speed controls, offline access, and the distinction between offline download and downloading a device file.
- **[NLM-4]** [Add or discover new sources for your notebook](https://support.google.com/gemininotebook/answer/16215270?hl=en&co=GENIE.Platform%3DDesktop) — source types, 500,000-word/200 MB source limits, 50-source free limit, web/YouTube/audio import rules, and source processing.
- **[NLM-5]** [Frequently asked questions](https://support.google.com/gemininotebook/answer/16269187?hl=en) — citation caveat for short source content and per-source size limit.
- **[NLM-6]** [Upgrade Gemini Notebook](https://support.google.com/gemininotebook/answer/16213268?hl=en) — plan-based source and Audio Overview quotas, subject-to-change notice, data handling, and enterprise protections.
- **[NLM-7]** [Privacy and Terms of Use in Gemini Notebook](https://support.google.com/gemininotebook/answer/17004255?hl=en) — feedback contents, human review, three-year retention, Workspace/Education distinctions, and data use.
- **[NLM-8]** [Create a notebook in Gemini Notebook](https://support.google.com/gemininotebook/answer/16206563?hl=en) — source/notebook model, notifications, sharing caveats, copyright obligations, and AI-generated output warnings.
- **[NLM-9]** [New in NotebookLM: Customizing your Audio Overviews](https://blog.google/technology/ai/notebooklm-update-october-2024) — custom focus/expertise and background listening with citations and quotes.

### OpenAI

- **[OAI-1]** [File search](https://developers.openai.com/api/docs/guides/tools-file-search) — hosted vector-store retrieval, file-citation annotations, optional search results, result limits, and metadata filtering.
- **[OAI-2]** [Text generation](https://developers.openai.com/api/docs/guides/text-generation) and [Structured model outputs](https://platform.openai.com/docs/guides/text-generation/json-mode) — Responses API, structured JSON, output handling, snapshot pinning, streaming, and refusal/incomplete-output handling.
- **[OAI-3]** [Text to speech](https://platform.openai.com/docs/guides/text-to-speech) — `gpt-4o-mini-tts`, voice/style instructions, 2,000-token model limit, streaming, output formats, languages, custom-voice consent, and AI-voice disclosure.
- **[OAI-4]** [Background mode](https://platform.openai.com/docs/guides/background) — asynchronous Responses, polling, cancellation, reconnecting streams, and temporary storage for ZDR background requests.
- **[OAI-5]** [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) and [GPT-4o mini TTS model](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts) — current text/audio token prices, model input limit, and rate-limit tiers.
- **[OAI-6]** [Usage policies](https://openai.com/policies/usage-policies) — privacy, likeness/voice consent, and prohibited misuse requirements.

### Google Gemini / Vertex / Cloud TTS

- **[G-1]** [File Search](https://ai.google.dev/gemini-api/docs/file-search) — managed RAG, chunking, metadata filters, citations/page numbers, raw-file and store retention, limits, and pricing.
- **[G-2]** [Grounding with your data](https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-your-data) — retrieved grounding chunks, answer segment support mapping, source URIs, and Vertex/Agent Search requirements.
- **[G-3]** [Text generation](https://ai.google.dev/gemini-api/docs/text-generation) and [generateContent reference](https://cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/projects.locations.endpoints/generateContent) — streaming, system instructions, output controls, response schemas, citation metadata, and token accounting.
- **[G-4]** [Text-to-speech generation](https://ai.google.dev/gemini-api/docs/speech-generation) — single/multi-speaker TTS, two-speaker configuration, style prompts/audio tags, voices/languages, PCM/WAV examples, streaming availability, 32k context, long-output drift, and retry caveats.
- **[G-5]** [Background execution](https://ai.google.dev/gemini-api/docs/background-execution) — background interaction IDs, status states, polling, reconnectable streaming, cancellation, and deletion.
- **[G-6]** [Batch API](https://ai.google.dev/gemini-api/docs/batch-api) — 50% pricing, 24-hour target, 48-hour expiry, polling/webhooks, result retention, cancellation, and idempotency warning.
- **[G-7]** [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) — current text/audio TTS rates, 25 audio tokens/second, free/paid data-use distinction, and grounding prices.
- **[G-8]** [Chirp 3: HD voices](https://cloud.google.com/text-to-speech/docs/chirp3-hd) and [Cloud Text-to-Speech pricing](https://cloud.google.com/text-to-speech/pricing) — voices, languages, output formats, pace controls, regions, and character pricing.

### ElevenLabs

- **[EL-1]** [Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) — request fields, output formats, model selection, continuity fields, and zero-retention/logging behavior.
- **[EL-2]** [Stream dialogue with timestamps](https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream-with-timestamps) and [Create dialogue](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert) — multi-voice inputs, ten-voice maximum, 2,000-character reliable request guidance, base64 streaming, voice segments, and alignment.
- **[EL-3]** [Models](https://elevenlabs.io/docs/models) — v3 languages/use cases, character limits, Flash latency, concurrency, and queue behavior.
- **[EL-4]** [Stream speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream) — streaming output formats and plan restrictions.
- **[EL-5]** [ElevenAPI pricing](https://elevenlabs.io/pricing/api) — character-based model prices and included usage.
- **[EL-6]** [Voice Cloning overview](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning) and [Safety](https://elevenlabs.io/safety) — voice-cloning verification, high-risk voice restrictions, detection, and enforcement.

### Browser and storage

- **[WEB-1]** [MDN `<audio>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/audio) — controls, preload, source selection, events, format differences, and transcript/accessibility caveats.
- **[WEB-2]** [MDN HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement) — `currentTime`, duration, playback methods, seekability, buffering, and media events.
- **[WEB-3]** [MDN MediaSource](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource) — source buffers, MIME support, streaming append, and stream lifecycle.
- **[WEB-4]** [MDN Range header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Range) and [Accept-Ranges](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Ranges) — byte-range requests and range capability signaling.
- **[WEB-5]** [Amazon S3 GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html) — range retrieval, 206 responses, content headers, ETags/checksums, and content-disposition overrides.
- **[WEB-6]** [MDN `<a>` download attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a) — same-origin/blob/data restrictions and browser download behavior.
- **[WEB-7]** [MDN createObjectURL/revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static) / ([revoke](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)) — object URLs for Blob/MediaSource and cleanup.
- **[WEB-8]** [Amazon S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html) — time-limited browser-accessible object URLs and expiration limits.
