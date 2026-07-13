# TouchDesigner 3D Graph Visualization Layer for LightRAG & Qdrant

This document details the research findings, design decisions, and implementation plan for bridging the project's LightRAG knowledge graph and Qdrant vector database with **TouchDesigner** to create an interactive 3D spatial visualization of note clusters, nodes, and semantic linkages.

---

## 1. Analysis of Current Repository State

Our research reveals the following architecture currently running in this repository:

1. **Python FastAPI Sidecar (`sidecar/main.py`)**:
   - Runs on `http://localhost:8000`.
   - Exposes `/health`, `/insert` (ingestion), and `/query` (naive, local, global, hybrid RAG query modes).
   - Dynamically initializes and manages `lightrag-hku` with a local `sentence-transformers` embedding engine (`all-MiniLM-L6-v2`, 384-dimensional).

2. **Qdrant Vector Storage**:
   - Runs locally in Docker on `http://localhost:6333`.
   - Stores embeddings in three distinct collections:
     - `lightrag_vdb_chunks_all_minilm_l6_v2_384d` (18 active chunk points found).
     - `lightrag_vdb_entities_all_minilm_l6_v2_384d` (currently 0 points; holds entity embeddings once extracted by LLM).
     - `lightrag_vdb_relationships_all_minilm_l6_v2_384d` (currently 0 points; holds relationship embeddings once extracted).

3. **NetworkX Graph Storage**:
   - Configured as the underlying graph engine (`NetworkXStorage`).
   - Persists a local graph representation under `sidecar/data/graph_chunk_entity_relation.graphml` (an XML-based GraphML format containing the topological linkages and properties).

---

## 2. TouchDesigner Capabilities & Data Interface

**TouchDesigner** is a node-based visual programming language designed for real-time interactive 3D applications, installations, and motion graphics. It operates using several operator families that map directly to our needs:

### A. Supported Operator Families for Data Ingestion
* **DATs (Data Operators)**: Operate on text, JSON, tables, and XML.
  - **Web Client DAT**: Can fetch data from a REST API (like our FastAPI sidecar) periodically or via user triggers.
  - **WebSocket DAT**: Receives a real-time stream of coordinates and event triggers.
  - **Script DAT / Script SOP**: Allows running native Python scripts inside TouchDesigner to parse incoming JSON data and construct coordinates or geometry.
* **CHOPs (Channel Operators)**: Handle time-series and multi-channel numerical values (e.g. `tx`, `ty`, `tz` coordinates, `r`, `g`, `b` colors, `scale`).
  - Essential for **Geometry Instancing**, which feeds GPU-instanced geometry (e.g. thousands of spheres or points) with coordinate channels for highly performant real-time rendering.
* **SOPs (Surface Operators)**: Handle 3D geometry (points, lines, meshes).
  - **Add SOP**: Draw lines (edges) between specified point indices.
  - **Script SOP**: Programmatically build lines using Python.

### B. Optimal Visual Representation Strategies
1. **Nodes (Concepts & Entities)**: Visualized as 3D spheres. 
   - Managed via **Geometry Instancing**. The coordinates ($X, Y, Z$), size, and colors are fed to a Geometry COMP via CHOP channels derived from a Node Table DAT.
2. **Edges (Relationships & Linkages)**: Visualized as lines connecting spheres.
   - Rendered using a **DAT to SOP** operator in "Connect Points" mode, using a Vertex table (X, Y, Z coordinates) and a Polygon/Index table (specifying which vertices are connected), OR programmatically via a Python-driven **Script SOP**.
3. **Interactive Control**:
   - TouchDesigner can track mouse positions or camera rotations. 
   - A **Panel CHOP** can be used to select (hover/click) a node, which sends the node ID back to the FastAPI sidecar via a GET request to retrieve detailed metadata (e.g. node description, linked notes, or document content).

---

## 3. Bridge Layer Design & Mathematical Hypothesis

