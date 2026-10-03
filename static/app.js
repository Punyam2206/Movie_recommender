(() => {
  const input = document.getElementById("movie-input");
  const btn = document.getElementById("go-btn");
  const list = document.getElementById("suggestions");
  const errBox = document.getElementById("error");
  const loading = document.getElementById("loading");
  const results = document.getElementById("results");
  const cards = document.getElementById("cards");
  const queryTitle = document.getElementById("query-title");

  let titles = [];
  let active = -1;

  // Load all titles once for autocomplete
  fetch("/titles")
    .then(r => r.json())
    .then(d => { titles = d.titles || []; })
    .catch(() => {});

  const esc = s => s.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }
  function clearError() { errBox.hidden = true; }

  // ---------- Autocomplete ----------
  function renderSuggestions() {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.hidden = true; return; }

    const starts = [], contains = [];
    for (const t of titles) {
      const l = t.toLowerCase();
      if (l.startsWith(q)) starts.push(t);
      else if (l.includes(q)) contains.push(t);
      if (starts.length + contains.length >= 40) break;
    }
    const matches = starts.concat(contains).slice(0, 8);
    if (!matches.length) { list.hidden = true; return; }

    list.innerHTML = matches.map(t => {
      const i = t.toLowerCase().indexOf(q);
      return `<li data-title="${esc(t)}">${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + q.length))}</mark>${esc(t.slice(i + q.length))}</li>`;
    }).join("");
    active = -1;
    list.hidden = false;
  }

  function setActive(n) {
    const items = [...list.children];
    if (!items.length) return;
    active = (n + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("active", i === active));
    input.value = items[active].dataset.title;
  }

  input.addEventListener("input", renderSuggestions);
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { list.hidden = true; getRecommendations(); }
    else if (e.key === "Escape") { list.hidden = true; }
  });
  list.addEventListener("mousedown", e => {
    const li = e.target.closest("li");
    if (!li) return;
    input.value = li.dataset.title;
    list.hidden = true;
    getRecommendations();
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".input-wrap")) list.hidden = true;
  });

  // ---------- Recommendations ----------
  async function getRecommendations(titleOverride) {
    const title = (titleOverride || input.value).trim();
    clearError();
    if (!title) { showError("Please enter a movie title."); return; }

    results.hidden = true;
    loading.hidden = false;
    btn.disabled = true;

    try {
      const res = await fetch("/recommend?title=" + encodeURIComponent(title));
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Something went wrong");

      queryTitle.textContent = data.query || title;
      const items = data.details || data.recommendations.map(t => ({ title: t }));
      cards.innerHTML = items.map((m, i) => `
        <div class="card" style="animation-delay:${i * 70}ms" data-title="${esc(m.title)}">
          <div class="rank">${i + 1}</div>
          <div class="info">
            <div class="title">${esc(m.title)}</div>
            ${m.score != null ? `<div class="bar"><span style="width:${Math.min(100, m.score * 2.5)}%"></span></div>` : ""}
          </div>
          ${m.score != null ? `<div class="score">${m.score}% match</div>` : ""}
        </div>`).join("");
      results.hidden = false;
    } catch (err) {
      showError(err.message);
    } finally {
      loading.hidden = true;
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", () => getRecommendations());

  // Click a recommended card to chain into its own recommendations
  cards.addEventListener("click", e => {
    const card = e.target.closest(".card");
    if (!card) return;
    input.value = card.dataset.title;
    window.scrollTo({ top: 0, behavior: "smooth" });
    getRecommendations(card.dataset.title);
  });
})();
