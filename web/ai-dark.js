(function () {
  "use strict";
  document.documentElement.dataset.aiUi = "black-surface-v2";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener("pointermove", (event) => {
    const panel = event.target.closest?.(".panel");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    panel.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, { passive: true });
})();
