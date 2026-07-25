(function () {
  const KEY = "applele-debug-log";
  const MAX_ENTRIES = 300;

  function redact(key, value) {
    if (key === "idToken" || key === "credential") return "[redacted]";
    return value;
  }

  function stringify(arg) {
    if (arg instanceof Error) return arg.message + (arg.stack ? "\n" + arg.stack : "");
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.stringify(arg, redact);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }

  function push(level, args) {
    try {
      const entry = { t: Date.now(), level, msg: args.map(stringify).join(" ") };
      const log = JSON.parse(localStorage.getItem(KEY) || "[]");
      log.push(entry);
      while (log.length > MAX_ENTRIES) log.shift();
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
    }
  }

  ["log", "warn", "error"].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = function (...args) {
      push(level, args);
      original(...args);
    };
  });

  window.addEventListener("error", (e) => {
    push("error", [`Uncaught: ${e.message} (${e.filename}:${e.lineno})`]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("error", [`Unhandled promise rejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`]);
  });

  window.AppleleDebugLog = {
    getAll: function () {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "[]");
      } catch {
        return [];
      }
    },
    clear: function () {
      localStorage.removeItem(KEY);
    },
  };
})();