# Build the Mementos hand-controlled 3D graph in TouchDesigner (ELI5)

This is a **first-ever TouchDesigner** guide. You will make a live-webcam picture with a small 3D graph drawn on top, then control the *whole graph* with your hands. Build one checkpoint at a time. If a checkpoint fails, fix it before continuing.

> **What this first version is (and is not).** This is *screen AR*: the graph is a 3D object rendered over the webcam image, in front of TouchDesigner's virtual camera. A normal RGB webcam plus hand landmarks cannot know where the real desk is, so the graph will **not** remain bolted to a physical desk when the camera moves. Persistent physical anchoring needs a separate pose source (printed fiducial marker, AR camera, or depth camera) and is deliberately last.

## 0. Tiny vocabulary first

TouchDesigner is a visual-programming application. You create little boxes and wire their outputs into other boxes. A box is an **operator** (often shortened to **OP**). An OP recomputes—**cooks**—when it needs to produce its output.

| Word | Think of it as | Use here |
|---|---|---|
| **Network** | A folder containing wired boxes | Each named section below is a network. |
| **COMP** | A folder/thing in the scene | `graph_source`, `graph_scene`, `interaction`, `output`, `debug`, camera, light, geometry. |
| **DAT** | A spreadsheet or text note | JSON, tables, Python scripts, HTTP and WebSocket messages. |
| **CHOP** | A spreadsheet of changing numbers over time | Hand positions; node positions for instancing. |
| **TOP** | An image or video stream | Webcam, 3D render, final composite. |
| **SOP** | A 3D shape made of points/lines/faces | Sphere shape and graph-edge lines. |
| **MAT** | Paint/material for a 3D object | Node and edge appearance. |
| **Parameter** | A setting on a box | A camera position, URL, scale, or pulse button. |
| **Pulse** | A momentary button press | Manual HTTP refresh and “Set origin.” |
| **Null** | A named, tidy endpoint | Use after important data chains; it changes nothing. |
| **Export/reference** | Let a changing value drive a parameter | Hand data drives `graph_root` transforms. |
| **Instance** | Draw one cheap copy of one shape many times | One sphere shape becomes all graph nodes. |
| **Render TOP** | A virtual camera taking a picture of 3D objects | Produces the graph image. |
| **Composite TOP** | Photoshop-like image layering | Places the rendered graph over the webcam. |
| **External `.tox`** | A separately saved reusable TouchDesigner component | Keeps the large MediaPipe component out of the `.toe`. |
| **`.toe`** | The main TouchDesigner project file | `touchdesigner/mementos-graph.toe`. |
| **`.tox`** | A reusable component file | `touchdesigner/toxes/MediaPipe.tox`. |
| **Normalized coordinate** | A position expressed as a fraction, not pixels | `0..1` hand positions survive resolution changes. |
| **Aspect ratio** | Width divided by height | Webcam, MediaPipe, render, and composite must agree. |
| **Dead zone** | Ignore tiny movement near zero | Stops hand jitter moving the graph. |
| **Dwell / hysteresis** | Require stability; use different on/off thresholds | Stops accidental and flickering gestures. |
| **Snapshot ID** | A version label for one complete graph | Never combine graph data and retrieval results from different labels. |
| **Entity / node** | A named thing and its dot | Has an immutable `id`, `name`, `description`, and `xyz` position. |
| **Relationship / edge** | A connection and its line | Uses `source`, `target`, and `relation_id`; source/target are node IDs. |
| **Lookup table** | A phone book | Resolves an edge ID to exactly one node position. |
| **JSON** | Structured text with named fields | The sidecar's graph response format. |
| **HTTP GET / POST** | “Please show me” / “please do this” web requests | GET `/td/graph`; POST `/td/refresh` rebuilds/retries a dump. |
| **HTTP 200 / 503** | “Here is a good answer” / “service cannot give a complete answer now” | Render a 200 snapshot only; retain old data on 503. |
| **WebSocket** | A web connection that stays open for messages both ways | Sends one retrieval query and receives one complete reply. |
| **API / sidecar / FastAPI** | The local helper web service and its doorbell | `localhost:8000` is TD's data source. |
| **Qdrant / LightRAG** | The vector database / graph-aware retrieval system | They live behind the sidecar; TD never recalculates them. |
| **RAG** | Search over the knowledge graph | The sidecar returns IDs to highlight; TD does not calculate RAG. |
| **Naive / local / global / hybrid** | Four retrieval views | The reply contains ID lists for all four; each still needs a snapshot match. |
| **Ray pick** | Shoot an invisible line through a screen point into 3D | Lets a pinch select the nearest visible node. |
| **Camera-relative** | Positioned relative to the virtual camera | Correct scope for this first build. |
| **Camera pose / anchor** | Camera location/orientation / known real-world reference | Needed for a graph that stays on a physical desk. |
| **Fiducial marker** | A printed high-contrast tracking target | One later option for getting stable camera pose. |
| **AR/depth camera** | A camera that also estimates space/depth | Another later option; ordinary RGB hand tracking is not one. |

