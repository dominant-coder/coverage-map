// Coverage Map - v1
// Loads data from data.csv and renders markers + coverage circles.

const TSE_CSV_PATH = "./data.csv";
const DEPLOY_CSV_PATH = "./data-deploy.csv";

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

// Helper: exclude HI/AK from default auto-fit unless they are the only results
function rowsForAutoFit(rows) {
  const lower48 = rows.filter(r => r.state !== "HI" && r.state !== "AK");
  return lower48.length ? lower48 : rows;
}


// --- Map setup ---
const map = L.map("map", { zoomControl: true }).setView([39.5, -98.35], 4); // US-ish default

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
const circlesLayer = L.layerGroup().addTo(map);
const highlightLayer = L.layerGroup().addTo(map);

const jobLayer = L.layerGroup().addTo(map);
let jobMarker = null;

let lastJob = null; // { lat, lon, displayName }
const MAX_OUTSIDE_MILES = 250;
const FIXED_RADIUS_MILES = 100;


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
const deptSelect = document.getElementById("deptSelect");
const partnerSelect = document.getElementById("partnerSelect");
const stateSelect = document.getElementById("stateSelect");
const roleSelect = document.getElementById("roleSelect");
const countsEl = document.getElementById("counts");
const filterStatusEl = document.getElementById("filterStatus");
const fitBtn = document.getElementById("fitBtn");
const jobAddressInput = document.getElementById("jobAddress");
const jobSearchBtn = document.getElementById("jobSearchBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const clearJobBtn = document.getElementById("clearJobBtn");
const jobStatus = document.getElementById("jobStatus");
const jobResults = document.getElementById("jobResults");


let allRowsTSE = [];
let allRowsDeploy = [];
let currentDept = "TSE";

let currentDept = "TSE"; // placeholder for now


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


  const activeRaw = safeTrim(row.active).toUpperCase();
  const active = (activeRaw === "" || activeRaw === "TRUE" || activeRaw === "1" || activeRaw === "YES");

  return { partner, name, role, lat, lon, price, notes, active, state };
}

function getFilteredRows() {
  const selectedPartner = partnerSelect.value;
  const selectedState = stateSelect.value;
  const selectedRole = roleSelect.value;

  return allRows.filter(r => {
    if (!r.active) return false;
    
    const partnerOk = (selectedPartner === "All") || (r.partner === selectedPartner);
    const roleOk = (selectedRole === "All") || (r.role === selectedRole);
    const stateOk = (selectedState === "All") || (r.state === selectedState);
    
    return partnerOk && roleOk && stateOk;
  });
}

function render() {
  markersLayer.clearLayers();
  circlesLayer.clearLayers();
  highlightLayer.clearLayers();


  const uiRadiusMiles = FIXED_RADIUS_MILES;
  const rows = getFilteredRows();

  // State coverage hint (shows message when State ≠ All and 0 results)
if (filterStatusEl) {
  const st = stateSelect.value;
  if (st && st !== "All" && rows.length === 0) {
    filterStatusEl.textContent = `No coverage currently listed for ${st}.`;
  } else {
    filterStatusEl.textContent = "";
  }
}

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
    const label = (r.partner && r.partner.trim().length) ? r.partner.trim()[0].toUpperCase() : "?";
    const icon = makeDotIcon(color, label);
    const marker = L.marker([r.lat, r.lon], { icon }).bindPopup(popupHtml);
    marker.addTo(markersLayer);
    

    const radiusMiles = FIXED_RADIUS_MILES;
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

  if (!lastJob) {
  const fitRows = rowsForAutoFit(rows).filter(r => isValidLatLon(r.lat, r.lon));
  if (fitRows.length) {
    const b = L.latLngBounds(fitRows.map(r => [r.lat, r.lon]));
    map.fitBounds(b.pad(0.25));
  }
}
}

