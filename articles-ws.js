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
        if (msg.requestId) {
          const match = pending.find((p) => p.requestId === msg.requestId);
          if (match) {
            pending = pending.filter((p) => p !== match);
            match.onAck(msg.article);
          }
        }
      } else if (msg.type === "removed") {
        cache = cache.filter((a) => a.slug !== msg.slug);
        notify();
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
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
  }

  function save({ title, markdown, author }) {
    return new Promise((resolve) => {
      try {
        const requestId = makeId();

        const timeout = setTimeout(() => {
          console.warn("ArticlesWS.save: timed out waiting for server ack");
          pending = pending.filter((p) => p.requestId !== requestId);
          resolve(null);
        }, 8000);

        pending.push({
          requestId,
          onAck: (article) => {
            clearTimeout(timeout);
            resolve(article);
          },
        });

        send({ type: "publish", requestId, article: { title, markdown, author } });
      } catch (err) {
        console.error("ArticlesWS.save failed:", err);
        resolve(null);
      }
    });
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
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.markdown.toLowerCase().includes(q)
      )
    );
  }

  connect();

  return { save, all, get, search, onUpdate };
})();