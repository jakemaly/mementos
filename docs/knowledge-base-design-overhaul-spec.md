# Spec: Knowledge Base Design Overhaul

## Status

Proposed — requires approval before implementation.

## Problem Statement

The current Knowledge Base & Search experience does not match the redesigned Deep Research experience or the principles in `docs/design.md`.

The screen is a dense dashboard made from competing cards, duplicate ingestion interfaces, exposed implementation controls, decorative status treatments, and unrelated tools presented at the same visual priority. The primary jobs—asking questions of the knowledge base and running a direct vector search—are difficult to identify.

RAG Query currently behaves as a one-shot form despite being a conversational task. Vector Search shares a large dashboard card with RAG Query even though the two workflows produce different kinds of results. Collection management and file ingestion permanently occupy workspace space despite being occasional administrative tasks. The interface also contains two effectively identical Vector DB File Ingestion surfaces.

The LightRAG Graph Ingestion Studio is especially confusing because it exposes a separate ingestion workflow for infrastructure that should operate behind the product experience. The studio UI is not needed. LightRAG itself is essential and must remain the graph-enhanced RAG engine.

The present data model is also unclear to the user. Standard file ingestion writes collection-specific vectors to Qdrant, while LightRAG ingestion and querying use a separate global LightRAG store. A collection selected in the page header does not currently scope LightRAG queries. The redesigned experience must make the selected collection meaningful and keep vector and graph ingestion coordinated without exposing two ingestion products.

The user needs one calm, predictable Knowledge Base workspace that makes conversation the default, keeps direct vector search nearby but separate, and moves occasional collection and ingestion work out of the primary surface.

## Solution

Redesign Knowledge Base as a focused workspace using the same shared application shell, sidebar, visual language, interaction restraint, and responsive behavior as Deep Research.

The application will use one persistent global sidebar on desktop. It will contain the Mementos text identity, Deep Research and Knowledge Base destinations, a Collections action, and Settings. New research and New chat remain contextual actions within their respective destinations rather than permanent global actions. At narrow widths, the sidebar becomes the same compact top navigation used by the redesigned Deep Research experience.

Knowledge Base opens to RAG Chat by default. RAG Chat is a full-height, readable-width conversation panel aligned to the left of the workspace. The unused space to its right remains calm whitespace rather than becoming another inspector, dashboard, or card grid. The transcript scrolls within the panel and a simple composer remains sticky at its bottom. The composer exposes only the selected collection and send action.

RAG Chat remains powered by LightRAG. It supports an ephemeral, session-only conversation: prior messages help interpret follow-up questions, but every answer performs fresh retrieval from the selected collection. Answers stream progressively, remain grounded in retrieved knowledge, and include numbered inline citations plus a compact source list. When the collection lacks sufficient evidence, the assistant says so instead of filling gaps with unsupported model knowledge.

Vector Search is a separate local view within Knowledge Base, selected through a restrained two-option control near the page heading. It uses the same left-aligned panel and composer geometry but does not create a conversation. A search returns compact raw matches showing source, snippet, and similarity score. A compact result-limit selector remains available.

Collections Manager becomes a by-default-hidden side drawer opened from the global sidebar. The drawer supports selecting an existing collection, creating a collection, and ingesting one TXT or Markdown file. Chunk size and overlap become internal defaults. The duplicate Vector DB File Ingestion surfaces are replaced by this single ingestion flow.

The standalone LightRAG Graph Ingestion Studio UI is deleted. LightRAG is not retired, replaced, or downgraded. The unified ingestion operation coordinates the selected collection's semantic vector index and LightRAG graph index behind one user action and reports vector and graph outcomes separately when only part of the operation succeeds.

## User Stories

1. As the Mementos owner, I want Deep Research and Knowledge Base to use one shared application shell, so that the product feels like one coherent application.
2. As the Mementos owner, I want the global sidebar visible throughout the desktop application, so that primary navigation is always predictable.
3. As the Mementos owner, I want the sidebar to use the Mementos text identity without an ornamental logo, so that navigation follows the restrained visual language.
4. As the Mementos owner, I want separate Deep Research and Knowledge Base destinations, so that I can move between the two primary workflows directly.
5. As the Mementos owner, I want Collections available from the global sidebar, so that occasional administration does not occupy the main workspace.
6. As the Mementos owner, I want Settings represented consistently in the sidebar, so that future application settings have an established destination without requiring settings work in this redesign.
7. As the Mementos owner, I want New research to appear only in Deep Research, so that contextual actions do not clutter unrelated screens.
8. As the Mementos owner, I want New chat to appear only in Knowledge Base, so that I can clear the current conversation without confusing it with global navigation.
9. As a keyboard user, I want to reach every sidebar destination and action with visible focus, so that the shared shell is fully operable without a pointer.
10. As a narrow-screen user, I want the global sidebar to become compact top navigation, so that primary navigation remains usable without consuming the viewport.

