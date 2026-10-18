// ------------------------------------------------------------------ boot
  if (typeof window !== 'undefined') {
    window.addEventListener('error', function (e) {
      if (e && e.error) Telemetry.record(e.error, { severity: 'fatal' });
    });
    window.addEventListener('unhandledrejection', function (e) {
      if (e && e.reason) Telemetry.record(e.reason, { severity: 'error' });
    });
  }
  function mountApp() { mount.innerHTML = ''; render(html`<${App} />`, mount); }
  if (window.DHE_DEFER_MOUNT) window.DHE_MOUNT_APP = mountApp; // standalone build: mounts after sign-in
  else mountApp();
})();
