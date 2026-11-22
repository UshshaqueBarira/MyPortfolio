let allApps = [];
let telemetryMap = {};
let selectedCategory = "All";
let searchQuery = "";
let paletteIndex = 0;

function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.min(130, Math.floor((canvas.width * canvas.height) / 14000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.35 + 0.3,
      vx: (Math.random() - 0.5) * 0.14,
      vy: (Math.random() - 0.5) * 0.14,
      a: Math.random() * 0.7 + 0.2,
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.x = (s.x + s.vx + canvas.width) % canvas.width;
      s.y = (s.y + s.vy + canvas.height) % canvas.height;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248, 250, 252, ${s.a})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  resize();
  tick();
}

function startClock() {
  const el = document.getElementById("utc-clock");
  const update = () => {
    const now = new Date();
    el.textContent = `UTC ${now.toISOString().slice(11, 19)}`;
  };
  update();
  setInterval(update, 1000);
}

async function initPortfolio() {
  initStarfield();
  startClock();

  try {
    const [configRes, statusRes] = await Promise.all([
      fetch("config/apps.json", { cache: "no-store" }),
      fetch("config/status.json", { cache: "no-store" }).catch(() => null),
    ]);

    if (!configRes.ok) throw new Error(`HTTP ${configRes.status}`);
    const config = await configRes.json();

    document.getElementById("portfolio-title").textContent =
      config.portfolio_title || "ORBITAL // APP DECK";
    document.getElementById("portfolio-subtitle").textContent =
      config.portfolio_subtitle || "";

    const ghLink = document.getElementById("github-link");
    if (config.github_profile) {
      ghLink.href = config.github_profile;
    } else {
      ghLink.style.display = "none";
    }

    if (statusRes && statusRes.ok) {
      const statusData = await statusRes.json();
      telemetryMap = statusData.apps || {};
      if (statusData.last_run_utc) {
        const dt = new Date(statusData.last_run_utc);
        document.getElementById("last-cron-label").textContent =
          `LAST SYNC: ${dt.toISOString().replace("T", " ").slice(0, 16)} UTC`;
      }
    }

    allApps = (config.apps || []).filter((app) => app.active !== false);
    document.getElementById("radar-count").textContent = String(allApps.length);

    buildCategoryPills(allApps);
    renderRadarNodes(allApps);
    renderFilteredApps();
    verifyAllEndpoints();
  } catch (err) {
    document.getElementById("portfolio-subtitle").textContent =
      "Configuration load error — verify config/apps.json.";
    console.error(err);
  }
}

function renderRadarNodes(apps) {
  const container = document.getElementById("radar-nodes");
  container.innerHTML = "";
  const radius = 98;
  const center = 120;

  apps.forEach((app, idx) => {
    const angle = (idx / Math.max(apps.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    const node = document.createElement("button");
    node.className = "orbit-node";
    node.id = `radar-node-${app.id}`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.title = `${app.title} — click to preview`;
    node.setAttribute("aria-label", `Preview ${app.title}`);
    node.addEventListener("click", () => openPreview(app.id));
    container.appendChild(node);
  });
}

function buildCategoryPills(apps) {
  const container = document.getElementById("category-filters");
  const categories = ["All", ...new Set(apps.map((a) => a.category).filter(Boolean))];
  container.innerHTML = "";

  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = `pill ${cat === selectedCategory ? "active" : ""}`;
    btn.textContent = cat.toUpperCase();
    btn.addEventListener("click", () => {
      selectedCategory = cat;
      document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      renderFilteredApps();
      verifyAllEndpoints();
    });
    container.appendChild(btn);
  });
}