11. As the Mementos owner, I want Knowledge Base to open to RAG Chat, so that the primary workflow is immediately available.
12. As the Mementos owner, I want RAG Chat and Vector Search to be separate views, so that conversational answers and raw retrieval results are not mixed in one transcript.
13. As the Mementos owner, I want a restrained local switch near the Knowledge Base heading, so that I can move between Chat and Vector Search without adding global navigation clutter.
14. As the Mementos owner, I want the local switch to communicate the selected view with text and more than color alone, so that its state is unambiguous and accessible.
15. As the Mementos owner, I want the state of each view retained while switching between them during the current session, so that checking raw matches does not erase my chat and returning to chat does not erase my latest search.
16. As the Mementos owner, I want changing collections to clear collection-bound results, so that content from different corpora is never presented as if it belonged together.
17. As the Mementos owner, I want the Knowledge Base screen to contain one visual focal point, so that I can immediately understand where to work.
18. As the Mementos owner, I want the workspace to avoid dashboards, nested cards, database badges, and decorative status blocks, so that operational infrastructure does not compete with my task.

19. As the Mementos owner, I want an empty RAG Chat to show only a quiet Knowledge Base heading, collection context, and composer, so that the page feels intentional without marketing or onboarding filler.
20. As the Mementos owner, I want the conversation panel aligned to the left, so that the interface feels like a working tool rather than a centered landing page.
21. As the Mementos owner, I want the conversation panel constrained to a comfortable reading width, so that long answers remain readable.
22. As the Mementos owner, I want the area to the right of the chat left as calm whitespace, so that the redesign does not replace one dashboard with another.
23. As the Mementos owner, I want the conversation panel to fill the available vertical workspace, so that the transcript and composer feel like one continuous tool.
24. As the Mementos owner, I want only the transcript to scroll while the composer remains reachable, so that I can ask a follow-up at any point.
25. As the Mementos owner, I want the composer to remain sticky at the bottom of its panel, so that its position is predictable.
26. As the Mementos owner, I want a multiline composer, so that I can write detailed questions.
27. As the Mementos owner, I want Enter to submit a non-empty question, so that asking short questions is fast.
28. As the Mementos owner, I want Shift+Enter to insert a newline, so that I can compose structured questions.
29. As the Mementos owner, I want pointer and touch users to have a clear send action, so that submission does not depend on a keyboard convention.
30. As the Mementos owner, I want the composer to expose only collection selection and send, so that retrieval and model implementation settings do not create unnecessary decisions.
31. As the Mementos owner, I want submission disabled when the question is empty or no collection is selected, so that invalid requests are prevented before they reach the API.
32. As the Mementos owner, I want a visible but restrained focus state around the composer, so that active input is obvious without decorative glow.

33. As the Mementos owner, I want RAG Chat to remain powered by LightRAG, so that graph-enhanced retrieval remains a core product capability.
34. As the Mementos owner, I want LightRAG's retrieval mode to remain an internal product default, so that I do not need to choose between naive, local, global, and hybrid on every question.
35. As the Mementos owner, I want the internal default to use LightRAG's graph-enhanced hybrid behavior, so that answers can combine local entity detail and broader graph context.
36. As the Mementos owner, I want each chat bound to one selected collection, so that I know which corpus supports its answers.
37. As the Mementos owner, I want changing the collection during a conversation to require confirmation and start a new chat, so that the transcript cannot silently mix corpora.
38. As the Mementos owner, I want my selected collection to remain selected after starting a new chat, so that clearing conversation state does not undo an unrelated preference.
39. As the Mementos owner, I want prior messages used to interpret follow-up questions, so that references such as “it,” “that approach,” or “its limitations” work naturally.
40. As the Mementos owner, I want every turn to perform fresh retrieval, so that follow-up answers are grounded rather than relying only on stale context.
41. As the Mementos owner, I want conversation history limited to the current browser session, so that I get conversational utility without a saved-thread system.
42. As the Mementos owner, I want refresh and New chat to clear the transcript, so that session-only behavior is predictable.
43. As the Mementos owner, I want bounded conversation context sent to the query service, so that long sessions do not grow request size and model cost without limit.
44. As the Mementos owner, I want the interface to distinguish my messages from assistant answers through typography, alignment, and spacing rather than loud chat bubbles, so that the transcript follows the matte design language.
45. As the Mementos owner, I want answers to stream progressively, so that I can begin reading without waiting for the complete generation.
46. As the Mementos owner, I want a restrained retrieval state before answer text arrives, so that I know the system is working.
47. As the Mementos owner, I want to stop an active answer, so that an unwanted or mistaken query does not continue using model resources.
48. As the Mementos owner, I want cancellation to stop upstream LightRAG and model work, so that Stop is operational rather than cosmetic.
49. As the Mementos owner, I want late stream events from a stopped or superseded turn ignored, so that cancelled output cannot reappear in the transcript.
50. As the Mementos owner, I want completed assistant answers to have a Copy action, so that I can reuse useful text.
51. As the Mementos owner, I do not want edit, regenerate, branching, ratings, or message menus in the first version, so that the chat remains focused.
52. As the Mementos owner, I want an explicit error state attached to the failed turn, so that earlier successful messages remain readable and I know what failed.
53. As the Mementos owner, I want network, timeout, retrieval, and generation failures described in user-facing language, so that internal stack traces and provider details are not exposed.
54. As the Mementos owner, I want to retry by resubmitting my question after an error, so that recovery does not require reloading the application.