We need a bridge layer that translates 384-dimensional semantic embeddings (from Qdrant) and topological graph linkages (from NetworkX) into a 3D coordinate system ($X, Y, Z$) and cluster groupings that TouchDesigner can ingest.

We propose implementing this bridge layer directly in the **Python FastAPI sidecar**, exposing new endpoints optimized for TouchDesigner.

```mermaid
flowchart TD
    subgraph Qdrant_DB [Qdrant Vector DB]
        V_Chunk[Chunks Vectors]
        V_Entity[Entities Vectors]
    end
    
    subgraph NetworkX_Local [NetworkX Graph]
        GML[graph_chunk_entity_relation.graphml]
    end

    subgraph Sidecar_Bridge [FastAPI Sidecar Bridge Layer]
        API_TD[/td/graph] --> Extract[Extract Nodes & Edges]
        Extract --> Cluster[Louvain Clustering]
        Extract --> PCA[SVD/PCA Coordinate Projection]
        Extract --> Spring[NetworkX 3D Spring Layout]
        PCA & Spring --> Hybrid[Hybrid Coordinate Mapping]
    end

    subgraph TouchDesigner_App [TouchDesigner 3D App]
        WebClient[Web Client DAT]
        Parse[Script DAT / Python Parser]
        NodeTable[Node DAT Table]
        EdgeTable[Edge DAT Table]
        
        NodeTable --> DAT_to_CHOP[DAT to CHOP]
        DAT_to_CHOP --> GeoInstance[Geometry COMP Node Instancing]
        
        EdgeTable --> ScriptSOP[Script SOP / Add SOP Edge Rendering]
    end

    Qdrant_DB --> Extract
    NetworkX_Local --> Extract
    Sidecar_Bridge -- JSON over HTTP --> WebClient
```

### A. Dimensionality Reduction (384D to 3D Space)
To place entities in 3D space, we must map 384-dimensional embedding vectors to 3D coordinates ($X, Y, Z$). We propose three visual layouts:

1. **Topological Layout (Spring)**:
   - Uses NetworkX's 3D Fruchterman-Reingold force-directed layout (`nx.spring_layout(G, dim=3)`).
   - *Result*: Nodes with many linkages cluster in the center; unrelated nodes are pushed to the periphery. Good for structural visualization.

2. **Semantic Layout (PCA)**:
   - We extract the 384-dim entity embeddings from Qdrant, construct an $N \times 384$ matrix, and apply Principal Component Analysis (PCA) via SVD (Singular Value Decomposition) in NumPy to project it to 3D.
   - SVD code is extremely lightweight and fast:
     ```python
     X_centered = X - np.mean(X, axis=0)
     _, _, Vt = np.linalg.svd(X_centered, full_matrices=False)
     coords_3d = np.dot(X_centered, Vt[:3].T)
     ```
   - *Result*: Nodes that are semantically similar (even if not explicitly connected in the graph) group together in 3D space.

3. **Hybrid Layout (Recommended)**:
   - Calculate initial $X, Y, Z$ positions using PCA (semantic embeddings).
   - Feed these coordinates as the `pos` argument into `nx.spring_layout(G, pos=initial_pos, iterations=15)`.
   - *Result*: The layout starts in semantic clusters, then runs force-directed wiggling to align topological connections. This provides the best of both worlds.

### B. Community Clustering (Color Mapping)
To assign visual colors to node groups, we will run **Louvain Community Detection** (built into NetworkX) on the Python side:
```python
import networkx.community as nx_comm
communities = nx_comm.louvain_communities(G)
# Output: list of sets. Map each node to its community index (0, 1, 2, ...).
```
We pass these cluster IDs in the JSON. TouchDesigner reads these IDs and maps them to a color palette (using a Lookup CHOP or basic Python dictionary mapping).

