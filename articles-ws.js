const ArticlesWS = (() => {
  const SERVER_URL = "wss://applele-server-production.up.railway.app/";
  let socket = null;
  let cache = [];
  let listeners = [];
  let queue = [];
  let pending = [];
  let connected = false;

  function notify() {
    listeners.forEach((fn) => fn(cache));
  }

  function connect() {
    socket = new WebSocket(SERVER_URL);
    socket.addEventListener("open", () => {
      connected = true;
      console.log("ArticlesWS: connected to", SERVER_URL);
      queue.forEach((msg) => socket.send(JSON.stringify(msg)));
      queue = [];
    });
    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "init") {
        cache = msg.articles;
        notify();
      } else if (msg.type === "new") {
        cache = cache.filter((a) => a.slug !== msg.article.slug);
        cache.unshift(msg.article);
        notify();
        ackPending(msg.requestId, msg.article);
      } else if (msg.type === "updated") {
        cache = cache.map((a) => (a.slug === msg.article.slug ? msg.article : a));
        notify();
        ackPending(msg.requestId, msg.article);
      } else if (msg.type === "removed") {
        cache = cache.filter((a) => a.slug !== msg.slug);
        notify();
        ackPending(msg.requestId, true);
      } else if (msg.type === "banned-ack") {
        ackPending(msg.requestId, msg.banned);
      } else if (msg.type === "report-ack") {
        ackPending(msg.requestId, true);
      } else if (msg.type === "error") {
        failPending(msg.requestId, msg.message);
      }
    });
    socket.addEventListener("close", () => {
      connected = false;
      console.warn("ArticlesWS: disconnected, retrying in 2s...");
      setTimeout(connect, 2000);
    });
    socket.addEventListener("error", (e) => {
      console.error("ArticlesWS: socket error", e);
      socket.close();
    });
  }

  function send(msg) {
    if (connected) socket.send(JSON.stringify(msg));
    else queue.push(msg);
  }

  function onUpdate(fn) {
    listeners.push(fn);
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function ackPending(requestId, value) {
    const match = pending.find((p) => p.requestId === requestId);
    if (match) {
      pending = pending.filter((p) => p !== match);
      clearTimeout(match.timeout);
      match.resolve(value);
    }
  }
  function failPending(requestId, message) {
    const match = pending.find((p) => p.requestId === requestId);
    if (match) {
      pending = pending.filter((p) => p !== match);
      clearTimeout(match.timeout);
      match.reject(new Error(message));
    }
  }

  function request(msg, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const requestId = makeId();
      const timeout = setTimeout(() => {
        pending = pending.filter((p) => p.requestId !== requestId);
        reject(new Error("Timed out waiting for the server."));
      }, timeoutMs);
      pending.push({ requestId, resolve, reject, timeout });
      send({ ...msg, requestId });
    });
  }

  function save({ title, markdown, idToken }) {
    return request({ type: "publish", article: { title, markdown }, idToken });
  }
  function edit({ slug, title, markdown, idToken }) {
    return request({ type: "edit", slug, article: { title, markdown }, idToken });
  }
  function remove({ slug, idToken }) {
    return request({ type: "delete", slug, idToken });
  }
  function ban({ userId, idToken }) {
    return request({ type: "ban", userId, idToken });
  }
  function unban({ userId, idToken }) {
    return request({ type: "unban", userId, idToken });
  }
  function report({ slug, reason, idToken }) {
    return request({ type: "report", slug, reason, idToken });
  }
  function all() {
    return Promise.resolve(cache);
  }
  function get(slug) {
    return Promise.resolve(cache.find((a) => a.slug === slug) || null);
  }
  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return Promise.resolve(cache);
    return Promise.resolve(
      cache.filter(
        (a) => a.title.toLowerCase().includes(q) || a.markdown.toLowerCase().includes(q)
      )
    );
  }

  connect();
  return { save, edit, remove, ban, unban, report, all, get, search, onUpdate };
})();