55. As the Mementos owner, I want every substantive RAG answer grounded in the selected collection, so that Knowledge Base remains trustworthy.
56. As the Mementos owner, I want the assistant to decline clearly when retrieval provides insufficient evidence, so that model knowledge is not mistaken for corpus knowledge.
57. As the Mementos owner, I want the closest retrieved sources optionally shown with an insufficient-evidence response, so that I can judge whether the collection contains adjacent information.
58. As the Mementos owner, I want numbered inline citations in assistant answers, so that I can connect claims to evidence while reading.
59. As the Mementos owner, I want a compact source list beneath each answer, so that citation details are available without a permanent inspector pane.
60. As the Mementos owner, I want each citation to identify the original filename or URL, so that I understand where the evidence came from.
61. As the Mementos owner, I want URL citations to open safely in a new tab, so that external navigation does not replace my conversation.
62. As the Mementos owner, I want local-file citations presented as text rather than broken links, so that provenance remains accurate.
63. As the Mementos owner, I want cited snippets available in the compact source section, so that I can inspect the supporting passage.
64. As the Mementos owner, I want duplicate citation records consolidated within an answer, so that repeated retrieval of the same source does not create noise.
65. As the Mementos owner, I want citations finalized when streaming completes, so that inline markers and the source list remain consistent.
66. As the Mementos owner, I want incomplete streamed answers marked as stopped or failed, so that partial text is not presented as a finished answer.

67. As the Mementos owner, I want Vector Search to use a separate workspace from RAG Chat, so that raw retrieval remains a deliberate one-off operation.
68. As the Mementos owner, I want Vector Search to use the same left-aligned panel and composer geometry, so that both Knowledge Base views feel related.
69. As the Mementos owner, I want the Vector Search composer to contain the selected collection, query, result limit, and search action, so that all required inputs are in one place.
70. As the Mementos owner, I want a compact 5, 10, or 20 result-limit selector, so that I can control result volume without exposing advanced retrieval settings.
71. As the Mementos owner, I want raw matches listed vertically, so that results are easy to scan.
72. As the Mementos owner, I want each result to show source, snippet, and similarity score, so that I can evaluate provenance, content, and match strength.
73. As the Mementos owner, I do not want character offsets or chunk-index diagnostics shown by default, so that implementation metadata does not distract from useful information.
74. As the Mementos owner, I want long snippets expandable in place, so that the default list remains compact without hiding detail permanently.
75. As the Mementos owner, I want the result count and zero-result state stated in text, so that the outcome is clear without interpreting layout.
76. As the Mementos owner, I want a new search to replace the previous result set, so that one-off searches do not become an accidental conversation history.
77. As the Mementos owner, I want changing collections to clear current vector results, so that stale matches are never attributed to the new collection.
78. As the Mementos owner, I want vector-search errors shown within the search workspace, so that global banners do not disrupt unrelated application areas.

79. As the Mementos owner, I want Collections Manager hidden by default, so that administration does not compete with chat and search.
80. As the Mementos owner, I want Collections Manager to open as a side drawer from the global sidebar, so that I can manage data without navigating away from my current workspace.
81. As the Mementos owner, I want closing the drawer to restore focus to its trigger, so that keyboard navigation remains coherent.
82. As the Mementos owner, I want the drawer to list real collections returned by Qdrant, so that I can select a valid destination.
83. As the Mementos owner, I want the active collection clearly identified with text and selection state, so that the drawer does not rely only on cherry red.
84. As the Mementos owner, I want collection counts shown only when they come from actual storage data, so that fabricated session statistics are removed.
85. As the Mementos owner, I want to create a collection with a validated name, so that the collection can be used safely by Qdrant and LightRAG.
86. As the Mementos owner, I want duplicate or invalid collection names rejected with clear text, so that creation failures are actionable.
87. As the Mementos owner, I want collection creation reported as successful only after storage confirms it, so that offline or failed operations are not presented as success.
88. As the Mementos owner, I do not want rename, delete, export, or analytics controls in this redesign, so that Collections Manager stays narrow.
89. As the Mementos owner, I want the drawer to preserve my selected collection after it closes, so that routine querying does not require another selection.
90. As the Mementos owner, I want an unavailable Qdrant service represented honestly, so that a synthetic default collection is not mistaken for connected storage.