### C. Live RAG Query Path Highlighting
When a user performs a RAG query on the frontend dashboard or inside TouchDesigner:
1. The sidecar executes `rag.query()`.
2. We identify the retrieved nodes and edges (either by checking cosine similarity of the query embedding to all entities, or parsing LightRAG's returned context).
3. The sidecar returns the RAG response *and* a list of `active_node_ids`.
4. TouchDesigner uses these IDs to animate (e.g. glow or scale up) the retrieved concepts, visually displaying the reasoning path of the model in 3D.

---

## 5. Proposed API Contract for TouchDesigner

We will expose the following new endpoints in `sidecar/main.py`:

### 1. GET `/td/graph`
Returns all nodes and edges with coordinates, clustering, and sizes.

* **Query Parameters**:
  - `layout`: `hybrid` (default), `spring`, or `pca`
  - `scale`: Numeric multiplier for scaling the 3D space (default: `10.0`)
* **Response Format**:
  ```json
  {
    "nodes": [
      {
        "id": "entity::artificial_intelligence",
        "name": "Artificial Intelligence",
        "type": "concept",
        "x": 2.45,
        "y": -1.12,
        "z": 0.89,
        "cluster": 2,
        "size": 6,
        "description": "The study of agents that receive percepts from the environment..."
      }
    ],
    "edges": [
      {
        "source": "entity::artificial_intelligence",
        "target": "entity::machine_learning",
        "type": "contains",
        "weight": 1.0
      }
    ]
  }
  ```

### 2. POST `/td/query`
Executes a RAG query and returns the answer alongside the graph components to highlight.

* **Request Format**:
  ```json
  {
    "query": "What is the relationship between Rayleigh scattering and the sky?",
    "mode": "hybrid"
  }
  ```
* **Response Format**:
  ```json
  {
    "answer": "The sky is blue because of Rayleigh scattering...",
    "mode": "hybrid",
    "highlight_nodes": [
      "entity::rayleigh_scattering",
      "entity::sky",
      "entity::blue_color"
    ],
    "highlight_edges": [
      {"source": "entity::rayleigh_scattering", "target": "entity::sky"}
    ]
  }
  ```

---

## 6. Phase-by-Phase Implementation Plan

### Phase 1: Python Bridge Extensions (Sidecar)
1. **Install NumPy**: Add `numpy` to `sidecar/requirements.txt`.
2. **Add Layout Utility**: Create a layout computation utility in `sidecar/main.py` that loads the NetworkX graph, calculates Louvain communities, and performs SVD projection / Spring layout.
3. **Expose Endpoints**: Create the `GET /td/graph` and `POST /td/query` routes.
4. **Validation**: Test endpoints using manual curl requests to ensure valid JSON payload formats and that coordinate numbers are non-NaN.

### Phase 2: TouchDesigner Project Setup
1. **Network Ingest**: 
   - Place a **Web Client DAT** configured to poll `http://localhost:8000/td/graph` every 2 seconds (or trigger manually).
2. **Parsing**:
   - Write a python script callback in the Web Client DAT to split the JSON into two table DATs: `nodes_data` and `edges_data`.
3. **Node Rendering (Instancing)**:
   - Convert `nodes_data` columns (`x`, `y`, `z`, `cluster`, `size`) into a CHOP using a **DAT to CHOP** operator.
   - Feed the CHOP into a **Geometry COMP**. Configure instancing using a **Sphere SOP** as the source, mapping `tx`, `ty`, `tz` to the position, and mapping the cluster ID to a color lookup texture.
4. **Edge Rendering**:
   - Connect points in 3D using a **Script SOP** that iterates through the `edges_data` table, matches node positions, and appends 3D poly-lines.

### Phase 3: Interactive Features
1. **Hover & Highlight**: Use TouchDesigner's Render Pick DAT to identify when the mouse hovers over a node. Display its description and name as a text overlay.
2. **Dashboard Synchronization**: Connect the Next.js frontend or TouchDesigner input panel so queries submitted in one interface automatically update the 3D visual highlights in TouchDesigner.
