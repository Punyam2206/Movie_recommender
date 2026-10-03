# CineMatch – Movie Recommender

Content-based movie recommender (FastAPI backend + HTML/CSS/JS frontend).

## Run locally
```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```
Open http://127.0.0.1:8000  (interactive API docs at /docs)

## Structure
```
app.py                FastAPI backend (routes + recommend logic)
movies.pkl            DataFrame: id, title, tag
similarity.npz        Sparse cosine-similarity matrix
templates/index.html  Frontend page
static/style.css      Styling
static/app.js         Autocomplete + API calls
Procfile              Deployment: uvicorn app:app --host 0.0.0.0 --port $PORT
```

## API
- `GET /` – web UI
- `GET /titles` – all movie titles
- `GET /recommend?title=Avatar&n=5` – top-n similar movies
- `GET /health` – health check
- `GET /docs` – Swagger UI

## Deploy (Render / Heroku)
Build command `pip install -r requirements.txt`,
start command `uvicorn app:app --host 0.0.0.0 --port $PORT`.
