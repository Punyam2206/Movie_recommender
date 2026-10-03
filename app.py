import os
import pickle
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from scipy import sparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="CineMatch Movie Recommender")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load data once at startup
# ---------------------------------------------------------------------------
with open(os.path.join(BASE_DIR, "movies.pkl"), "rb") as f:
    df = pickle.load(f)

# Keep the matrix sparse (CSR) so we never build the full dense 4805x4805 array.
npz_path = os.path.join(BASE_DIR, "similarity.npz")
pkl_path = os.path.join(BASE_DIR, "similarity.pkl")

if os.path.exists(npz_path):
    similarity = sparse.load_npz(npz_path).tocsr()
    print("Loaded sparse similarity matrix")
elif os.path.exists(pkl_path):
    with open(pkl_path, "rb") as f:
        similarity = np.array(pickle.load(f))
    print("Loaded pickle similarity matrix")
else:
    raise FileNotFoundError("Neither similarity.npz nor similarity.pkl was found.")

IS_SPARSE = sparse.issparse(similarity)

TITLES: List[str] = df["title"].tolist()
TITLE_TO_INDEX = {t.lower(): i for i, t in enumerate(TITLES)}


def _row(idx: int) -> np.ndarray:
    """Return one dense similarity row as a 1-D numpy array."""
    if IS_SPARSE:
        return similarity[idx].toarray().ravel()
    return np.asarray(similarity[idx]).ravel()


def recommend(movie: str, n: int = 5):
    """Return the top-n most similar movies for a given title."""
    idx = TITLE_TO_INDEX.get(movie.strip().lower())
    if idx is None:
        raise KeyError(movie)

    scores = _row(idx)
    scores[idx] = -1  # exclude the movie itself
    top = np.argsort(scores)[::-1][:n]

    return idx, [
        {"title": df.iloc[i]["title"], "score": round(float(scores[i]) * 100, 1)}
        for i in top
    ]


# ---------------------------------------------------------------------------
# Routes
#
# These are plain `def` (not `async def`) on purpose: the work is CPU-bound
# NumPy code, so FastAPI runs it in a threadpool instead of blocking the
# event loop.
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def home():
    return FileResponse(os.path.join(BASE_DIR, "templates", "index.html"))


@app.get("/titles")
def titles():
    """All titles (used by the frontend for autocomplete)."""
    return {"titles": TITLES}


@app.get("/recommend")
def recommend_api(
    title: str = Query("", description="Movie title"),
    n: int = Query(5, ge=1, le=20, description="Number of recommendations"),
):
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="No title provided")

    try:
        idx, results = recommend(title, n)
    except KeyError:
        raise HTTPException(status_code=404, detail="Movie not found in database")

    return {
        "query": TITLES[idx],
        "recommendations": [r["title"] for r in results],  # simple list
        "details": results,                                 # with match %
    }


@app.get("/health")
def health():
    return {"status": "ok", "movies": len(TITLES)}


# Static files (css/js) — mounted last so it doesn't shadow the routes above.
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