91. As the Mementos owner, I want one manual file-ingestion flow, so that I do not need to decide between duplicate vector and graph studios.
92. As the Mementos owner, I want the ingestion flow located in the Collections drawer, so that it is available when managing a corpus and absent during normal querying.
93. As the Mementos owner, I want to ingest one file at a time, so that progress and failure states remain simple and attributable.
94. As the Mementos owner, I want manual ingestion to support TXT and Markdown, so that the interface promises only formats the application can parse reliably.
95. As the Mementos owner, I want unsupported file formats rejected before upload, so that I receive immediate, accurate feedback.
96. As the Mementos owner, I want to choose the destination collection before importing, so that the resulting knowledge is scoped correctly.
97. As the Mementos owner, I want chunk size and overlap managed through internal defaults, so that low-level indexing controls do not burden routine ingestion.
98. As the Mementos owner, I want one Import action to populate both semantic vector search and LightRAG graph retrieval for the selected collection, so that both query modes see the same source corpus.
99. As the Mementos owner, I want the ingestion result to report semantic-vector and LightRAG-graph outcomes separately, so that partial success is not described as complete success.
100. As the Mementos owner, I want a successful import to report filename and useful counts or status returned by each indexing path, so that completion is verifiable.
101. As the Mementos owner, I want a failed graph extraction to preserve and report a successful vector import, so that completed work is not hidden or falsely rolled back.
102. As the Mementos owner, I want a failed vector import to preserve and report a successful graph import, so that partial outcomes remain honest.
103. As the Mementos owner, I want the selected file retained after failure, so that I can retry without selecting it again.
104. As the Mementos owner, I want the selected file cleared after complete success, so that accidental duplicate ingestion is less likely.
105. As the Mementos owner, I want duplicate submission disabled while ingestion is active, so that the same file is not indexed concurrently by repeated clicks.
106. As the Mementos owner, I want ingestion progress stated in restrained text, so that long LightRAG extraction feels responsive without fake progress bars.
107. As the Mementos owner, I want closing the drawer during active ingestion prevented or explicitly confirmed, so that the operation's status is not accidentally lost.
108. As the Mementos owner, I want the standalone LightRAG Graph Ingestion Studio removed, so that LightRAG behaves as infrastructure rather than a second product.
109. As the Mementos owner, I want both duplicate Vector DB File Ingestion panels removed, so that only the unified drawer flow remains.
110. As the Mementos owner, I want existing LightRAG graph data preserved, so that removing the studio UI does not retire or erase the engine's corpus.

111. As the Mementos owner, I want the interface to use a warm white matte background and charcoal text, so that it matches the Design Constitution.
112. As the Mementos owner, I want cherry red reserved for focus, selection, active state, and primary actions, so that accent color carries information.
113. As the Mementos owner, I want semantic error, warning, and success colors paired with text or icons, so that state never relies on color alone.
114. As the Mementos owner, I want spacing and typography to establish hierarchy, so that cards and borders are used only for genuinely separate objects.
115. As the Mementos owner, I want message groups and search results separated primarily by whitespace, so that the panel does not become nested-card soup.
116. As the Mementos owner, I want glass reserved for the sidebar, drawer, and floating overlays, so that it remains an accent rather than the page material.
117. As the Mementos owner, I want subtle fades and status transitions only, so that motion communicates continuity without demanding attention.
118. As a reduced-motion user, I want nonessential motion removed, so that the interface respects my system preference.
119. As a keyboard user, I want visible focus on navigation, composers, selectors, citations, disclosures, and drawer controls, so that location is always apparent.
120. As a screen-reader user, I want semantic forms, buttons, selects, lists, headings, and dialogs, so that the interface has a meaningful structure.
121. As a screen-reader user, I want streaming, query, search, and ingestion statuses announced through restrained live regions, so that asynchronous work is understandable.
122. As a screen-reader user, I want streamed answer announcements throttled or finalized rather than announced token by token, so that output remains usable.
123. As a touch user, I want controls to retain comfortable target sizes, so that visual restraint does not reduce usability.
124. As a mobile user, I want Chat and Vector Search to become full-width linear workspaces, so that desktop whitespace does not constrain the narrow layout.
125. As a mobile user, I want Collections Manager to become an accessible full-width sheet, so that drawer controls fit without horizontal scrolling.
126. As a mobile user, I want the sticky composer to respect the viewport and safe-area inset, so that it is not hidden by browser chrome or an on-screen keyboard.
127. As the Mementos owner, I want the layout free of horizontal page overflow and nested scrolling traps, so that it behaves predictably across supported browsers.

## Implementation Decisions

### Product and information architecture

- Introduce one shared application shell used by both Deep Research and Knowledge Base.
- The desktop shell contains a persistent compact sidebar with Mementos text identity, Deep Research, Knowledge Base, Collections, and Settings.
- Deep Research and Knowledge Base are destinations. Collections opens a drawer rather than navigating to a permanent dashboard. Settings remains a future destination; this spec does not implement settings behavior.
- New research and New chat are contextual actions shown only in their associated destination.
- The shared global shell supersedes the earlier Deep Research rule that the sidebar appears only after research submission. Deep Research behavior and its four-pane active workspace otherwise remain unchanged by this spec.
- At narrow widths, the shared sidebar becomes compact top navigation. The breakpoint behavior must remain consistent across both features.
- Knowledge Base contains two mutually exclusive local views: RAG Chat and Vector Search. RAG Chat is the default. A restrained text-labelled local switch sits near the page heading.
- Switching local views preserves each view's current session state. Changing collection clears vector results and starts a fresh chat after confirmation if the chat is non-empty.

### RAG Chat experience

