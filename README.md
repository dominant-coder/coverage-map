# coverage-map
Interactive coverage map for Service Partners showing technician and electrician locations, service radius, and pricing.

## EVPassport Coverage Map

This repository hosts a lightweight, browser-based coverage map used to visualize Service Partner resources (Technicians and Electricians), their coverage radius, and whether a specific job address is within coverage.

The map is hosted using GitHub Pages and reads data directly from `data.csv` in this repository.

---

## How to use the map

1. Open the live map (GitHub Pages).
2. Use the filters at the top:
   - **Service Partner**
   - **State**
   - **Role** (Technician / Electrician)
3. Enter a **Job address** and press **Enter** (or click **Check coverage**).
4. Review:
   - Eligible resources inside radius (sorted by nearest)
   - If none are eligible, the nearest outside-radius resources (capped at 250 miles)

---

## Updating coverage data

All map data is stored in `data.csv`.

### Process
1. Open `data.csv` in GitHub.
2. Click **Edit** (pencil icon).
3. Add or update rows.
4. Commit changes to `main`.
5. Refresh the live map page to load the latest data.

### Required fields (minimum)
- `partner`
- `role` (Technician or Electrician)
- `lat`
- `lon`
- `active` (TRUE/FALSE)

### Recommended fields
- `state` (2-letter code, e.g., TX)
- `name`
- `service_radius_miles`
- `price`
- `notes`

---

## Exporting results

Current export approach:
- Run a job search
- Copy the results list from the sidebar into email/notes

Planned enhancement (optional next step):
- Add an **Export CSV** button to download eligible results for the searched job address.

