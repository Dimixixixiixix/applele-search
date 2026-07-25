const GoogleAuth = (() => {
  const CLIENT_ID = "269495129111-4fch702l9am8bv30u6amrpc4gv53hlrg.apps.googleusercontent.com";
  function decodeJwt(token) {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  }
  function handleCredentialResponse(response) {
    const data = decodeJwt(response.credential);
    localStorage.setItem(
      "applele-user",
      JSON.stringify({
        id: data.sub,
        username: data.name,
        avatar: data.picture,
        email: data.email,
        idToken: response.credential,
      })
    );
    if (typeof onLoginComplete === "function") onLoginComplete();
    else window.location.reload();
  }
  function waitForGoogle() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }
      const check = setInterval(() => {
        if (window.google && window.google.accounts) {
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }
  async function init(onLoginCompleteCallback) {
    window.onLoginComplete = onLoginCompleteCallback;
    await waitForGoogle();
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
    });
  }
  async function renderButton(containerEl) {
    await waitForGoogle();
    google.accounts.id.renderButton(containerEl, {
      theme: "filled_black",
      size: "medium",
      shape: "pill",
    });
  }
  function getUser() {
    const raw = localStorage.getItem("applele-user");
    return raw ? JSON.parse(raw) : null;
  }
  function logout() {
    localStorage.removeItem("applele-user");
    if (window.google) google.accounts.id.disableAutoSelect();
    location.reload();
  }
  return { init, renderButton, getUser, logout };
})();