- RAG Chat uses a full-height, left-aligned panel constrained to a readable line length. Remaining desktop width stays empty; no permanent source inspector or dashboard pane is added.
- The empty state contains only the Knowledge Base heading, selected collection context, and composer. Do not add suggested prompts, explanatory marketing copy, ornamental illustration, or status cards.
- The transcript is the panel's scroll container. The composer remains sticky at the bottom of the panel.
- The composer is a semantic multiline form with collection selection and send action. Enter submits; Shift+Enter inserts a newline.
- Message presentation uses typography, spacing, and restrained alignment before bubbles or borders. User and assistant turns must still be distinguishable without color alone.
- The client keeps one ephemeral conversation in memory. Refresh and New chat clear it. No browser persistence or backend thread storage is added.
- A chat is bound to one collection. The collection may be changed from the composer footer; changing it during a non-empty chat requires confirmation and then clears the transcript.
- The selected collection remains selected after New chat and may be shared with the user's current application-level collection selection.
- Each turn has explicit `idle`, `retrieving`, `streaming`, `completed`, `stopped`, and `failed` states.
- Stop uses browser cancellation and must propagate through the application proxy to the sidecar and active LightRAG/model task. A client turn ID prevents late events from a cancelled or superseded turn from changing state.
- Completed answers expose Copy. Edit, regenerate, branching, ratings, saved prompts, and message action menus are not implemented.

### LightRAG retention and collection scoping

- LightRAG remains the graph-enhanced RAG engine. The redesign must not remove the LightRAG dependency, graph storage, Qdrant-backed LightRAG vector storage, query behavior, or existing graph data.
- Delete only the standalone LightRAG Graph Ingestion Studio presentation and obsolete UI state dedicated to that studio.
- LightRAG queries become collection-aware. The selected Mementos collection identifies the LightRAG corpus queried for that conversation.
- Maintain one lazily initialized LightRAG context per collection rather than one unscoped global context. Initialization must remain concurrency-safe and avoid recreating model resources unnecessarily.
- Preserve the current unscoped LightRAG corpus by treating it as the existing `default` collection context or by providing an equivalent compatibility mapping. This work must not silently erase or orphan current LightRAG data.
- New collection contexts must isolate their graph and vector records from other Mementos collections. The exact storage prefix or working-directory convention is an implementation detail, but collection name validation and normalization must be shared by collection creation, ingestion, and query.
- Hybrid LightRAG retrieval is the internal default for RAG Chat. The existing naive/local/global/hybrid capabilities may remain available internally and in tests, but the redesigned UI does not expose a mode selector.
- Prior messages are used only to contextualize the current question. Every turn executes fresh collection-scoped retrieval.
- Bound the conversation history forwarded per request by a documented message or token limit. Prefer retaining the most recent complete turns over unbounded transcript growth.

### Grounding and citations

- The RAG query path must return structured retrieval provenance in addition to generated answer text.
- Use LightRAG's structured query/retrieval data to identify retrieved source records and passages. Do not attempt to recover citations by parsing arbitrary generated prose after completion.
- Manual and research ingestion must preserve useful source identity in LightRAG records. Local files use filename; web sources use canonical URL and title when available.
- Stream answer deltas and terminal citation data through one response stream. The wire contract must distinguish answer text from sources, completion, cancellation, and error states.
- The stream contract should contain events equivalent to:
  - `retrieval_started`: turn and collection identity.
  - `answer_delta`: ordered text delta for the active turn.
  - `sources`: deduplicated citation records containing stable identifier, label, optional URL, and supporting snippet.
  - `done`: terminal success with grounding status.
  - `error`: safe user-facing failure data.
- The server may emit sources before or after answer deltas as LightRAG makes them available, but the client finalizes inline citation/source consistency only on `done`.
- Render numbered inline citations and a compact source list under each completed answer. URL sources open in a new tab with safe link attributes; local filenames are not links.
- Deduplicate citation records by canonical URL when present, otherwise by stable document identity.
- If retrieval confidence or usable evidence is below the product threshold, return an explicit insufficient-evidence result. Do not silently answer from general model knowledge.
- Insufficient-evidence responses may include the closest retrieved sources, clearly labelled as related material rather than proof of an answer.
- Do not expose chain-of-thought, raw prompts, raw LightRAG payloads, provider stack traces, or hidden model configuration.

### RAG API behavior

- Replace the current one-shot, mode-selecting frontend contract with a collection-aware conversational streaming contract.
- The browser request contains the current question, selected collection, bounded prior turns, and a client turn ID. It does not accept arbitrary model configuration, retrieval mode, temperature, chunk settings, or server-only prompt fields.
- Validate the complete request at the application API boundary and again at the sidecar trust boundary.
- The application proxy forwards an explicit allowlisted request object rather than the entire untrusted body.
- The proxy forwards client cancellation to the sidecar, releases its stream reader, and returns safe status semantics for malformed requests, timeouts, upstream failures, and cancellations.
- The sidecar cancels and awaits active query/generation work when the response consumer disconnects.
- Keep any non-streaming internal LightRAG query support needed by existing tooling, but the redesigned Knowledge Base uses the streaming collection-aware endpoint.
- Error responses must not forward raw sidecar exceptions verbatim to the browser.

### Vector Search

