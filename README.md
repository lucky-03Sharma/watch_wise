# WatchWise — AI & Big Data Movie Intelligence Platform

A full-stack AI-powered movie recommendation web application with **Big Data Analytics (BDA)** clickstream log ingestion via **Apache Flume** into **Hadoop Distributed File System (HDFS)**.

## 🎬 Features

- 🧠 **AI-Powered Recommendations** — TF-IDF cosine similarity across 45,447 movies
- 🐘 **Big Data Clickstream Ingestion** — Real-time event streaming via **Apache Flume**
- 💾 **HDFS Distributed Storage** — Partitioned user activity data blocks (`/watchwise/clickstream/%Y-%m-%d/`)
- 📊 **MapReduce Analytics** — Batch & real-time analytics for top movies, queries, and genre trends
- 🎭 **Genre Filtering** — Browse movies by Action, Drama, Comedy, Horror, Sci-Fi and more
- 🔍 **Real-Time Search** — Full-text search powered by ML engine
- ❤️ **Favorites & Watchlist** — Save movies with localStorage & server persistence
- 🎨 **Premium Dark UI** — Glassmorphism design with live BDA Flume ingestion stream
- 📽️ **Movie Modals** — Detailed view with genre-accurate recommendations

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS, Bootstrap Icons |
| Backend | Node.js, Express.js |
| ML Engine | Python FastAPI, scikit-learn, pandas |
| Ingestion (BDA) | **Apache Flume 1.11** (Taildir + Netcat source, Memory Channel) |
| Storage (BDA) | **Hadoop HDFS** (Date-partitioned sequence/text blocks) |
| Analytics (BDA) | MapReduce clickstream processor (`bda/analytics/analyze_clickstream.py`) |
| Database | MongoDB (optional, with automatic in-memory fallback) |
| Dataset | TMDB 45,447 movies |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB (optional)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/lucky-03Sharma/WatchWise.git
cd WatchWise

# 2. Install Node.js dependencies
cd backend
npm install

# 3. Install Python dependencies
cd ..
pip install -r requirements.txt

# 4. Configure environment
# On Mac/Linux:
cp backend/.env.example backend/.env
# On Windows:
copy backend\.env.example backend\.env

# Edit backend/.env with your settings (optional)
```

### Running the App

**Terminal 1 — Python ML Service:**
```bash
python backend/ml_service.py
# ML Engine starts at http://127.0.0.1:8000
```

**Terminal 2 — Node.js Backend:**
```bash
cd backend
npm start
# App starts at http://localhost:5000
```

**Open your browser at:** `http://localhost:5000`

## 📁 Project Structure

```
WatchWise/
├── backend/
│   ├── bda/
│   │   └── flume_collector.js# Clickstream logger & Flume TCP streaming
│   ├── data/
│   │   └── store.js          # 254 curated movies with verified TMDB posters
│   ├── routes/
│   │   ├── movies.js         # Movie API routes + ML & BDA event logging
│   │   ├── library.js        # Favorites & Watchlist API
│   │   ├── auth.js           # Authentication routes
│   │   └── bda.js            # BDA status, live stream & analytics API
│   ├── ml_service.py         # Python FastAPI ML recommendation engine
│   ├── server.js             # Express app entry point
│   ├── package.json
│   ├── .env.example          # Environment variables template
│   └── .env                  # Your local config (git-ignored)
├── bda/
│   ├── flume/
│   │   ├── flume-hdfs.conf   # Official Apache Flume configuration for HDFS
│   │   ├── flume-netcat-hdfs.conf # Netcat socket source (port 44444) to HDFS
│   │   ├── flume-local.conf  # Standalone local Flume config
│   │   └── flume_runner.py   # Flume launcher & fallback ingestion daemon
│   ├── analytics/
│   │   └── analyze_clickstream.py # MapReduce clickstream analytics job
│   ├── docker-compose.bda.yml # 1-command Hadoop NameNode, DataNode & Flume
│   ├── hadoop.env            # Hadoop cluster environment config
│   └── BDA_GUIDE.md          # Complete BDA project guide & viva Q&A
├── public/
│   ├── index.html            # SPA with movie view & live BDA Flume panel
│   ├── app.js                # Frontend logic & real-time BDA stream
│   ├── style.css             # Premium dark theme CSS
│   └── hero-bg.jpg           # Cinematic hero background
├── df.pkl                    # 45,447 movie ML dataset
├── indices.pkl               # Movie title index
├── tfidf.pkl                 # TF-IDF vectorizer
├── tfidf_matrix.pkl          # Pre-computed TF-IDF matrix
├── requirements.txt          # Python dependencies
├── .gitignore
└── README.md
```

## 🐘 Big Data Analytics (BDA) with Flume & HDFS

Every user click, search, recommendation request, and movie save emits a structured JSON clickstream event.

### 1. Ingestion Pipeline
- **Source**: `TAILDIR` tracking `bda/logs/flume_source/user_activity.log` and TCP port `44444`.
- **Channel**: In-memory FIFO queue (Capacity: 10,000 events, 1,000 txn capacity).
- **Sink**: HDFS Sink writing to `hdfs://localhost:9000/watchwise/clickstream/%Y-%m-%d/`.

### 2. Running BDA Analytics
Run the MapReduce analytics job directly in your terminal:
```bash
python bda/analytics/analyze_clickstream.py
```

### 3. Running with Real Hadoop + Flume in Docker
```bash
docker-compose -f bda/docker-compose.bda.yml up -d
```
Visit Hadoop NameNode HDFS explorer at **http://localhost:9870**.

For full BDA project documentation, configuration parameters, and viva questions, see [bda/BDA_GUIDE.md](file:///bda/BDA_GUIDE.md).

## 🤖 ML Architecture

The recommendation engine uses **TF-IDF (Term Frequency-Inverse Document Frequency)** vectorization on movie metadata (title, genres, overview, tags) combined with **cosine similarity** to find similar movies.

- **Dataset**: 45,447 TMDB movies
- **Features**: 50,000 TF-IDF features
- **Algorithm**: Cosine Similarity via `sklearn.metrics.pairwise.linear_kernel`
- **Serving**: FastAPI with `/recommend`, `/genre`, `/search` endpoints
deployed link :- https://watch-wise-5td3.onrender.com/
## 📄 License

MIT License — feel free to fork and build upon this project!