function fitToResults() {
  const rows = getFilteredRows().filter(r => isValidLatLon(r.lat, r.lon));
  const fitRows = rowsForAutoFit(rows);
  if (!fitRows.length) return;

  const b = L.latLngBounds(fitRows.map(r => [r.lat, r.lon]));
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

function setJobStatus(text) {
  jobStatus.textContent = text;
}

function clearJobResults() {
  jobResults.innerHTML = "";
}

function renderResultsList(items, title) {
  const container = document.createElement("div");
  container.style.marginTop = "10px";

  const heading = document.createElement("div");
  heading.style.fontWeight = "600";
  heading.style.marginBottom = "6px";
  heading.textContent = title;
  container.appendChild(heading);

  for (const it of items) {
    const row = document.createElement("div");
    row.style.padding = "8px";
    row.style.border = "1px solid #e5e7eb";
    row.style.borderRadius = "8px";
    row.style.marginBottom = "8px";

    row.innerHTML = `
      <div style="font-weight:600;">${it.name || "Unnamed"} (${it.role || "-"})</div>
      <div class="muted">Partner: ${it.partner || "-"} • ${it.city || ""} ${it.state || ""}</div>
      <div style="margin-top:4px;"><b>${it.distance.toFixed(1)} mi</b> from job • Radius: ${it.radiusMiles} mi</div>
    `;
    container.appendChild(row);
  }

  jobResults.appendChild(container);
}


function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Free geocoding via Photon (OpenStreetMap data), no API key.
// More browser-friendly than Nominatim for simple demos.
async function geocodeAddress(address) {
  const url =
    "https://photon.komoot.io/api/?limit=1&q=" +
    encodeURIComponent(address);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geocoding failed (${resp.status})`);

  const data = await resp.json();
  if (!data || !data.features || !data.features.length) return null;

  const f = data.features[0];
  const [lon, lat] = f.geometry.coordinates;

  // Build a readable display name
  const p = f.properties || {};
  const displayName = [
    p.name,
    p.city,
    p.state,
    p.country
  ].filter(Boolean).join(", ");

  return {
    lat: Number(lat),
    lon: Number(lon),
    displayName: displayName || address
  };
}

function highlightNearest(row) {
  highlightLayer.clearLayers();
  if (!row || !isValidLatLon(row.lat, row.lon)) return;

  const color = ROLE_COLOR[row.role] || "#6b7280";

  // Thicker outer ring (pulse)
  L.circleMarker([row.lat, row.lon], {
    radius: 20,
    weight: 5,
    color,
    fillOpacity: 0,
    className: "nearest-ring"
  }).addTo(highlightLayer);

  // Inner ring (static) for clarity
  L.circleMarker([row.lat, row.lon], {
    radius: 12,
    weight: 3,
    color,
    fillOpacity: 0
  }).addTo(highlightLayer);
}


function computeCoverageFromJob(jobLat, jobLon, jobLabel) {
  clearJobResults();

  // Place/replace job marker
  jobLayer.clearLayers();
  jobMarker = L.marker([jobLat, jobLon]).addTo(jobLayer)
    .bindPopup(`<b>Job Location</b><div style="margin-top:6px;">${jobLabel}</div>`);
  jobMarker.openPopup();

  // Keep the map focused on the job
  map.setView([jobLat, jobLon], Math.max(map.getZoom(), 9));

  // Score currently filtered resources
  const rows = getFilteredRows().filter(r => isValidLatLon(r.lat, r.lon));
  if (!rows.length) {
    setJobStatus("No technicians/electricians match the current filters.");
    return;
  }

  const uiRadiusMiles = FIXED_RADIUS_MILES;

  const scored = rows.map(r => {
  const radiusMiles = FIXED_RADIUS_MILES;
    const distance = haversineMiles(jobLat, jobLon, r.lat, r.lon);
    return { ...r, radiusMiles, distance, eligible: distance <= radiusMiles };
  }).sort((a, b) => a.distance - b.distance);

  const eligible = scored.filter(s => s.eligible);
  const outside = scored.filter(s => !s.eligible);

  if (eligible.length) {
    setJobStatus(`Found ${eligible.length} eligible resource(s) within radius.`);
    renderResultsList(eligible, "Inside radius (eligible)");
    highlightNearest(eligible[0]); // nearest eligible (sorted already)
    return;
  }

  // No eligible results → clear any prior highlight
  highlightLayer.clearLayers();
  

  // No eligible: show nearest outside, but cap to 250 miles
  const outsideCapped = outside.filter(x => x.distance <= MAX_OUTSIDE_MILES);

  if (!outsideCapped.length) {
    setJobStatus(
      `No resources are within radius, and none are within ${MAX_OUTSIDE_MILES} miles. You can zoom/pan manually to inspect.`
    );
    return;
  }

  setJobStatus(
    `No resources are within radius. Showing nearest outside radius (within ${MAX_OUTSIDE_MILES} miles).`
  );
  renderResultsList(
    outsideCapped.slice(0, 5), 
    `Nearest outside radius (≤ ${MAX_OUTSIDE_MILES} mi)`
  );
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

clearJobBtn.addEventListener("click", () => {
  jobAddressInput.value = "";
  lastJob = null;
  jobLayer.clearLayers();
  clearJobResults();
  setJobStatus('Enter an address and click “Check coverage”.');
  render(); // allows auto-fit again because lastJob is now null
  jobAddressInput.focus();
});

jobAddressInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    jobSearchBtn.click();
  }
});

resetAllBtn.addEventListener("click", () => {
  // reset dropdowns
  partnerSelect.value = "All";
  stateSelect.value = "All";
  roleSelect.value = "All";

  // reset job search
  jobAddressInput.value = "";
  lastJob = null;
  jobLayer.clearLayers();
  clearJobResults();
  setJobStatus('Enter an address and click “Check coverage”.');


  // re-render and fit to results
  render();
  fitToResults();
});


deptSelect?.addEventListener("change", () => {
  currentDept = deptSelect.value;

  // For Phase 1 we do NOT switch datasets yet.
  // Just a safe placeholder so nothing crashes.
  render();
});


partnerSelect.addEventListener("change", () => {
  render();
  if (lastJob) computeCoverageFromJob(lastJob.lat, lastJob.lon, lastJob.displayName);
});

roleSelect.addEventListener("change", () => {
  render();
  if (lastJob) computeCoverageFromJob(lastJob.lat, lastJob.lon, lastJob.displayName);
});

fitBtn.addEventListener("click", fitToResults);

stateSelect.addEventListener("change", () => {
  render();
  if (lastJob) {
    computeCoverageFromJob(lastJob.lat, lastJob.lon, lastJob.displayName);
  } else {
    zoomToState(stateSelect.value);
  }
});

  // --- Job Search Handler ---
jobSearchBtn.addEventListener("click", async () => {
  const address = (jobAddressInput.value || "").trim();
  clearJobResults();

  if (!address) {
    setJobStatus("Please enter a job address.");
    return;
  }

  setJobStatus("Looking up address…");

  try {
    const geo = await geocodeAddress(address);
    if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
      setJobStatus("No match found. Try adding city and state (e.g., “Fort Worth, TX”).");
      return;
    }

    lastJob = { lat: geo.lat, lon: geo.lon, displayName: geo.displayName || address };
    computeCoverageFromJob(lastJob.lat, lastJob.lon, lastJob.displayName);
    return;


    

  } catch (e) {
    console.error(e);
    setJobStatus(`Address lookup failed. Try a more specific address. (Details: ${e.message})`);
  }
});