- Vector Search remains a direct semantic query against the selected collection's Qdrant vectors. It is not presented as a chat and does not use conversation history.
- The search composer contains query, collection selector, a compact result-limit selector, and submit action.
- Supported user-selectable limits are 5, 10, and 20. The API continues to enforce a safe server-side maximum regardless of client input.
- Results show source label, snippet, and similarity score. Remove default presentation of chunk index and character start/end offsets.
- Long snippets may use one accessible in-place disclosure. Do not surround each result with heavy nested cards.
- A new search replaces the previous result set. Switching away from the view preserves the current result set during the session; changing collections clears it.
- Explicitly represent idle, searching, results, zero results, failed, collection unavailable, and cancelled states.
- Continue validating collection existence before querying. Do not treat an offline synthetic `default` value as a real collection.

### Collections drawer

- Collections Manager is a by-default-closed drawer triggered from the shared sidebar.
- On desktop it enters from the sidebar edge and preserves the underlying workspace. On narrow screens it becomes a full-width modal sheet.
- Use semantic dialog behavior: labelled title, focus containment while open, Escape dismissal when safe, close control, and focus restoration to the trigger.
- The drawer supports only selecting a collection, creating a collection, and ingesting one file. Rename, delete, export, analytics, and bulk operations are excluded.
- Collection selection remains available in Chat and Vector Search composers; the drawer is not required for routine switching.
- Remove deterministic fake collection counts. Show counts only if returned by actual storage; otherwise omit them.
- Collection creation must use one shared validation rule and return success only after Qdrant and required collection-scoped LightRAG setup succeed or return an explicit partial provisioning state.
- Do not catch a failed Qdrant creation and return an unconditional success response.
- Do not silently fabricate an available `default` collection when Qdrant is offline. Present the disconnected state and disable dependent actions.

### Unified ingestion

- Replace both duplicate Vector DB File Ingestion panels and the standalone LightRAG Graph Ingestion Studio with one ingestion section inside the Collections drawer.
- The user selects one TXT or Markdown file and one destination collection. PDF, DOCX, folder, URL, pasted-text, and multi-file ingestion are not included.
- Remove user-facing chunk-size and overlap controls. Use documented internal defaults shared with other collection ingestion where practical.
- Accepting a file is one product operation with two indexing outcomes:
  1. semantic chunk/vector ingestion for direct Vector Search;
  2. LightRAG document insertion and graph extraction for RAG Chat.
- Parse and validate the source once before dispatching the two indexing operations. Preserve filename and source metadata in both indexes.
- The operation returns separate vector and LightRAG result objects plus an overall complete/partial/failed status. Never describe one successful branch as unqualified complete success when the other branch failed.
- Do not attempt a distributed rollback between Qdrant vector ingestion and LightRAG graph extraction. Preserve successful work, identify the failed branch, and allow an explicit retry. This is preferable to hiding completed indexing or risking data loss.
- Disable duplicate submission while ingestion is active. Preserve the selected file after failure or partial failure; clear it after complete success.
- Show real stages reported by the backend rather than simulated percentage progress.
- Route existing Deep Research source imports through the same collection-indexing service so imported sources become available to both direct Vector Search and LightRAG Chat in the chosen collection. This changes indexing consistency, not the Deep Research selection or import UI.

### Component boundaries

- Break the current monolithic Knowledge Base page into components that correspond only to visible responsibilities:
  - shared application shell and global navigation;
  - Knowledge Base workspace and local view selection;
  - RAG Chat transcript/composer orchestration;
  - individual answer citation rendering;
  - Vector Search form/results;
  - Collections drawer with collection creation and ingestion.
- Keep data fetching and state closest to the feature that owns it. Do not add a global state library or general component system.
- Share the application shell and collection-selection behavior where both Deep Research and Knowledge Base genuinely use them. Do not generalize chat, graph, timeline, and search components into speculative abstractions.
- Reuse React, CSS Modules, semantic HTML, and existing SVG/icon techniques. Add no design-system, chat, state-management, or animation dependency.
- Consolidate collection retrieval rather than allowing Deep Research, Knowledge Base, and the drawer to present inconsistent copies of the collection list.

### Visual design

- Follow `docs/design.md` as the governing design constitution.
- Use warm white matte page surfaces, charcoal text, near-monochrome controls, and cherry red only for focus, selection, active state, and primary actions.
- Reserve frosted glass for the global navigation, drawer, and genuine overlays. Do not use glass for chat messages, result rows, or ordinary page sections.
- Prefer typography, spacing, and alignment over containers. A message or search result is an object, but it does not automatically require a bordered card.
- Remove decorative gradients, broad blur, giant pills, stacked shadows, ornamental logos, Qdrant-active badges, oversized icons, and inline styles that recreate the old dashboard treatment.
- Keep one visual focal point per Knowledge Base view: the chat composer/transcript or vector search form/results.
- Use subtle fades and state transitions only. Respect `prefers-reduced-motion`.
- Maintain WCAG AA text contrast and visible focus states.

### Responsive behavior

- Verify the desktop shell and left-aligned readable panel at 1440px.
- Verify compact desktop/tablet behavior at 1024px without turning the workspace back into a card grid.
- At 768px and below, convert global sidebar navigation to compact top navigation and let the active Knowledge Base panel use full width.
- At 390px, ensure the local view switch, collection selector, composer actions, citation lists, result-limit selector, and drawer sheet remain usable without horizontal overflow.
- The mobile layout remains a linear page/panel. Do not add horizontal mode scrolling, nested pane tabs, or desktop-style empty whitespace.
- Sticky composers must account for dynamic viewport height, safe-area insets, browser chrome, and the on-screen keyboard.
- Support current Chrome, Chromium-based browsers, and Safari.

