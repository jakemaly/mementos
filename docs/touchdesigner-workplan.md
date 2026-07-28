# TouchDesigner build instructions

Build this in order. Do not start the next step until its **Done when** check passes.

## Product boundary

This project already supplies a complete graph scene. TouchDesigner must render and control it; it must **not** recompute graph layouts, clusters, or RAG IDs.

The first working product is a camera-composited, camera-relative 3D graph: the graph is rendered over the live camera feed and controlled by hands. A normal RGB webcam plus MediaPipe does **not** know its own position in a room, so it cannot keep the graph fixed to a physical desk while the camera moves. Treat persistent world anchoring as a later, separate camera-pose feature (for example, a tracked printed marker or an AR/depth camera). Do not promise it in the first build.

## 1. Establish the sidecar contract

1. Start Qdrant and the sidecar from the repository root instructions in `README.md`.
2. Ensure `sidecar/graph_dump.json` exists. If it does not, run the graph-dump workflow already used by the sidecar, then call `POST http://localhost:8000/td/refresh`.
3. Open `http://localhost:8000/td/graph`. It must return `entities`, `relationships`, `edges`, `name_to_id`, and `snapshot_id`.
4. Record the current `snapshot_id` and entity/edge counts in a Text DAT for debugging.

**Done when:** `/td/graph` returns HTTP 200 and the returned graph has at least one entity and one edge.

## 2. Create a small, externalized TD project

1. Create `touchdesigner/mementos-graph.toe`.
2. Put reusable network components in `touchdesigner/toxes/` and enable **External .tox** when adding the MediaPipe component. Do not embed the MediaPipe tox in the `.toe`.
3. Use these top-level containers only:
   - `graph_source` — requests and validates the graph snapshot.
   - `graph_scene` — graph geometry, materials, lights, and camera.
   - `interaction` — MediaPipe hand input and gesture state.
   - `output` — camera composite and final render.
4. Add one `debug` container with visible text for API status, snapshot ID, entity count, hand state, and selected entity ID.
5. Save after every working milestone. Keep the first scene intentionally small: one sphere, one line, one camera, one render.

**Done when:** reopening the `.toe` retains external tox paths and produces a blank but error-free render.

## 3. Ingest graph snapshots safely

1. In `graph_source`, use a Web Client DAT to request `GET http://localhost:8000/td/graph` on an explicit refresh pulse; do not replace the scene every frame.
2. Parse only a successful, complete JSON object. Build lookup tables keyed by entity `id`:
   - nodes: `id`, `x`, `y`, `z`, `name`, `description`
   - edges: `source`, `target`, `relation_id`
3. Take coordinates from each entity's `xyz` array. Scale all three axes by one project-level `graphScale` parameter; do not change the source data.
4. Use `edges` as the renderable relationship list. Resolve their `source` and `target` against the node lookup; discard an edge whose endpoint is absent and show its count in `debug`.
5. Keep the last known-good tables when the request fails or returns HTTP 503. Never clear the rendered scene for a failed refresh.
6. Replace node and edge tables atomically only after the entire new response validates. Store its `snapshot_id` as `renderedSnapshotId`.
7. Trigger refresh after an insertion succeeds (its response includes `graph_snapshot_id`), or manually from a button. Do not add a polling loop until manual refresh is reliable.

**Done when:** a refresh changes the scene only after a valid response; stopping the sidecar leaves the last graph visible with a clear error status.

## 4. Render the graph before adding interaction

1. Turn the node table into position channels with DAT to CHOP and render one low-poly sphere through Geometry COMP instancing. Map position to `tx`, `ty`, and `tz`.
2. Use a fixed, deterministic color derived from each entity ID. Do not add Louvain clustering in TD: the current bridge does not return clusters.
3. Build edge line geometry from the validated edge table. Each line must join the two resolved node positions.
4. Put nodes and edges in the same `graph_root` parent COMP so a single transform moves and scales the complete graph.
5. Add a Perspective Camera, one light, and a Render TOP. Confirm the graph can be inspected with mouse navigation before MediaPipe is connected.
6. Add simple selection state: unselected nodes use base size/color; the selected node is larger and brighter. Keep a Text TOP or panel overlay for its name and description.

**Done when:** every valid edge reaches its intended node, and selecting a test node visibly highlights it and shows its metadata.

## 5. Add the live camera and MediaPipe hand tracking