## 1. What you need

- TouchDesigner (use the same version as the MediaPipe release/example when possible), an RGB webcam, and enough GPU performance for a 720p webcam stream.
- This repository, Python 3.10+, Docker, Node 20+, and its Qdrant/sidecar dependencies.
- The **current `release.zip`** of [MediaPipe TouchDesigner][mediapipe-release], not its source archive. It includes `MediaPipe.tox` and example projects.

The workplan originally uses 720p because it is a sensible beginner performance target. Recent MediaPipe TouchDesigner releases say their input-resolution parameter can exceed 720p; do not raise it until this guide works reliably at 720p.[^mp-release]

### Run the data service before opening TouchDesigner

From the repository root, in two terminals:

```bash
docker compose -f app/docker-compose.yml up -d

cd sidecar
python -m venv venv
source venv/bin/activate       # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

If `sidecar/graph_dump.json` is absent, use the repository's existing graph-dump workflow, then request `POST http://localhost:8000/td/refresh`. Finally open `http://localhost:8000/td/graph` in a browser. Do not start TD work until it returns JSON containing `entities`, `relationships`, `edges`, `name_to_id`, and `snapshot_id`, with at least one entity and one edge.

**Why:** the sidecar, not TouchDesigner, owns graph layout, cluster decisions, and IDs. TD only displays its complete snapshot.

## 2. Make the smallest healthy TD project

1. Open TouchDesigner and choose **File → New**.
2. Create `touchdesigner/` and `touchdesigner/toxes/` in the repository if absent. Save now as `touchdesigner/mementos-graph.toe`.
3. In the root network, press **Tab**, type `base`, and place five **Base COMPs**. Rename them exactly:
   - `graph_source`
   - `graph_scene`
   - `interaction`
   - `output`
   - `debug`
4. Add a **Null COMP** (the 3D object type, not a Base COMP) named `graph_root` *inside* `graph_scene`. It is the single 3D transform parent that will move and scale every graph object.
5. Save (`Ctrl/Cmd+S`). Reopen the `.toe` once. This proves paths are relative to the project, before the project matters.

**Checkpoint:** You have six plainly named containers and no red error flags.

### Make a one-sphere render before adding real data

Inside `graph_scene`:

1. Add a **Geometry COMP**, rename it `test_node_geo`. Dive inside it and add a **Sphere SOP**. Set its rows/columns low (for example, 12 and 8) so it is visibly low-poly. Turn on that SOP's display and render flags.
2. Back at `graph_scene` level, add a **Camera COMP** named `camera1`, a **Light COMP** named `light1`, and a **Render TOP** named `render_graph`.
3. In `render_graph` parameters, set **Camera** to `camera1` and include the geometry/light as required by your TD build. Put the camera back on Z until the sphere is visible (for example, `tz = 5`; alter only as needed).
4. View `render_graph` by clicking its viewer flag. Use the camera/geometry viewer to inspect the sphere with mouse navigation; do not touch MediaPipe yet.
5. Select `test_node_geo` → **Xform** page. Set **Parent Transform Source** to **Specify Parent Object**, then set **Parent Object** to `../graph_root` (you can drag `graph_root` onto that field). The test sphere should still render. Do not drag the Geometry COMP onto `graph_root`: that offers unrelated parameter-drop choices, not 3D parenting.

**Checkpoint:** You can see one lit sphere in `render_graph`, save, close, and reopen without an error.

## 3. Build a safe graph refresh (do this before 3D graph work)

The critical rule: **a failed or partial refresh must not erase a good graph already on screen.** The bridge returns HTTP 503 when it cannot make a complete snapshot; retain the last complete tables then.[^bridge]

### 3.1 Request the graph only on a button press

Inside `graph_source`:

1. Add a **Web Client DAT** called `get_graph`.
2. Set **Request Method** to `GET`, **URL** to `http://localhost:8000/td/graph`, and set a sensible timeout (for example 5000 ms). The Web Client DAT's `Request` parameter is a pulse: it sends one request; it is not a per-frame poll.[^web-client]
3. Add a **Button COMP** named `refresh_graph`. In its button callback (or a small connected DAT), pulse `op('get_graph').par.request`.
4. Add two **Table DATs** named `nodes_table` and `edges_table`; give them only headers for now:

```text
# nodes_table
id	x	y	z	name	description

# edges_table
source	target	relation_id
```

5. Add a **Text DAT** called `status_text`. It is your plain-English status note, not a data source.

### 3.2 Validate first, then replace both tables together

Add a **DAT Execute DAT** that watches `get_graph`, or call a helper function from the Web Client callback. Put the following minimal Python in a Text DAT named `graph_refresh` and invoke `applyGraphResponse(op('get_graph').text)` only when the request completes. (The exact callback function name differs by TD version; leave the parsing function unchanged.)

```python
import json

def applyGraphResponse(text):
    try:
        payload = json.loads(text)
        required = ('entities', 'edges', 'name_to_id', 'snapshot_id')
        if not isinstance(payload, dict) or not all(key in payload for key in required):
            raise ValueError('response is not a complete graph snapshot')

        rows = [['id', 'x', 'y', 'z', 'name', 'description']]
        ids = set()
        scale = float(parent().par.Graphscale.eval())
        for entity in payload['entities']:
            xyz = entity.get('xyz')
            entity_id = entity.get('id')
            if not entity_id or not isinstance(xyz, list) or len(xyz) != 3:
                raise ValueError('entity lacks id or xyz[3]')
            ids.add(entity_id)
            rows.append([entity_id, *(float(v) * scale for v in xyz),
                         entity.get('name', ''), entity.get('description', '')])

        edge_rows = [['source', 'target', 'relation_id']]
        missing = 0
        for edge in payload['edges']:
            source, target = edge.get('source'), edge.get('target')
            if source in ids and target in ids:
                edge_rows.append([source, target, edge.get('relation_id', '')])
            else:
                missing += 1

        # Only now mutate the rendered data: this is the atomic swap.
        nodes, edges = parent().op('nodes_table'), parent().op('edges_table')
        nodes.clear(); nodes.appendRows(rows)
        edges.clear(); edges.appendRows(edge_rows)
        parent().store('renderedSnapshotId', payload['snapshot_id'])
        parent().store('missingEdgeCount', missing)
        parent().op('status_text').text = 'OK: snapshot {} ({} nodes, {} valid edges; {} discarded)'.format(
            payload['snapshot_id'], len(rows) - 1, len(edge_rows) - 1, missing)
    except Exception as exc:
        # Deliberately do not clear the tables.
        parent().op('status_text').text = 'Refresh failed; keeping last graph: {}'.format(exc)
```

Create a custom float parameter called `Graphscale` on `graph_source` (start at `1`), or replace that one reference with a fixed `1.0` temporarily. The important part is that **all three xyz axes receive the same project-level scale**—never rewrite the source coordinates.

> ELI5: the function builds new lists on the workbench first. Only after every piece is good does it replace the two public spreadsheets. If something breaks, it throws away the unfinished workbench copy and leaves the old picture alone.

Add a Text DAT in `debug` that displays `graph_source.fetch('renderedSnapshotId', 'none')`, node/edge counts, `missingEdgeCount`, and `status_text`. Record the snapshot ID and counts after a successful refresh.

**Checkpoint:** Press Refresh: tables fill and the debug status says OK. Stop the sidecar, press Refresh again: the old table contents remain and the debug text says the refresh failed.

## 4. Draw the complete graph in 3D

Do nodes first, then edges. Do not add hands until you can inspect every edge with the mouse.

### 4.1 Nodes: one sphere, many instances

1. Inside `graph_scene`, add a low-poly **Sphere SOP** named `node_shape`.
2. Add a **Geometry COMP** called `nodes_geo`; put or reference `node_shape` inside it and assign a simple **Phong MAT** (or Constant MAT for an unlit first test).
3. Convert `graph_source/nodes_table` to usable numeric data with a **DAT to CHOP** named `node_positions`. Configure it to use headers and select `x y z` (and later `r g b size` if you add them).
4. On `nodes_geo` → **Instance** page:
   - turn **Instancing** on;
   - set **Default Instance OP** to `node_positions`;
   - select the x, y, z channels for **Translate X/Y/Z**;
   - choose **Instance OP(s) Length** so the table/CHOP length controls node count.