### Removal and consolidation

- Delete the standalone LightRAG Graph Ingestion Studio UI and its dedicated client state, drag/drop handlers, status presentation, and styles after the unified drawer ingestion flow replaces it.
- Do not delete LightRAG itself, its sidecar query/insert capabilities, its graph data, or its dependencies.
- Delete both duplicate Vector DB File Ingestion presentations after the drawer flow replaces them.
- Replace the current RAG one-shot answer presentation with the new transcript and streaming state model.
- Remove the user-facing LightRAG mode selector from Knowledge Base Chat while preserving internal mode support.
- Remove fake session collection counts, Qdrant-active decorative badges, old tab-pill navigation, broad glass cards, and obsolete dashboard CSS.
- Trace callers before deleting shared collection, ingestion, vector query, or sidecar code. Existing Deep Research ingestion and any retrieval visualization bridge must not be removed merely because the old Knowledge Base UI is deleted.

## Testing Decisions

### Testing philosophy and seams

- Test external behavior at the highest existing seam that can prove the requirement. Avoid tests coupled to component state names, CSS class names, private LightRAG methods, or exact internal file layout.
- The primary feature seam is the running application API: submit collection-scoped chat/search/ingestion requests and assert streamed events or result contracts. This proves the frontend-facing behavior without coupling tests to route implementation.
- The second necessary seam is the rendered Knowledge Base workflow: operate navigation, forms, transcript, local view switch, drawer, and cancellation as a user would. Existing lightweight frontend scripts are prior art; extend or replace brittle static string checks with behavior-focused checks where possible without adding a test framework solely for this redesign.
- The sidecar HTTP seam remains necessary for LightRAG collection isolation, streaming, cancellation, structured citations, and ingestion outcomes. Existing FastAPI endpoint tests and LightRAG step tests are prior art.
- Do not add a new seam for every component. Pure presentational components require direct tests only when their accessible behavior cannot be proven through the workspace flow.

### Shared shell and frontend behavior

- Verify the global sidebar appears in both Deep Research and Knowledge Base at desktop widths.
- Verify Deep Research, Knowledge Base, Collections, and Settings have accessible names and visible focus behavior.
- Verify contextual New research and New chat actions appear only in their relevant destination.
- Verify narrow widths replace the sidebar with compact top navigation.
- Verify Knowledge Base opens to RAG Chat and the local switch changes to Vector Search without changing global destination.
- Verify switching local views preserves in-session state for each view.
- Verify collection changes clear vector results and require confirmation before clearing a non-empty chat.
- Verify the empty chat contains only the intended heading, collection context, and composer—not old dashboard panels or ingestion studios.
- Verify Enter submits and Shift+Enter inserts a newline.
- Verify the composer rejects empty questions and missing collections.
- Verify the transcript scrolls independently and the composer remains reachable.
- Verify Stop aborts the active request, marks or removes partial output consistently, and ignores late events.
- Verify Copy copies only the completed assistant answer text.
- Verify no edit, regenerate, feedback, saved-thread, or mode-selector controls appear.

### Chat API and LightRAG behavior

- Verify malformed JSON, non-object bodies, missing query, empty query, invalid collection, oversized history, and invalid message roles receive appropriate client-error responses.
- Verify the application proxy forwards only allowlisted query, collection, bounded history, and turn identity fields.
- Verify the UI cannot set LightRAG mode or arbitrary model options through the request body.
- Verify a valid request produces ordered retrieval, answer, source, and terminal stream events.
- Verify answer deltas reconstruct the final answer without duplication or reordering.
- Verify terminal source records have stable IDs, labels, snippets, and safe optional URLs.
- Verify duplicate source records are consolidated.
- Verify unsupported questions produce an explicit insufficient-evidence terminal result rather than an uncited general-knowledge answer.
- Verify every supported substantive answer has citation data and that inline markers resolve to rendered source entries.
- Verify prior turns can contextualize a follow-up while the sidecar performs fresh retrieval for that turn.
- Verify bounded history truncation keeps recent complete turns and does not split message pairs unpredictably.
- Verify collection A queries cannot retrieve records exclusive to collection B.
- Verify the compatibility mapping keeps the existing LightRAG corpus reachable through the intended default collection.
- Verify simultaneous first queries for one collection initialize one collection context rather than racing duplicate initialization.
- Verify queries for initialized collections can run concurrently without a global serialization bottleneck where LightRAG permits it.
- Verify client disconnect or Stop cancels and awaits active sidecar work.
- Verify timeouts and provider failures produce safe stream errors without leaking internal exception text.

### Vector Search behavior

- Verify query and collection are required and result limit accepts only supported UI values while the API enforces its own safe bounds.
- Verify searches are scoped to the selected collection.
- Verify each result exposes source, snippet, and score.
- Verify chunk indexes and character offsets are absent from default presentation.
- Verify long snippets can be expanded and collapsed with a keyboard-accessible control.
- Verify a new search replaces previous results.
- Verify zero-result, offline, searching, and failed states are explicit.
- Verify switching collection clears stale results.

