document.addEventListener('DOMContentLoaded', () => {
  // ── Inject tooltip spans ──────────────────────────────────────────────────
  document.querySelectorAll('.market-hero-highlight > div[data-tooltip]').forEach(card => {
    const tip = document.createElement('span');
    tip.className = 'stat-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = card.dataset.tooltip;
    card.appendChild(tip);
  });

  // ── Count-up animation ────────────────────────────────────────────────────
  function formatThousands(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCountUp(el) {
    const end = parseFloat(el.dataset.countup);
    const format = el.dataset.format || 'thousands';
    const suffix = el.dataset.suffix ?? '';
    const duration = 1400;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = easeOutCubic(progress) * end;

      el.textContent = format === 'time'
        ? formatTime(current)
        : formatThousands(current) + suffix;

      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  document.querySelectorAll('[data-countup]').forEach(animateCountUp);
});