A Geometry COMP can use DAT rows or CHOP channels to drive instance attributes. It makes GPU copies of the one sphere instead of creating one Geometry COMP per entity.[^geometry]

5. On `nodes_geo` → **Xform**, set **Parent Transform Source** to **Specify Parent Object** and **Parent Object** to `../graph_root`.
6. For deterministic node colour, derive RGB from a stable hash of the entity **ID** during the parse step, add `r/g/b` columns, and map them to the Geometry COMP's instance colour attributes. Do **not** add clustering/Louvain in TD: the current bridge does not return clusters.

### 4.2 Edges: join each validated source/target pair

Each edge is just two points joined by a straight line. A **Line SOP** has point A and point B XYZ parameters; use it for a one-edge proof first.[^line-sop]

For the actual graph, make a short Script SOP/Python builder that reads the already validated `nodes_table` and `edges_table`, makes two points for each edge, and emits one two-point line primitive per edge. The key rule is simple:

```text
for each edge: look up source position by source ID
               look up target position by target ID
               make a line from source to target
```

Never look up by displayed name: two entities may share a name. Never emit a line if either ID is absent—those were counted and discarded at refresh time.

Put the line SOP in a Geometry COMP named `edges_geo`, give it a simple faint Constant/Phong MAT, then set `edges_geo` → **Xform** → **Parent Transform Source** to **Specify Parent Object** and **Parent Object** to `../graph_root`. Add `nodes_geo` and `edges_geo` to `render_graph`'s geometry list if your TD version needs explicit lists.

**Checkpoint:** Every edge endpoint touches its intended node. Move `graph_root` once and both nodes and edges move together. Mouse-inspect the scene before proceeding.

### 4.3 Selection and label, without changing graph truth

Keep manual selection in one stored value, `selectedEntityId`. When its ID matches an instance row, make that node a little bigger and brighter; use base size/colour for all others. Add a **Text TOP** (for a final image overlay) or Text COMP to show selected node `name` and `description`. It is display state only: do not alter `nodes_table` or IDs.

For a pinch hit-test, use TouchDesigner's **Render Pick DAT** or **Render Pick CHOP** against the rendered geometry. Pass the normalized pinch screen position, choose the nearest returned node/instance, then store its entity ID. Render picking is preferable to guessing which 3D node is “near” a 2D finger because it uses the camera view and visible rendered geometry.[^render-pick]

**Checkpoint:** Select one known test node. It grows/brightens and its label is correct.

## 5. Add webcam and MediaPipe only after the graph renders

### 5.1 Install and prove the plugin separately

1. Download and unzip the MediaPipe TouchDesigner **release**.
2. Open its supplied example `.toe` *before touching Mementos*.
3. Select the webcam in the MediaPipe component, enable only hand tracking, and confirm the video TOP plus hand-tracking outputs work. The plugin's README says its main tox launches a Chromium-hosted MediaPipe task and supplies each task's data plus a video/overlay TOP.[^mp-readme]
4. Copy `MediaPipe.tox` to `touchdesigner/toxes/` and add it inside `interaction` as `mediapipe`.
5. On the COMP's **Common** page, enable **External .tox** and set its external path to `toxes/MediaPipe.tox` (relative to the `.toe`). This is not cosmetic: the release notes say the tox is 500 MB+, and embedding it makes saves large and slow.[^mp-release]
6. Configure the camera at 1280×720 initially, and keep the same aspect ratio through camera, MediaPipe, render, and composite. If your camera cannot supply that size, choose one smaller supported size consistently.

**Checkpoint:** The MediaPipe example and then `interaction/mediapipe` each show your live camera. One hand produces live data before you wire it to controls.

### 5.2 Use the plugin's decoded hand output, not guessed landmark indexes

Place the release's supplied `hand_tracking.tox`/example decoder inside `interaction` and connect it exactly as its example does. Inspect its output CHOP in the viewer. Use its normalized, aspect-correct hand/landmark data and its hand-active/pinch outputs; do **not** assume pixel coordinates or hard-code a landmark channel number.

This matters because MediaPipe's underlying hand landmarker uses normalized image coordinates, while the TouchDesigner plugin has changed its output layouts over releases.[^mp-hands] The plugin release notes specifically provide normalized, aspect-correct hand `instance_data`, an `active` channel, entry/exit velocity gating, and pinch midpoint/position/rotation/distance outputs.[^mp-release]

Wire the decoder into:

```text
hand decoder → Filter CHOP → dead-zone/math branch → hand_state Null CHOP
```

- Begin with a modest Filter CHOP smoothing value. Adjust it under your actual lighting/camera, not by theory.
- Apply the dead zone after you subtract an origin, not before. A dead zone means: if the delta is tiny, output zero.
- Keep a debug branch that renders landmark dots or the plugin overlay until all gestures are stable.
- Map one axis at a time. Image Y usually increases downward; do the one needed Y inversion **once**, at this input boundary, and document it there.

**Checkpoint:** The final camera image and overlay line up, and one hand yields stable normalized data with no resolution-dependent offset.

## 6. Put the 3D graph over the camera feed

Inside `output`:

1. Bring in the camera TOP from MediaPipe using a **Select TOP** (or the plugin's video output).
2. Bring in `graph_scene/render_graph` with another Select TOP.
3. Make their resolutions/aspect ratio equal. A Resolution TOP can make the render match the camera if required.
4. Add a **Composite TOP**. Put the camera on input 0 and the graph render (with transparent background) on input 1; use an over-style operation. Add the selection Text TOP afterward in a second Composite TOP.
5. Add a Null TOP named `final_output` and view it.

Position `graph_root` at a fixed virtual depth in front of `camera1`. It is an ordinary 3D object in the render camera's space; that is why it stays visually coherent in the camera image. It still is not physically anchored in the room.

### Add the one-time origin button

Add a Button COMP named `set_origin`. When pressed while a hand is active, store:

- `handOrigin`: the current filtered palm x/y(/z) values;
- `graphOrigin`: current `graph_root` translate and uniform scale.

For every later hand position calculate `handDelta = currentHand - handOrigin`. Map that delta to `graph_root`, **not individual nodes**. Test right, then up, then toward/away separately; fix an inverted axis once at the boundary.

**Checkpoint:** The graph is visibly over the webcam and after setting origin, moving a hand right moves the whole graph right on screen.

## 7. Add exactly three hand controls

Every control must be disabled when no active hand exists and must have a short stable dwell (start around 0.15–0.25 seconds, then tune with the real camera). Do not add rotation, physics, or a fourth gesture.

### A. Open palm moves the graph

1. Use the decoder/plugin's open-palm state if it supplies one; otherwise use its established gesture output rather than reimplementing 21-landmark geometry.
2. When `hand_active AND open_palm AND dwell_ready`, apply the calibrated palm delta to `graph_root.tx` and `.ty`.
3. When the hand is lost, stop changing the transform. Do not reset or jump the graph.

**Pass test:** move it ten times without it drifting while no hand is detected.

### B. Pinch selects a node

1. Take the plugin's pinch active value/distance and set two thresholds: e.g. start when distance is below `startThreshold`; release only when above a larger `endThreshold`. That gap is hysteresis.
2. Turn this into one **pinch-start edge** with a CHOP Execute DAT's **Off to On** callback. A CHOP Execute DAT runs a callback when a watched channel switches state, so it prevents selection every frame.[^chop-execute]
3. At pinch start only, use the normalized pinch midpoint/position with Render Pick. Store the nearest hit node's ID in `selectedEntityId`.
4. Preserve selection until the next successful pinch; do not clear it just because tracking is momentarily lost.

**Pass test:** ten deliberate pinches choose only the intended node; holding a pinch does not repeatedly select.

### C. Two pinching hands scale the graph

1. Only begin when **both** hand-active values and **both** pinch values are stable.
2. At that moment store `startPinchDistance` and `startGraphScale`.
3. While both remain pinching, calculate:

```text
newScale = clamp(startGraphScale * currentDistance / startPinchDistance,
                 minimumScale, maximumScale)
```

4. If either hand disappears or releases, freeze current scale and require a fresh two-hand start. Do not recalculate a starting distance mid-gesture.

**Pass test:** scale ten times; add/remove a hand without a jump.

## 8. Add retrieval highlights without ID drift

Do this last. It is a separate visual layer from manual selection.

1. In `graph_source` add a **WebSocket DAT** set to host `localhost`, port `8000`, path `/ws/retrieval` (or the equivalent full address `ws://localhost:8000/ws/retrieval` in your TD version). A WebSocket DAT appends received packets to its FIFO table and can call a callback DAT for each message.[^websocket]
2. Send **one query string only after connected**. Do not send per frame.
3. Parse one reply as a complete answer with four modes: `naive`, `local`, `global`, `hybrid`.
4. Before applying any IDs, require:

```python
reply['snapshot_id'] == parent().fetch('renderedSnapshotId', None)
```

5. If unequal, refresh `/td/graph`; only apply a retrieval reply that matches the newly rendered snapshot. Clear the *previous retrieval highlight* before applying the new matching one. Keep `selectedEntityId` separate so a manual selection survives.
6. Highlight by returned `entity_ids` and `relation_ids`, never by visible entity name.

The sidecar guarantees a query response is resolved against one whole snapshot; TD must make the same snapshot check before display.[^bridge]

**Checkpoint:** A query highlights known IDs. Force a graph refresh: old retrieval IDs never highlight the new snapshot.

## 9. Final real-world checklist

Run in this order, in one session:

1. Start sidecar and TD; load a graph.
2. Stop sidecar; refresh; old graph remains and debug reports the error.
3. Restart sidecar; refresh; debug shows a new/current snapshot ID.
4. Try supported camera aspect ratios; image and hand controls still line up.
5. One hand: open-palm move; pinch-select a known node.
6. Two hands: pinch-distance scale; remove one hand; scale freezes.
7. Send a retrieval query; only matching snapshot IDs highlight.
8. Save/close/reopen; repeat 1, 5, and 7 without rewiring.

## 10. Later only: attach the graph to a real desk/wall

Do not claim this is included above. If the first-product checklist passes and physical anchoring is truly needed:

1. Choose exactly one anchor source: printed fiducial marker + pose estimate **or** an AR/depth camera with camera pose.
2. Produce one stable anchor transform in camera coordinates.
3. Parent `graph_root` under the anchor transform. Keep a child transform for hand manipulation, so anchoring and user offset are separate.
4. On lost anchor, freeze its last good transform, show **“anchor lost”**, and require reacquisition. Never snap to a new guessed position.
5. Measure alignment by moving the camera around the actual anchor; agree a tolerance before calling it done.

## Sources and why they matter

- [TouchDesigner: Web Client DAT][web-client] — request methods, explicit request pulse, response/status information.
- [TouchDesigner: WebSocket DAT][websocket] — received-message table and callback behavior.
- [TouchDesigner: Geometry COMP][geometry] — rendering, transforms, instancing, instance count, and external `.tox` parameters.
- [TouchDesigner: Line SOP][line-sop] — a line is defined by point A and point B.
- [TouchDesigner: CHOP Execute DAT][chop-execute] — reliable off-to-on gesture edge.
- [TouchDesigner: Render Pick DAT][render-pick] — screen-to-rendered-geometry selection.
- [MediaPipe TouchDesigner README][mp-readme] and [release notes][mp-release] — official plugin setup, external tox rationale, and hand-output changes/features.
- [MediaPipe Hand Landmarker][mp-hands] — landmark and normalized-coordinate model facts.
- [`sidecar/TD_BRIDGE.md`](../sidecar/TD_BRIDGE.md) — this repository's authoritative graph snapshot and retrieval contract.

[web-client]: https://docs.derivative.ca/Web_Client_DAT
[websocket]: https://docs.derivative.ca/WebSocket_DAT
[geometry]: https://docs.derivative.ca/Geometry_COMP
[line-sop]: https://docs.derivative.ca/Line_SOP
[chop-execute]: https://docs.derivative.ca/CHOP_Execute_DAT
[render-pick]: https://docs.derivative.ca/Render_Pick_DAT
[mediapipe-release]: https://github.com/torinmb/mediapipe-touchdesigner/releases/latest
[mp-readme]: https://github.com/torinmb/mediapipe-touchdesigner
[mp-release]: https://github.com/torinmb/mediapipe-touchdesigner/releases
[mp-hands]: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker

[^bridge]: Repository-local contract: [`sidecar/TD_BRIDGE.md`](../sidecar/TD_BRIDGE.md).
[^web-client]: [Web Client DAT documentation][web-client].
[^websocket]: [WebSocket DAT documentation][websocket].
[^geometry]: [Geometry COMP documentation][geometry].
[^line-sop]: [Line SOP documentation][line-sop].
[^chop-execute]: [CHOP Execute DAT documentation][chop-execute].
[^render-pick]: [Render Pick DAT documentation][render-pick].
[^mp-readme]: [MediaPipe TouchDesigner README][mp-readme].
[^mp-release]: [MediaPipe TouchDesigner releases][mp-release].
[^mp-hands]: [MediaPipe Hand Landmarker][mp-hands].