### Collections and ingestion behavior

- Verify the Collections action opens a labelled drawer, moves focus into it, traps focus appropriately, closes with Escape when no protected operation is active, and restores focus to the trigger.
- Verify narrow layouts render the manager as a usable full-width sheet.
- Verify the collection list reflects actual storage and does not invent counts or connected status.
- Verify valid collection creation is confirmed only after required storage setup succeeds.
- Verify duplicate, invalid, and failed collection creation remains visibly failed.
- Verify TXT and Markdown are accepted while unsupported formats are rejected before ingestion.
- Verify only one file is accepted and no batch/folder behavior is implied.
- Verify chunk controls are absent from the user interface and internal defaults are applied server-side.
- Verify one import targets both the selected collection's direct vector index and LightRAG context.
- Verify complete success reports both branch outcomes.
- Verify vector-only and graph-only partial success are reported as partial, preserve successful work, and retain the file for retry.
- Verify complete failure retains the file and provides safe actionable errors.
- Verify duplicate submission is disabled while active.
- Verify Deep Research imports become queryable through both Vector Search and LightRAG Chat in the chosen collection.
- Verify existing LightRAG data remains after deleting the studio UI.

### Accessibility, responsive, and browser verification

- Keyboard-navigate the global shell, local view switch, chat, citations, vector results, and drawer without a pointer.
- Verify visible focus and logical focus order.
- Verify streaming status, completed answer status, errors, and ingestion status use restrained live-region announcements.
- Verify token deltas are not individually announced by screen readers.
- Verify state is never conveyed only by cherry red, success green, or error red.
- Verify `prefers-reduced-motion` removes nonessential transitions.
- Verify WCAG AA text contrast.
- Verify layouts at 1440px, 1024px, 768px, and 390px.
- Verify current Safari, Chrome, and a Chromium-based browser have no console errors, clipped controls, horizontal overflow, or nested scrolling traps.
- Verify the on-screen keyboard does not cover the mobile composer.

### Regression commands and prior art

From `app/`, continue using and update the existing lightweight checks rather than adding a framework solely for this work:

```bash
npm run lint
npm run build
node test-rag-frontend.mjs
node test-rag-routes.mjs
node test-rag-runtime.mjs
node test-deep-research-frontend.mjs
node test-deep-research-routes.mjs
```

From the repository root, run the relevant sidecar endpoint and LightRAG regression tests, including the existing main, insertion, query, concurrency, and bug suites:

```bash
python -m pytest sidecar/test_main.py sidecar/test_step3_insert.py sidecar/test_step4_query.py sidecar/test_step3_bugs.py
```

Use `./start.sh` or the documented Qdrant, sidecar, and Next.js startup flow for integrated manual verification.

## Out of Scope

- Retiring, replacing, or removing LightRAG.
- Deleting or intentionally migrating existing LightRAG graph data.
- Exposing LightRAG retrieval modes, model selection, temperature, prompts, or other advanced RAG controls.
- Saved conversations, named threads, cross-device history, browser-local history, search history, or authentication.
- Editing, regenerating, branching, rating, sharing, or exporting chat messages.
- A permanent evidence inspector or additional dashboard pane to the right of Chat or Vector Search.
- Mixing RAG answers and raw vector matches in one transcript.
- Collection rename, delete, export, analytics, storage browser, or bulk administration.
- Multiple-file, folder, PDF, DOCX, URL, pasted-text, image, audio, or video ingestion.
- User-controlled chunk size or overlap.
- Automatic distributed rollback across vector and graph indexing after partial ingestion.
- Redesigning the Deep Research graph, sketch, observability, source ranking, research execution, or ingestion selection behavior. Its source-import backend may use the shared collection-indexing service so imported sources reach both indexes.
- Implementing the Settings destination.
- Dark mode.
- Adding a component library, state-management library, chat library, animation library, or new graph dependency.
- Mobile-specific feature expansion beyond a readable, fully operable responsive version of the specified workflows.

## Further Notes

- `docs/design.md` governs visual and interaction decisions. When this spec and existing dashboard styling disagree, the Design Constitution wins.
- This spec intentionally distinguishes the discarded **LightRAG Graph Ingestion Studio UI** from the retained **LightRAG engine**. Removing the studio must never be interpreted as permission to remove LightRAG, its graph storage, its retrieval modes, its sidecar capabilities, or its data.
- The Knowledge Base redesign changes the earlier Deep Research information architecture only where required to establish the shared global sidebar. The active Deep Research four-pane workspace and research pipeline remain unchanged.
- The current global LightRAG instance and collection-specific direct-vector collections are not yet aligned. Collection scoping and unified ingestion are therefore functional requirements, not merely presentation work.
- Existing collection APIs currently mask some Qdrant failures and the frontend fabricates collection counts. Those behaviors conflict with the Design Constitution's emphasis on confidence and must not survive the drawer redesign.
- The current ingestion route advertises or accepts file types inconsistently. The redesigned UI and API contract must agree on TXT and Markdown only.
- Exact spacing, panel width, cherry-red token, drawer width, and responsive breakpoints are implementation-level decisions governed by `docs/design.md`, comfortable reading length, and the verification widths in this spec.
