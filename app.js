async function init() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }

  await GoogleAuth.init(renderTopbar);
  renderTopbar();

  window.addEventListener("hashchange", route);
  await route();

  ArticlesWS.onUpdate(() => route());

  const search = document.getElementById("search");
  search.addEventListener("input", async (e) => {
    renderResults(await ArticlesWS.search(e.target.value));
  });
}

async function route() {
  const hash = window.location.hash; 
  const match = hash.match(/^#\/articles\/(.+)$/);
  const searchWrap = document.querySelector(".search-wrap");
  const results = document.getElementById("results");

  if (match) {
    const slug = decodeURIComponent(match[1]);
    const article = await ArticlesWS.get(slug);
    searchWrap.style.display = "none";
    if (!article) {
      results.innerHTML = `<p class="empty-state">Article not found, or still syncing from the server.</p>
        <p><a href="#" onclick="history.back(); return false;">&larr; back</a></p>`;
      return;
    }
    results.innerHTML = `
      <div class="article-body">
        <h1>${escapeHtml(article.title)}</h1>
        <div class="result-meta">by ${escapeHtml(article.author)} - ${new Date(article.createdAt).toLocaleDateString()}</div>
        <div>${renderMarkdown(article.markdown)}</div>
        <p><a href="#" onclick="window.location.hash=''; return false;">&larr; back to search</a></p>
      </div>`;
  } else {
    searchWrap.style.display = "";
    const query = document.getElementById("search").value;
    renderResults(await ArticlesWS.search(query));
  }
}

function renderMarkdown(md) {
  let html = escapeHtml(md);
  html = html
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
  return `<p>${html}</p>`;
}

function renderTopbar() {
  const bar = document.getElementById("topbar");
  const user = GoogleAuth.getUser();
  bar.innerHTML = "";

  if (user) {
    const chip = document.createElement("div");
    chip.className = "user-chip";
    chip.innerHTML = `<img src="${user.avatar}" alt=""> ${user.username}`;
    chip.style.cursor = "pointer";
    chip.title = "Click to log out";
    chip.addEventListener("click", () => GoogleAuth.logout());
    bar.appendChild(chip);

    const addBtn = document.createElement("a");
    addBtn.className = "button";
    addBtn.href = "publish.html";
    addBtn.textContent = "+ Add Article";
    bar.appendChild(addBtn);
  } else {
    const loginHolder = document.createElement("div");
    bar.appendChild(loginHolder);
    GoogleAuth.renderButton(loginHolder);
  }
}

function renderResults(articles) {
  const container = document.getElementById("results");
  if (!articles.length) {
    container.innerHTML =
      '<p class="empty-state">No articles found.</p>';
    return;
  }
  container.innerHTML = articles
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(
      (a) => `
      <div class="result-card">
        <h3><a href="#/articles/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></h3>
        <p>${escapeHtml(a.markdown).slice(0, 160)}${a.markdown.length > 160 ? "..." : ""}</p>
        <div class="result-meta">by ${escapeHtml(a.author)} - ${new Date(a.createdAt).toLocaleDateString()}</div>
      </div>`
    )
    .join("");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

init();