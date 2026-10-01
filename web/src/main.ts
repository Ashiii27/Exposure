/**
 * Phase 0 entry point: mounts a real (placeholder-content) page and proves
 * the shared package is part of the production bundle. The landing page,
 * router and graph land in Phase 3.
 */
import { CATEGORY_COLORS, SCHEMA_VERSION } from '@exposure/shared';
import './styles/reset.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/graph.css';
import './styles/animations.css';

const app = document.querySelector('#app');
if (app) {
  const categories = Object.entries(CATEGORY_COLORS)
    .map(
      ([category, color]) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${category}</span>`
    )
    .join('');

  app.innerHTML = `
    <main class="landing">
      <h1>Exposure</h1>
      <p class="tagline">See what a page really does behind the scenes.</p>
      <p class="phase-note">The scanner and graph UI are being built — see the roadmap in the repository docs.</p>
      <div class="legend">${categories}</div>
      <p class="version">result schema v${SCHEMA_VERSION}</p>
    </main>
  `;
}
