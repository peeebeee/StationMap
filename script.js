const JSONURL =
  "https://1090mhz.uk/station_perf.php?key=S89n5YaMuaEXFZwFBAaT4L3uKs9T6xT8";
const rad100nm = 185200; // 100 nm in metres
const rad200nm = 370400; // 200 nm in metres
const rad300nm = 555600; // 300 nm in metres
const m2nm = 0.000539957; // 1m in nm
const R = 3443.92; // earth radius in nm
const nocoverage = "No coverage";

var map;
var maxLayer = L.layerGroup();
var aveLayer = L.layerGroup();
var markerLayer = L.layerGroup();
var stationLayer = L.layerGroup();
var circleLayer = L.layerGroup();

var layers = {
  "Station markers": markerLayer,
  "Max distance": maxLayer,
  "Average distance": aveLayer,
};

// For a given latng return an HTML snippet of all the stations whose average distance polygon
// it's covered by, and the rounded distance in nm from those stations. Returns 'No coverage' if none.

function getNearestStations(latlng) {
  var gotone = 0;
  var output = "<table><tbody>";
  markerLayer.eachLayer(function (layer) {
    if (layer.polyave.contains(latlng)) {
      output +=
        "<tr><td>" +
        layer.stationName +
        "</td><td ALIGN=RIGHT>" +
        Math.round(map.distance(layer.getLatLng(), latlng) * m2nm) +
        "</td></tr>";
      gotone = 1;
    }
  });
  output += "</tbody></table>";
  return gotone > 0 ? output : nocoverage;
}
// for given start coords, return a point at a given distance (nm) and bearing from the
// start coords

function getCoordFromDistanceBearing(startcoods, dist, bearing) {
  var lat1 = startcoods.lat * (Math.PI / 180);
  var lon1 = startcoods.lng * (Math.PI / 180);
  var lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dist / R) +
      Math.cos(lat1) * Math.sin(dist / R) * Math.cos(bearing * (Math.PI / 180))
  );
  var lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing * (Math.PI / 180)) * Math.sin(dist / R) * Math.cos(lat1),
      Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  };
}

// General-purpose debug output of raw JSON data for a given marker
function debugOutput(layer) {
  console.log(layer.rawdata);
}

// Get the map back to initial state with station markers visible
function resetLayers() {
  stationLayer.clearLayers();
  maxLayer.removeFrom(map);
  aveLayer.removeFrom(map);
  circleLayer.clearLayers();
  markerLayer.addTo(map);
}

// Switch to single-station view for a given marker

function isolateStation(layer) {
  stationLayer.clearLayers();
  maxLayer.removeFrom(map);
  aveLayer.removeFrom(map);
  markerLayer.removeFrom(map);

  layer.polyave.addTo(stationLayer);
  layer.polymax.addTo(stationLayer);
  layer.addTo(stationLayer);

  // add the concentric circles around the marker (could be prettier)

  circleLayer.clearLayers();
  L.circle(layer.getLatLng(), rad100nm, {
    color: "grey",
    weight: 1,
    fillOpacity: 0.0,
  }).addTo(circleLayer);

  L.circle(layer.getLatLng(), rad200nm, {
    color: "grey",
    weight: 1,
    fillOpacity: 0.0,
  }).addTo(circleLayer);

  L.circle(layer.getLatLng(), rad300nm, {
    color: "grey",
    weight: 1,
    fillOpacity: 0.0,
  }).addTo(circleLayer);

  debugOutput(layer);
}

// Main loop on page load

$(document).ready(function () {
  // Initialise the Leaflet map
  map = L.map("map").setView([52.195346022693265, -2.2239665315347334], 6);

  L.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Clicking anywhere on the map except on a marker resets the map

  map.on("click", function (e) {
    resetLayers();
  });
  // The checkbox control for selecting layers

  var layerControl = L.control
    .layers(null, layers, { collapsed: false })
    .addTo(map);

  // The station marker and circles layer are empty for now but add them to the map

  stationLayer.addTo(map);
  circleLayer.addTo(map);

  // Set up the right-click to create and display the coverage popup

  map.on("contextmenu", (e) => {
    map.closePopup();
    L.popup()
      .setLatLng(e.latlng)
      .setContent(getNearestStations(e.latlng))
      .addTo(map)
      .openOn(map);
  });






  // Load the JSON data
  $.getJSON(JSONURL, function (data) {
    // Iterate over the top-level objects
    for (var i = 0; i < data.length; i++) {
      if (data[i].online == false) {
        // ignore if not 'online'
        continue;
      }
      // Get the 'pos' object from the JSON, make a latLng from it

      var pos = data[i].pos;
      var LL = L.latLng(pos.lat, pos.lng);
      var max = [],
        ave = [];
      // For 36 direction buckets, push a latLng for the ave and max distaces
      for (var j = 0; j < 36; j++) {
        max.push(getCoordFromDistanceBearing(LL, data[i].perf[j].max, 10 * j));
        ave.push(getCoordFromDistanceBearing(LL, data[i].perf[j].ave, 10 * j));
      }
      // For the ave and max arrays, build a polygon and add them to the right layerGroup

      var polymax = L.polygon(max, {
        color: "red",
        weight: 0.5,
        fillOpacity: 0.1,
      }).addTo(maxLayer);

      var polyave = L.polygon(ave, {
        color: "blue",
        weight: 0.5,
        fillOpacity: 0.1,
      }).addTo(aveLayer);

      // Build a marker for the station location and annotate it with the station data so we can
      // always reference all the data for the station given the marker object

      var marker = L.marker(LL);
      marker.bindTooltip(data[i].name);
      marker.stationID = data[i].id;
      marker.stationName = data[i].name;
      marker.polyave = polyave;
      marker.polymax = polymax;
      marker.rawdata = data[i];
      marker.on("click", function () {
        isolateStation(this);
      });

      markerLayer.addLayer(marker);

      markerLayer.addTo(map);
    }
  });
});
