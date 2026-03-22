# Neuro-Agentic Clinical RAG

A neurosymbolic AI pipeline for clinical decision support that combines neural extraction (LLM), symbolic reasoning (Medical Knowledge Graph), and agentic verification (RAG).

## Features

- **Neurosymbolic Architecture**: Combines the flexibility of LLMs with the structured reasoning of a medical knowledge graph.
- **Retrieval-Augmented Generation (RAG)**: Injects relevant medical context from vector database into the LLM prompt.
- **Agentic Verification**: Symbolic guardrails to prevent hallucinations and ensure medical plausibility.
- **Explainable AI**: Full reasoning trail visualization (Extraction -> Graph Reasoning -> Verification -> Synthesis).
- **Multi-Model Support**:
  - **Local**: Ollama (Llama 3.2, Mistral, etc.) - Privacy-first, no data leaves your machine.
  - **Cloud**: Groq (Llama 3 70B) - Ultra-fast inference.
  - **Custom**: Any OpenAI-compatible API.
- **Interactive Knowledge Graph**: Visualize the relationships between symptoms and diseases in real-time.
- **Drug Interaction Checker**: Integration with OpenFDA and RxNorm to check for drug-drug interactions and contraindications.
- **Clinical History**: Save and manage patient cases (SQLite locally, Neon Postgres when deployed).
- **Report Generation**: Export detailed clinical reports as PDF.
- **Dockerized**: Easy deployment with Docker Compose.

## Tech Stack

- **Backend**: Python, FastAPI, NetworkX (Graph), Pinecone (vector RAG), SQLAlchemy + asyncpg (Neon/SQLite), LangChain.
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, React Force Graph, Zustand.
- **LLM**: Ollama (Local), Groq (Cloud).

## Prerequisites

- **Docker & Docker Compose** (Recommended for easiest setup)
- **Node.js 18+** (If running locally without Docker)
- **Python 3.10+** (If running locally without Docker)
- **Ollama** (For local LLM support)

## Setup & Installation

### Option 1: Docker (Recommended)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/shivenpatro/Neuro-Agentic-Clinical-RAG.git
    cd Neuro-Agentic-Clinical-RAG
    ```

2.  **Start the application:**
    ```bash
    docker-compose up --build
    ```
    - This will start the Backend (API), Frontend (UI), and ensure Ollama is reachable.
    - Note: For Ollama inside Docker to access your host's GPU, you may need additional configuration or use `host.docker.internal`. The default setup assumes a local Ollama instance reachable via networking.

3.  **Access the Dashboard:**
    - Open [http://localhost:3000](http://localhost:3000)

### Option 2: Manual Setup

#### 1. Backend Setup

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Set up environment variables:
    - Copy `.env.example` to `.env`
    - Update `LLM_API_KEY`, `DATABASE_URL`, etc.
5.  Run the server:
    ```bash
    uvicorn main:app --reload --port 8000
    ```

#### 2. Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up environment variables:
    - Copy `.env.local.example` to `.env.local`
4.  Run the development server:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000)

## Usage

1.  **Select LLM Provider**: Click the settings (gear icon) to choose between Ollama (Local), Groq (Cloud), or Custom.
2.  **Enter Clinical Note**: Paste a patient's symptoms or clinical history into the text area.
3.  **Analyze**: Click "Analyze Case".
    - **Step 1: Extraction**: The LLM extracts distinct symptoms.
    - **Step 2: RAG**: Relevant medical context is retrieved.
    - **Step 3: Graph Reasoning**: The knowledge graph traverses symptom-disease relationships.
    - **Step 4: Verification**: The agent checks for consistency and likelihood.
    - **Step 5: Synthesis**: A final diagnosis and reasoning report is generated.
4.  **Explore**:
    - View the **Knowledge Graph** visualization.
    - Check **Differential Diagnoses**.
    - Verify **Drug Interactions** in the side panel.
    - **Export** the report to PDF.

## Hosting on Render (free tier)

Render builds often fail with **“Exited with status 1”** while installing Python deps because **`sentence-transformers` pulls PyTorch (~2GB+)** and the free builder runs out of RAM or disk. This repo’s default `requirements.txt` **does not** install PyTorch; embeddings use **OpenAI `text-embedding-3-small`** instead.

**Required env vars on Render (backend web service, root `backend/`):**

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon Postgres URL; use `postgresql://...?ssl=require` — the app rewrites it for `asyncpg`. |
| `PINECONE_API_KEY` | From Pinecone dashboard. |
| `OPENAI_API_KEY` | **Required for RAG embeddings** on cloud (small $; no local model download). |
| `CORS_ORIGINS` | Your Vercel URL(s), comma-separated, or `*` for quick tests. |

**Pinecone index dimensions**

- With `OPENAI_API_KEY`: index is created at **1536** dimensions.
- If you previously created `medical-knowledge` at **384** (old MiniLM setup), either **delete that index** in Pinecone or set `PINECONE_INDEX_NAME` to a new name (e.g. `medical-knowledge-v2`).

**Local dev without OpenAI:** `pip install -r requirements-optional.txt` for HuggingFace MiniLM (384-dim); omit `OPENAI_API_KEY` only if that package is installed.

**Render MCP:** In Cursor, open the Render MCP and **select your workspace** first; then tools like `list_logs` can show the exact build error (`type`: `build`).

## Project Structure

```
├── backend/
│   ├── agent/            # LLM interaction, RAG, and reasoning logic
│   ├── api/              # FastAPI routes
│   ├── db/               # Database models and CRUD
│   ├── graph/            # Knowledge graph builder and traversal
│   ├── rag/              # Vector store and retrieval
│   ├── main.py           # App entry point
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components (Graph, History, etc.)
│   │   ├── lib/          # API clients and utilities
│   │   └── store/        # Zustand state management
│   └── package.json      # Node.js dependencies
├── docker-compose.yml    # Docker orchestration
└── README.md             # Project documentation
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

[MIT](LICENSE)
