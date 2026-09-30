# Mementos

An AI research and personal knowledge app with a TouchDesigner graph visualization bridge.

- Research a question and follow the search process as it streams.
- Save sources, search documents, and chat with citations using LightRAG.
- Export a 3D knowledge graph and retrieval highlights to TouchDesigner.

**Built with:** Next.js · TypeScript · FastAPI · LangGraph · LightRAG · Qdrant

## TouchDesigner visual

![TouchDesigner visual placeholder](assets/touchdesigner-placeholder.svg)

## App screenshots

![Deep Research screenshot placeholder](assets/research-placeholder.svg)

![Knowledge Base screenshot placeholder](assets/knowledge-base-placeholder.svg)

[Add your visuals](assets/README.md) · [TouchDesigner bridge](docs/touchdesigner.md)

## Run locally

Requires Node.js 20.9+, Python 3.12+, Docker Compose, and OpenAI-compatible and Tavily API keys.

```bash
cp .env.example .env
# Add your API keys to .env.
bash start.sh
```

Open [localhost:3000](http://localhost:3000). First launch installs dependencies and downloads embedding models when needed.

[Manual setup and checks](docs/setup.md) · [MIT license](LICENSE)
