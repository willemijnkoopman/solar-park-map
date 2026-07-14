// ---------- Map setup ----------
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json', // clean, minimal, Apple-ish basemap
  center: [5.5, 52.2],
  zoom: 7,
  attributionControl: true,
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

let allFeatures = [];

map.on('load', async () => {
  const res = await fetch('data/solar_parks.geojson');
  const data = await res.json();
  allFeatures = data.features;

// LGN land use WMS layer (behind everything)
  map.addSource('lgn', {
    type: 'raster',
    tiles: [
      'https://service.pdok.nl/publieksdiensten/lgn/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=lgn2020&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'
    ],
    tileSize: 256,
    attribution: '© PDOK LGN',
  });
  map.addLayer({
    id: 'lgn-layer',
    type: 'raster',
    source: 'lgn',
    paint: { 'raster-opacity': 0.55 },
  });

  // Parks source
  map.addSource('parks', {
    type: 'geojson',
    data: data,
    generateId: true,
  });

  // Polygon fill (visible when zoomed in)
  map.addLayer({
    id: 'parks-fill',
    type: 'fill',
    source: 'parks',
    minzoom: 11,
    paint: {
      'fill-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'dT'], 0],
        -3, '#1a8f4f',
        0, '#f5d76e',
        3, '#d6452f'
      ],
      'fill-opacity': 0.85,
    }
  });

  // Polygon outline (visible when zoomed in)
  map.addLayer({
    id: 'parks-outline',
    type: 'line',
    source: 'parks',
    minzoom: 11,
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.5,
    }
  });

  // Circle markers (visible when zoomed out)
  map.addLayer({
    id: 'parks-circle',
    type: 'circle',
    source: 'parks',
    maxzoom: 11,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        6, 4,
        11, 10
      ],
      'circle-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'dT'], 0],
        -3, '#1a8f4f',
        0, '#f5d76e',
        3, '#d6452f'
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    }
  });

  // Labels layer on top (Positron with labels only)
  map.addSource('carto-labels', {
    type: 'raster',
    tiles: ['https://basemaps.cartocdn.com/rastertiles/positron_only_labels/{z}/{x}/{y}.png'],
    tileSize: 256,
    attribution: '© CARTO',
  });
  map.addLayer({
    id: 'carto-labels-layer',
    type: 'raster',
    source: 'carto-labels',
    paint: { 'raster-opacity': 1 },
  });

  // Fit map to all parks
  const bounds = new maplibregl.LngLatBounds();
  data.features.forEach(f => {
    const coords = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
    coords.forEach(c => bounds.extend(c));
  });
  map.fitBounds(bounds, { padding: 40 });

  populateProvinceFilter();
  bindFilterEvents();

  // Click to show details
['parks-fill', 'parks-circle'].forEach(layer => {
    map.on('click', layer, (e) => {
      if (!e.features.length) return;
      showPopup(e.features[0].properties);
    });
    map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
  });

});

// ---------- Province dropdown ----------
function populateProvinceFilter() {
  const provinces = [...new Set(allFeatures.map(f => f.properties.province).filter(Boolean))].sort();
  const select = document.getElementById('provinceFilter');
  provinces.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

// ---------- Filtering ----------
function bindFilterEvents() {
  const provinceSel = document.getElementById('provinceFilter');
  const capacitySlider = document.getElementById('capacityFilter');
  const capacityVal = document.getElementById('capacityVal');
  const waterSel = document.getElementById('waterFilter');

  [provinceSel, capacitySlider, waterSel].forEach(el => {
    el.addEventListener('input', applyFilters);
  });

  capacitySlider.addEventListener('input', () => {
    capacityVal.textContent = capacitySlider.value;
  });

  applyFilters();
}

function applyFilters() {
  const province = document.getElementById('provinceFilter').value;
  const minCapacity = Number(document.getElementById('capacityFilter').value);
  const waterType = document.getElementById('waterFilter').value;

  const filters = ['all'];
  if (province) filters.push(['==', ['get', 'province'], province]);
  if (minCapacity > 0) filters.push(['>=', ['coalesce', ['get', 'capacity_mwp'], 0], minCapacity]);
  if (waterType) filters.push(['==', ['get', 'on_water'], waterType]);

  map.setFilter('parks-fill', filters.length > 1 ? filters : null);
  map.setFilter('parks-outline', filters.length > 1 ? filters : null);
  map.setFilter('parks-circle', filters.length > 1 ? filters : null);

  // Update count
  const count = allFeatures.filter(f => {
    const p = f.properties;
    if (province && p.province !== province) return false;
    if (minCapacity > 0 && (p.capacity_mwp || 0) < minCapacity) return false;
    if (waterType && p.on_water !== waterType) return false;
    return true;
  }).length;

  document.getElementById('resultCount').textContent = `${count} park${count === 1 ? '' : 's'} shown`;
}

// ---------- Popup card ----------
function showPopup(p) {
  const card = document.getElementById('popup-card');
  const content = document.getElementById('popupContent');

  const dT = p.dT !== null && p.dT !== undefined ? Number(p.dT).toFixed(2) + ' °C' : '—';
  const dTClass = p.dT < 0 ? 'cooling' : (p.dT > 0 ? 'warming' : '');

  content.innerHTML = `
    <h3>${p.name || 'Unnamed park'}</h3>
    <p class="meta">${p.province || ''}${p.on_water === 'Ja' ? ' · Floating' : ''}</p>
    <div class="stat-grid">
      <div class="stat"><span class="label">Capacity</span><span class="value">${p.capacity_mwp ?? '—'} MWp</span></div>
      <div class="stat"><span class="label">Area</span><span class="value">${p.area_ha ?? '—'} ha</span></div>
      <div class="stat"><span class="label">Panels</span><span class="value">${p.num_panels ?? '—'}</span></div>
      <div class="stat"><span class="label">Commissioned</span><span class="value">${p.year_commissioned ?? '—'}</span></div>
      <div class="stat"><span class="label">ΔLST</span><span class="value ${dTClass}">${dT}</span></div>
      <div class="stat"><span class="label">Effect</span><span class="value">${p.dT_category ?? '—'}</span></div>
    </div>
  `;
  card.classList.remove('hidden');
}

document.getElementById('popupClose').addEventListener('click', () => {
  document.getElementById('popup-card').classList.add('hidden');
});

// ---------- Filter panel toggle ----------
document.getElementById('filterToggle').addEventListener('click', () => {
  document.getElementById('panel').classList.toggle('hidden');
});