1. Download the current release of [MediaPipe TouchDesigner](https://github.com/torinmb/mediapipe-touchdesigner). It supports Mac and Windows and uses its included MediaPipe component; do not rebuild its browser/plugin stack.
2. Open its example `.toe` first. Select the webcam, enable hand tracking, and confirm its video TOP and hand-tracking outputs work before copying anything into Mementos.
3. Keep camera input at a supported resolution (the project documentation specifies up to 720p). Use the same aspect ratio for the camera TOP, MediaPipe, and final composite.
4. Add the external `MediaPipe.tox` to `interaction`. Enable only hand tracking initially. Feed its video TOP to `output` as the background.
5. Add the repository's hand-tracking tox/example decoder and inspect its channels. Use the provided normalized, aspect-correct hand/landmark output; do not assume pixel coordinates or hard-code channel positions.
6. Route the decoded channels through a Filter CHOP and a dead zone. Set the smoothing by testing with the real camera, not by guessing values.
7. Display hand landmarks or the plugin overlay in a debug branch until gesture values are stable.

**Done when:** the final output shows the live camera feed and a single hand produces stable, normalized tracking data without visible coordinate offset.

## 6. Establish the camera-relative placement

1. Composite the Render TOP over the camera TOP only after both have the same resolution and aspect ratio.
2. Put `graph_root` at a fixed virtual depth in front of the TD render camera. This creates the initial screen-AR placement: the graph appears inside the camera image and remains coherent as a 3D object.
3. Add a one-time **Set origin** button. It stores the current hand palm position as `handOrigin` and the current `graph_root` transform as `graphOrigin`.
4. Convert later hand positions to deltas from `handOrigin`; apply these deltas to `graph_root`, not individual nodes. Invert Y once at the coordinate-boundary if the image coordinate system requires it.
5. Verify the graph does not mirror unexpectedly by moving a hand right, up, and toward/away from the camera one axis at a time.

**Done when:** the graph is visibly placed over the camera feed and a calibrated hand delta moves the entire graph in the expected screen direction.

## 7. Add only three reliable hand controls

Implement these controls in this order. Each control must require a stable gesture for a short dwell time and must be disabled while hand tracking is inactive.

1. **Open palm = move.** While an open palm is active, map palm delta from the calibrated origin to `graph_root` X/Y translation. Do not move the graph when no hand is detected.
2. **Pinch = select.** On a pinch-start edge, cast from the screen-space pinch position into the rendered graph, select the nearest hit node, and keep the selection until the next pinch. Use a minimum pinch distance plus hysteresis so it does not flicker.
3. **Two-hand pinch distance = scale.** When both hands are actively pinching, map their distance relative to the starting distance to a clamped uniform `graph_root` scale. Do not add rotation until these three controls are dependable.

Use the plugin's hand-active and pinch data if present. Its release notes specifically call out pinch midpoint, position, rotation, distance, active-hand channels, and velocity gating—reuse those outputs rather than reimplementing landmark math.

**Done when:** each action can be repeated ten times without accidental movement, accidental selection, or a scale jump when a hand enters/exits the frame.

## 8. Connect retrieval highlights without ID drift

1. Add a WebSocket DAT to `ws://localhost:8000/ws/retrieval`.
2. Send one query string only after the socket is connected. Treat each reply as a complete result for the four modes: `naive`, `local`, `global`, and `hybrid`.
3. Before applying a reply, require `reply.snapshot_id == renderedSnapshotId`. If they differ, refresh `/td/graph`; only then apply a matching retrieval reply.
4. Highlight returned `entity_ids` and `relation_ids` by their graph IDs. Do not join by visible name.
5. Clear the prior retrieval highlight before applying the next matching result, while preserving manual selection as a separate visual state.

**Done when:** a query highlights known nodes and edges; forcing a graph refresh never highlights IDs from the previous snapshot.

## 9. Test the complete first product

Run this checklist with the real camera and sidecar:

1. Start the sidecar and TD; load the graph.
2. Stop the sidecar; verify the last graph remains rendered and TD reports an error.
3. Restart it; refresh and verify the new snapshot ID is shown.
4. Move the camera feed through different aspect ratios supported by the camera; verify hand controls still line up with the picture.
5. With one hand, move the graph with open palm and select one node with pinch.
6. With two hands, scale the graph; remove one hand and verify scale freezes rather than jumping.
7. Send a retrieval query; verify only the matching snapshot receives highlights.
8. Save, close, and reopen the `.toe`; repeat steps 1, 5, and 7.

**Done when:** all eight checks pass in one session without manual rewiring.

## 10. Add persistent real-world anchoring only after the above works

The first product is camera-relative. If the graph must stay attached to a desk, wall, or printed object while the camera moves, add a separate camera-pose system:

1. Choose one physical anchor and one technology: a printed fiducial marker with pose estimation, or an AR/depth camera that exposes camera pose. Do not attempt this with hand landmarks alone.
2. Produce one stable anchor transform in camera coordinates.
3. Parent `graph_root` under that anchor transform; keep the hand-control transform as a child offset so the anchor and user manipulation remain separate.
4. Add explicit lost-tracking behavior: freeze the last anchor pose, show “anchor lost,” and require reacquisition rather than snapping the graph.
5. Test by moving the camera around the physical anchor; the graph should remain aligned to it within an agreed tolerance.

**Done when:** the graph remains attached to the chosen physical reference while the camera moves, and loss/reacquisition is predictable.

## Guardrails

- `touchdesigner_integration.md` describes an earlier proposed bridge. The current, implemented contract is `sidecar/TD_BRIDGE.md`; follow it for snapshot and retrieval behavior.
- Do not add PCA, spring layouts, clustering, or new sidecar endpoints for the TD build. The existing dump already contains `xyz` coordinates and IDs.
- Do not make the camera feed or MediaPipe output the source of graph truth. The FastAPI sidecar owns graph snapshots.
- Keep all coordinate conversion in one place. Document the source and destination axes there before changing it.
- Add rotation, physics, multi-user controls, and persistent world anchoring only after the first product checklist passes.
