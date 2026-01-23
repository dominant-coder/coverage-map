// Coverage Map - v1
// Loads data from data.csv and renders markers + coverage circles.

const CSV_PATH = "./data.csv";

// Role -> marker color (used later for consistent styling)
const ROLE_COLOR = {
  Technician: "#2563eb",
  Electrician: "#16a34a"
};

function milesToMeters(miles) {
  return miles * 1609.344;
}

function safeTrim(v) {
  return (v ?? "").toString().trim();
}

function isValidLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// --- Map setup ---
const map = L.map("map", { zoomControl: true }).setView([39.5, -98.35], 4); // US-ish default

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const circlesLayer = L.layerGroup().addTo(map);

// --- Dot Icon for tech location ---
function makeDotIcon(color, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
      <circle cx="11" cy="11" r="9" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
      <text x="11" y="14"
        text-anchor="middle"
        font-size="11"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
        font-weight="700"
        fill="#ffffff">${label}</text>
    </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}



// --- UI elements ---
const partnerSelect = document.getElementById("partnerSelect");
const stateSelect = document.getElementById("stateSelect");
const roleSelect = document.getElementById("roleSelect");
const radiusMilesInput = document.getElementById("radiusMiles");
const countsEl = document.getElementById("counts");
const fitBtn = document.getElementById("fitBtn");

let allRows = [];

function populatePartnerDropdown(partners) {
  // Keep "All" as the first option, then add partners.
  partnerSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "All";
  allOpt.textContent = "All";
  partnerSelect.appendChild(allOpt);

  for (const p of partners) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    partnerSelect.appendChild(opt);
  }
}

function normalizeRow(row) {
  const partner = safeTrim(row.partner);
  const name = safeTrim(row.name);
  const role = safeTrim(row.role);
  const price = safeTrim(row.price);
  const notes = safeTrim(row.notes);
  const state = safeTrim(row.state).toUpperCase();


  // lat/lon must be numbers in decimal format
  const lat = Number(row.lat);
  const lon = Number(row.lon);

  // per-row radius is optional; if missing we will use the UI radius (default 100)
  const rowRadiusMiles = row.service_radius_miles !== undefined && row.service_radius_miles !== ""
    ? Number(row.service_radius_miles)
    : null;

  const activeRaw = safeTrim(row.active).toUpperCase();
  const active = (activeRaw === "" || activeRaw === "TRUE" || activeRaw === "1" || activeRaw === "YES");

  return { partner, name, role, lat, lon, price, notes, rowRadiusMiles, active, state };
}

function getFilteredRows() {
  const selectedPartner = partnerSelect.value;
  const selectedRole = roleSelect.value;

  return allRows.filter(r => {
    if (!r.active) return false;
    const partnerOk = (selectedPartner === "All") || (r.partner === selectedPartner);
    const roleOk = (selectedRole === "All") || (r.role === selectedRole);
    return partnerOk && roleOk;
  });
}

function render() {
  markersLayer.clearLayers();
  circlesLayer.clearLayers();

  const uiRadiusMiles = Math.max(1, Number(radiusMilesInput.value || 100));
  const rows = getFilteredRows();

  const bounds = [];

  for (const r of rows) {
    if (!isValidLatLon(r.lat, r.lon)) continue;

    const popupHtml = `
      <div style="min-width: 220px;">
        <div style="font-weight: 700; margin-bottom: 4px;">${r.name || "Unnamed"}</div>
        <div><b>Partner:</b> ${r.partner || "-"}</div>
        <div><b>Role:</b> ${r.role || "-"}</div>
        ${r.price ? `<div><b>Price:</b> ${r.price}</div>` : ""}
        ${r.notes ? `<div style="margin-top: 6px; color: #374151;">${r.notes}</div>` : ""}
      </div>
    `;

    // Simple default marker for v1
    const color = ROLE_COLOR[r.role] || "#6b7280";
    const label = (r.role === "Electrician") ? "E" : (r.role === "Technician") ? "T" : "?";
    const icon = makeDotIcon(color, label);
    const marker = L.marker([r.lat, r.lon], { icon }).bindPopup(popupHtml);
    marker.addTo(markersLayer);
    

    const radiusMiles = (r.rowRadiusMiles && Number.isFinite(r.rowRadiusMiles)) ? r.rowRadiusMiles : uiRadiusMiles;
    const circle = L.circle([r.lat, r.lon], {
      radius: milesToMeters(radiusMiles),
      color: color,
      fillColor: color,
      weight: 2,
      fillOpacity: 0.12
    });

    circle.addTo(circlesLayer);

    bounds.push([r.lat, r.lon]);
}

  countsEl.textContent = `${rows.length} location(s) shown`;

  if (bounds.length) {
    const b = L.latLngBounds(bounds);
    map.fitBounds(b.pad(0.25));
  }
}

function fitToResults() {
  const rows = getFilteredRows().filter(r => isValidLatLon(r.lat, r.lon));
  if (!rows.length) return;
  const b = L.latLngBounds(rows.map(r => [r.lat, r.lon]));
  map.fitBounds(b.pad(0.25));
}

// Approximate state bounding boxes for zooming.
// Add more as needed. Format: [ [southWestLat, southWestLon], [northEastLat, northEastLon] ]
const STATE_BOUNDS = {
  TX: [[25.8, -106.7], [36.6, -93.5]],
  CA: [[32.5, -124.5], [42.1, -114.1]],
  NV: [[35.0, -120.0], [42.0, -114.0]],
  FL: [[24.4, -87.7], [31.2, -80.0]],
  IN: [[37.8, -88.1], [41.8, -84.8]],
  KS: [[37.0, -102.1], [40.1, -94.6]],
  WA: [[45.5, -124.9], [49.1, -116.9]]
};

function zoomToState(stateCode) {
  if (!stateCode || stateCode === "All") {
    // If All is selected, fit to current results instead of the whole US
    fitToResults();
    return;
  }
  const bounds = STATE_BOUNDS[stateCode];
  if (!bounds) {
    // If we don't have bounds defined yet, do nothing (safe behavior)
    return;
  }
  map.fitBounds(bounds, { padding: [20, 20] });
}


// --- Load CSV ---
Papa.parse(CSV_PATH, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const raw = results.data || [];
    allRows = raw.map(normalizeRow).filter(r => r.partner); // minimal sanity check

    const partners = Array.from(new Set(allRows.map(r => r.partner))).sort((a, b) => a.localeCompare(b));
    populatePartnerDropdown(partners);
    // Populate State dropdown based on data.csv
    const states = Array.from(
      new Set(allRows.map(r => r.state).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    
    stateSelect.innerHTML = "";
    const allStateOpt = document.createElement("option");
    allStateOpt.value = "All";
    allStateOpt.textContent = "All";
    stateSelect.appendChild(allStateOpt);
    
    for (const s of states) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      stateSelect.appendChild(opt);
    }

    render();
  },
  error: (err) => {
    console.error("CSV load error:", err);
    countsEl.textContent = "Failed to load data.csv. Check file name and format.";
  }
});

// --- Event handlers ---
partnerSelect.addEventListener("change", render);
roleSelect.addEventListener("change", render);
radiusMilesInput.addEventListener("input", () => {
  clearTimeout(window.__radiusTimer);
  window.__radiusTimer = setTimeout(render, 250);
});
fitBtn.addEventListener("click", fitToResults);
stateSelect.addEventListener("change", () => {
  zoomToState(stateSelect.value);
});

