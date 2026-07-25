const ADMIN_EMAIL = "zandrooortells@gmail.com";

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
  const searchWrap = document.querySelector(".search-wrap");
  const results = document.getElementById("results");
  const user = GoogleAuth.getUser();

  if (hash === "#/devtools") {
    searchWrap.style.display = "none";
    renderDevtools(user);
    return;
  }

  const match = hash.match(/^#\/articles\/(.+)$/);
  if (match) {
    const slug = decodeURIComponent(match[1]);
    const article = await ArticlesWS.get(slug);
    searchWrap.style.display = "none";
    if (!article) {
      results.innerHTML = `<p class="empty-state">Article not found, or still syncing from the server.</p>
        <p><a href="#" onclick="history.back(); return false;">&larr; back</a></p>`;
      return;
    }
    const canEdit = !!user && (user.id === article.authorId || user.email === ADMIN_EMAIL);
    const canBan = !!user && user.email === ADMIN_EMAIL && user.id !== article.authorId;
    results.innerHTML = `
      <div class="article-body">
        <h1>${escapeHtml(article.title)}</h1>
        <div class="result-meta">by ${escapeHtml(article.author)} - ${new Date(article.createdAt).toLocaleDateString()}</div>
        <div>${renderMarkdown(article.markdown)}</div>
        <div style="margin-top:16px;">
          ${canEdit ? `<a class="button" href="publish.html?slug=${encodeURIComponent(article.slug)}">Edit</a>` : ""}
          ${user ? `<button id="report-btn" class="button">Report</button>` : ""}
          ${canBan ? `<button id="ban-btn" class="button">Ban author</button>` : ""}
        </div>
        <p><a href="#" onclick="window.location.hash=''; return false;">&larr; back to search</a></p>
      </div>`;

    const reportBtn = document.getElementById("report-btn");
    if (reportBtn) {
      reportBtn.addEventListener("click", async () => {
        const reason = prompt("Why are you reporting this article?");
        if (!reason || !reason.trim()) return;
        reportBtn.disabled = true;
        try {
          await ArticlesWS.report({ slug: article.slug, reason, idToken: user.idToken });
          alert("Thanks - this has been reported.");
        } catch (err) {
          alert("Couldn't send report: " + err.message);
        } finally {
          reportBtn.disabled = false;
        }
      });
    }
    const banBtn = document.getElementById("ban-btn");
    if (banBtn) {
      banBtn.addEventListener("click", async () => {
        if (!confirm(`Ban ${article.author}? They won't be able to publish, edit, or report anymore.`)) return;
        try {
          await ArticlesWS.ban({ userId: article.authorId, idToken: user.idToken });
          alert("Banned.");
        } catch (err) {
          alert("Error: " + err.message);
        }
      });
    }
    return;
  }

  searchWrap.style.display = "";
  const query = document.getElementById("search").value;
  renderResults(await ArticlesWS.search(query));
}

async function renderDevtools(user) {
  const results = document.getElementById("results");
  if (!user || user.email !== ADMIN_EMAIL) {
    results.innerHTML = `<p class="empty-state">Not authorized.</p>
      <p><a href="#" onclick="window.location.hash=''; return false;">&larr; back</a></p>`;
    return;
  }
  const articles = await ArticlesWS.all();
  results.innerHTML = `
    <div class="article-body">
      <h2>Devtools</h2>
      <p class="result-meta">Signed in as admin (${escapeHtml(user.email)}). Every action here is re-checked by the server against your Google account.</p>
      <h3>Articles</h3>
      ${
        articles.length
          ? articles
              .map(
                (a) => `
        <div class="result-card">
          <h3><a href="#/articles/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a></h3>
          <div class="result-meta">by ${escapeHtml(a.author)}</div>
          <button data-slug="${a.slug}" data-title="${escapeHtml(a.title)}" class="button dt-delete">Delete</button>
          <button data-user="${a.authorId}" data-name="${escapeHtml(a.author)}" class="button dt-ban">Ban author</button>
        </div>`
              )
              .join("")
          : "<p>No articles.</p>"
      }
      <p><a href="#" onclick="window.location.hash=''; return false;">&larr; back to search</a></p>
    </div>`;

  results.querySelectorAll(".dt-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Delete "${btn.dataset.title}"?`)) return;
      try {
        await ArticlesWS.remove({ slug: btn.dataset.slug, idToken: user.idToken });
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });
  results.querySelectorAll(".dt-ban").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`Ban ${btn.dataset.name}?`)) return;
      try {
        await ArticlesWS.ban({ userId: btn.dataset.user, idToken: user.idToken });
        alert("Banned.");
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });
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
    chip.innerHTML = `<img src="${user.avatar}" alt=""> ${escapeHtml(user.username)}`;
    chip.style.cursor = "pointer";
    chip.title = "Click to log out";
    chip.addEventListener("click", () => GoogleAuth.logout());
    bar.appendChild(chip);

    const addBtn = document.createElement("a");
    addBtn.className = "button";
    addBtn.href = "publish.html";
    addBtn.textContent = "+ Add Article";
    bar.appendChild(addBtn);

    if (user.email === ADMIN_EMAIL) {
      const dtBtn = document.createElement("a");
      dtBtn.className = "button";
      dtBtn.href = "#/devtools";
      dtBtn.textContent = "Devtools";
      bar.appendChild(dtBtn);
    }
  } else {
    const loginHolder = document.createElement("div");
    bar.appendChild(loginHolder);
    GoogleAuth.renderButton(loginHolder);
  }
}

function renderResults(articles) {
  const container = document.getElementById("results");
  if (!articles.length) {
    container.innerHTML = '<p class="empty-state">No articles found.</p>';
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
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

init();