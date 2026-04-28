// Definiciones Proj4
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:32611", "+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32612", "+proj=utm +zone=12 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32613", "+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32614", "+proj=utm +zone=14 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32615", "+proj=utm +zone=15 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32616", "+proj=utm +zone=16 +datum=WGS84 +units=m +no_defs");

var map = L.map("map").setView([23.6, -102.5], 5);
L.tileLayer("https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap'
}).addTo(map);

let currentPolygon = null;
let markerGroup = L.layerGroup().addTo(map);

function updateUI() {
    const method = document.getElementById('inputMethod').value;
    const crs = document.getElementById('crsSelect').value;
    const container = document.getElementById('dynamicContent');
    
    // Definir etiquetas según el CRS
    const labelY = (crs === 'EPSG:4326') ? "LATITUD (Y)" : "NORTE (Y)";
    const labelX = (crs === 'EPSG:4326') ? "LONGITUD (X)" : "ESTE (X)";
    const placeholderY = (crs === 'EPSG:4326') ? "20.96" : "2318544";
    const placeholderX = (crs === 'EPSG:4326') ? "-89.62" : "227410";

    if (method === 'csv') {
        container.innerHTML = `<label>Subir CSV:</label><input type="file" id="csvFile" accept=".csv">`;
    } else {
        container.innerHTML = `
            <table class="coord-table">
                <thead>
                    <tr>
                        <th style="width:30px">ID</th>
                        <th id="th-y">${labelY}</th>
                        <th id="th-x">${labelX}</th>
                        <th style="width:30px"></th>
                    </tr>
                </thead>
                <tbody id="coordBody">
                    ${createRow(1, placeholderY, placeholderX)}
                    ${createRow(2, placeholderY, placeholderX)}
                    ${createRow(3, placeholderY, placeholderX)}
                </tbody>
            </table>
            <button id="addRowBtn" type="button" style="background:#6c757d; font-size:10px">+ Fila</button>
        `;
        document.getElementById('addRowBtn').onclick = () => {
            const tbody = document.getElementById('coordBody');
            const newRow = document.createElement('tr');
            newRow.innerHTML = createRow(tbody.children.length + 1, placeholderY, placeholderX);
            tbody.appendChild(newRow);
        };
    }
}

function createRow(id, phY, phX) {
    return `<tr>
        <td><input type="text" class="id-in" value="${id}"></td>
        <td><input type="text" class="lat-in" placeholder="${phY}"></td>
        <td><input type="text" class="lon-in" placeholder="${phX}"></td>
        <td><button class="remove-row" title="Eliminar fila" onclick="this.parentElement.parentElement.remove()">×</button></td>
    </tr>`;
}

function parseCoord(val) {
    if (!val) return NaN;
    let s = val.toString().trim().replace(/,/g, '.');
    const parts = s.split(/[\s°'"]+/).filter(p => p !== "");
    if (parts.length >= 2) {
        let dd = parseFloat(parts[0]) + (parseFloat(parts[1]||0)/60) + (parseFloat(parts[2]||0)/3600);
        if (s.startsWith('-') || /[SWO]/i.test(s)) dd = -Math.abs(dd);
        return dd;
    }
    return parseFloat(s);
}

async function draw() {
    const crs = document.getElementById('crsSelect').value;
    let dataPoints = [];

    if (document.getElementById('inputMethod').value === 'csv') {
        const file = document.getElementById('csvFile').files[0];
        if (!file) return alert("Selecciona un archivo");
        const text = await file.text();
        const results = Papa.parse(text, { header: true, skipEmptyLines: true });
        dataPoints = results.data.map((r, i) => ({
            id: r.id || (i + 1),
            lat: parseCoord(r.lat || r.norte || r.y || Object.values(r)[0]),
            lon: parseCoord(r.lon || r.este || r.x || Object.values(r)[1])
        }));
    } else {
        const rows = document.querySelectorAll('#coordBody tr');
        rows.forEach(row => {
            const id = row.querySelector('.id-in').value;
            const lat = parseCoord(row.querySelector('.lat-in').value); // Representa Y (Lat o Norte)
            const lon = parseCoord(row.querySelector('.lon-in').value); // Representa X (Lon o Este)
            if (!isNaN(lat) && !isNaN(lon)) dataPoints.push({ id, lat, lon });
        });
    }

    if (dataPoints.length < 3) return alert("Necesitas al menos 3 vértices.");

    if (currentPolygon) map.removeLayer(currentPolygon);
    markerGroup.clearLayers();

    const finalLatLngs = dataPoints.map(p => {
        let leafCoords;
        if (crs === 'EPSG:4326') {
            leafCoords = [p.lat, p.lon];
        } else {
            // Proj4: [X, Y] -> [Este, Norte]
            const trans = proj4(crs, 'EPSG:4326', [p.lon, p.lat]);
            leafCoords = [trans[1], trans[0]]; 
        }

        L.circleMarker(leafCoords, { radius: 4, color: 'red', fillOpacity: 1 })
            .addTo(markerGroup)
            .bindTooltip(`${p.id}`, { permanent: true, direction: 'right', className: 'leaflet-tooltip-own' });

        return leafCoords;
    });

    currentPolygon = L.polygon(finalLatLngs, { color: '#007bff', weight: 2 }).addTo(map);
    map.fitBounds(currentPolygon.getBounds());
}

document.getElementById('drawBtn').onclick = draw;
document.getElementById('clearBtn').onclick = () => {
    if(currentPolygon) map.removeLayer(currentPolygon);
    markerGroup.clearLayers();
    updateUI();
};

document.getElementById('exportBtn').onclick = () => {
    if(!currentPolygon) return alert("Dibuja un polígono primero");
    const pts = currentPolygon.getLatLngs()[0];
    let kmlStr = pts.map(p => `${p.lng},${p.lat},0`).join('\n') + `\n${pts[0].lng},${pts[0].lat},0`;
    const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Poligono Exportado</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${kmlStr}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    const blob = new Blob([kml], {type: 'application/vnd.google-earth.kml+xml'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'poligono.kml'; a.click();
};

// Listeners para actualizar la tabla dinámicamente
document.getElementById('inputMethod').onchange = updateUI;
document.getElementById('crsSelect').onchange = updateUI;

updateUI();
