# Dutch Solar Park Database

An interactive map presenting a geodatabase of 206 Dutch solar parks (>4 ha, 2016–2025),
including capacity, panel count, land use, and local thermal impact (ΔLST), developed
as part of an MSc thesis.

## Tech stack
- [MapLibre GL JS](https://maplibre.org/) (free, open-source, no API key required)
- [CARTO Positron basemap](https://carto.com/basemaps) (clean, minimal style)
- Plain HTML/CSS/JS — no build step

## Running locally
Because browsers block `fetch()` on local files, serve the folder with any static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploying to GitHub Pages
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under "Build and deployment", select **Deploy from a branch**, choose `main` and `/ (root)`.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`.

## Data
`data/solar_parks.geojson` contains the cleaned dataset with the following fields per park:

| Field | Description |
|---|---|
| name | Park name |
| province | Dutch province |
| capacity_mwp | Installed capacity (MWp) |
| num_panels | Number of solar panels |
| year_construction | Construction year |
| year_commissioned | Commissioning year |
| on_water | "Ja" if floating, "Nee" if ground-mounted |
| client / contractor | Project client and contractor (where known) |
| area_ha | Polygon area in hectares |
| dT | Additional local land surface temperature change (°C) |
| dT_category | Categorical thermal effect (e.g. cooling/warming) |
| source | Source URL for project information |

## Customization
- **Colors / fonts**: edit `style.css` (CSS variables at the top control the theme).
- **Filters**: edit the filter logic in `script.js` (`applyFilters`).
- **Basemap**: swap the `style:` URL in `script.js` for any MapLibre-compatible style
  (e.g. [MapTiler](https://www.maptiler.com/) for more options, requires free API key).

## About / contact
Update the "About" section in `index.html` with a link to the full thesis PDF and
your contact details.