function renderFilteredApps() {
  const grid = document.getElementById("app-grid");
  const query = searchQuery.toLowerCase().trim();

  const filtered = allApps.filter((app) => {
    const matchesCat = selectedCategory === "All" || app.category === selectedCategory;
    const haystack = [app.title, app.description, app.category, ...(app.tech || [])]
      .join(" ")
      .toLowerCase();
    return matchesCat && (!query || haystack.includes(query));
  });

  grid.innerHTML = "";
  filtered.forEach((app, i) => {
    const botInfo = telemetryMap[app.id];
    const tilt = ((i % 3) - 1) * 1.4;
    const stackHtml = (app.tech || [])
      .map((t) => `<span class="stack-item mono">${t}</span>`)
      .join("");

    const initialText = botInfo
      ? `${botInfo.status === "WOKEN_UP" ? "WOKEN" : "ACTIVE"} · ${botInfo.latency_ms}ms`
      : "PROBING...";

    const card = document.createElement("article");
    card.className = "app-card";
    card.style.setProperty("--tilt", `${tilt}deg`);
    card.innerHTML = `
      <div>
        <div class="card-meta mono">
          <span class="cat-tag">${app.category || "APP"}</span>
          <span class="status-readout">
            <span class="status-pip ${botInfo ? "ok" : ""}" id="pip-${app.id}"></span>
            <span id="status-${app.id}">${initialText}</span>
          </span>
        </div>
        <h2>${app.title}</h2>
        <p>${app.description}</p>
        <div class="stack-list">${stackHtml}</div>
      </div>
      <div class="card-foot">
        <a class="btn-launch" href="${app.url}" target="_blank" rel="noopener">LAUNCH ↗</a>
        <button class="btn-action" data-preview="${app.id}">PREVIEW</button>
        ${app.repo ? `<a class="btn-action" href="${app.repo}" target="_blank" rel="noopener">SRC</a>` : ""}
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", () => openPreview(btn.dataset.preview));
  });
}

async function checkEndpoint(app) {
  const pip = document.getElementById(`pip-${app.id}`);
  const label = document.getElementById(`status-${app.id}`);
  const radarNode = document.getElementById(`radar-node-${app.id}`);
  if (!pip || !label) return;

  const start = performance.now();
  try {
    await fetch(app.url, { mode: "no-cors", cache: "no-store" });
    const ms = Math.round(performance.now() - start);
    pip.className = "status-pip ok";
    label.textContent = `ONLINE · ${ms}ms`;
    if (radarNode) radarNode.classList.remove("err");
  } catch {
    pip.className = "status-pip err";
    label.textContent = "OFFLINE";
    if (radarNode) radarNode.classList.add("err");
  }
}

function verifyAllEndpoints() {
  allApps.forEach((app) => checkEndpoint(app));
}

function openPreview(appId) {
  const app = allApps.find((a) => a.id === appId);
  if (!app) return;

  document.getElementById("modal-title").textContent = app.title.toUpperCase();
  document.getElementById("modal-url").textContent = app.url;
  document.getElementById("modal-external").href = app.url;
  const embedUrl = app.url.includes("?") ? `${app.url}&embed=true` : `${app.url}/?embed=true`;
  document.getElementById("preview-frame").src = embedUrl;
  document.getElementById("preview-modal").classList.add("open");
}

function closePreview() {
  document.getElementById("preview-modal").classList.remove("open");
  document.getElementById("preview-frame").src = "about:blank";
}

/* Command Palette */
function openPalette() {
  const backdrop = document.getElementById("palette-backdrop");
  const input = document.getElementById("palette-input");
  backdrop.classList.add("open");
  input.value = "";
  paletteIndex = 0;
  renderPaletteItems("");
  setTimeout(() => input.focus(), 10);
}

function closePalette() {
  document.getElementById("palette-backdrop").classList.remove("open");
}

function renderPaletteItems(filterText) {
  const list = document.getElementById("palette-list");
  const q = filterText.toLowerCase().trim();
  const entries = [
    { label: "Run Live Endpoint Probe", hint: "ACTION", action: () => verifyAllEndpoints() },
    ...allApps
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
      .map((a) => ({
        label: a.title,
        hint: a.category.toUpperCase(),
        action: () => window.open(a.url, "_blank", "noopener"),
      })),
  ];

  list.innerHTML = "";
  entries.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = `palette-item ${idx === paletteIndex ? "selected" : ""}`;
    li.innerHTML = `<span>${item.label}</span><span style="color:var(--ink-muted)">${item.hint}</span>`;
    li.addEventListener("click", () => {
      item.action();
      closePalette();
    });
    list.appendChild(li);
  });
}

document.getElementById("verify-btn").addEventListener("click", verifyAllEndpoints);
document.getElementById("toggle-orbit-btn").addEventListener("click", (e) => {
  const grid = document.getElementById("app-grid");
  grid.classList.toggle("orbital-mode");
  e.target.classList.toggle("active");
});
document.getElementById("search-input").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderFilteredApps();
});
document.getElementById("modal-close").addEventListener("click", closePreview);
document.getElementById("preview-modal").addEventListener("click", (e) => {
  if (e.target.id === "preview-modal") closePreview();
});

document.getElementById("palette-input").addEventListener("input", (e) => {
  paletteIndex = 0;
  renderPaletteItems(e.target.value);
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const open = document.getElementById("palette-backdrop").classList.contains("open");
    open ? closePalette() : openPalette();
  } else if (e.key === "Escape") {
    closePalette();
    closePreview();
  }
});

document.addEventListener("DOMContentLoaded", initPortfolio);
