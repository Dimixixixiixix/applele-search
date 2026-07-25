const DB_NAME = "applele-db";
const STORE = "articles";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "slug" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getArticle(slug) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(slug);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })
  );
}

function renderMarkdown(md) {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/articles\/([^/]+)\/?$/);
  if (!match) return; 

  const slug = decodeURIComponent(match[1]);
  event.respondWith(
    getArticle(slug).then((article) => {
      if (!article) {
        return new Response("Article not found in this browser's storage.", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }
      const body = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${article.title} - Applele Search</title>
<link rel="stylesheet" href="/style.css">
</head><body>
<h1 class="title">${article.title}</h1>
<div class="article-body">${renderMarkdown(article.markdown)}</div>
<p><a href="/">&larr; back to Applele Search</a></p>
</body></html>`;
      return new Response(body, {
        headers: { "Content-Type": "text/html" },
      });
    })
  );
});