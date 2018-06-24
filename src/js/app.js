'use strict';

import * as d3 from "d3";
import _ from 'lodash';
import "leaflet/dist/leaflet.css";
import "../css/style.css";
import L from "leaflet";
import * as turf from '@turf/turf';

let mymap = L.map('mapid').setView([50.85, 9.88], 5.5);
console.log("ready to go on in the tutorial!");

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoiYm1ibGJ5IiwiYSI6ImNqaDg4cXFhbTAxNW0zM3FkZTFpamx6YXEifQ.-R9m-vKuOfwwG_NujYk7iw'
}).addTo(mymap);

// draw points, lines and Polygons

window.onload = function() {
  drawFromDatabase();
}

function drawFromDatabase() {
  let url = 'http://localhost:3000';
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      "task": "loadDatabase"
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((res) => {
    console.log(res);
    let markerOptions = {
      radius: 5,
      fillColor: "#3388ff",
      color: "#ffffff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    };
    L.geoJSON(res, {
      pointToLayer: (feature, latLng) => {
        if(feature.geometry.type === 'Point') {
          return L.circleMarker(latLng, markerOptions);
        }
      }
    }).addTo(mymap);
  })
}

let globalID = 0;
let points = [];
let lines = [];
let paths = [];
let polygons = [];

let polyline = [];
let polygon = [];

let radioBtn = document.querySelector('.radio-btn');
radioBtn.addEventListener("click", (e) => {
  let button = document.querySelector('[name=geom-mode]:checked');
  if (button.value === "point") {
    let markerOptions = {
      radius: 5,
      fillColor: "#3388ff",
      color: "#ffffff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      let point = L.circleMarker(e.latlng).toGeoJSON();
      L.geoJSON(point, {
        pointToLayer: (feat, latLng) => {
          return L.circleMarker(latLng, markerOptions);
        }
      }).addTo(mymap);
      globalID += 1;
      point.properties.id = globalID;
      points.push(point)
      console.log(point);
    })
  }
  else if(button.value === "line") {
    var line = [];
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      line.push(e.latlng);
      if (line.length == 2) {
        let lineGeo = L.polyline(line, {color: '#3388ff'}).toGeoJSON();
        L.geoJSON(lineGeo).addTo(mymap);
        globalID += 1;
        lineGeo.properties.id = globalID;
        lines.push(lineGeo)
        line = [];
      }
      // console.log(lines);
    });
  }
  else if(button.value === "polyline") {
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      polyline.push(e.latlng);
      L.polyline(polyline, {color: '#3388ff'}).addTo(mymap);
      // console.log('polyline: ', polyline);
    });
  }
  else if (button.value === "polygon") {
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      polygon.push(e.latlng);
      L.polyline(polygon, {color: 'steelblue'}).addTo(mymap);
      // console.log('polygon: ', polygon);
    });
  }
})

let finishBtn = document.querySelector('button');
finishBtn.addEventListener('click', (e) => {
  let radioBtn = document.querySelector('[name=geom-mode]:checked');
  if (radioBtn.value === 'polyline') {
    globalID += 1;
    let polylineGeo = L.polyline(polyline, {color: 'red'})
      .toGeoJSON();

    polylineGeo.properties.id = globalID;
    paths.push(polylineGeo);
    polyline = [];
    console.log('paths', paths);
  }
  else if (radioBtn.value === 'polygon') {
    let polygonGeo = L.polygon(polygon, {color: 'green'})
      .toGeoJSON();

    globalID += 1;
    polygonGeo.properties.id = globalID;
    L.geoJSON(polygonGeo).addTo(mymap);
    polygons.push(polygonGeo);
    polygon = [];
    console.log('polygons: ', polygons);

  }
})

let saveBtn = document.querySelector('[name=save-db]');
saveBtn.addEventListener('click', (e) => {
  let geometries = {
    points: points,
    lines: lines,
    paths: paths,
    polygons: polygons
  }
  let data = {
    task: 'insert',
    data: geometries
  }
  console.log("send geometries to server: ", geometries);
  send(data, 'localhost', 3000);
});

let clearBtn = document.querySelector('[name=clear-db]');
clearBtn.addEventListener('click', (e) => {
  let data = {
    task: 'clear'
  }
  send(data, 'localhost', 3000);
})

function send(data, host, port) {
  let url = 'http://';
  url = url + host.toString() + ':' + port.toString();

  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((data) => {
    console.log(data.test);
  })

}

// test connection to postgres database
function getGermanyShape() {
  let url = 'http://localhost:3000';
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      "task": "task1"
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((res) => {
    console.log(res);
    L.geoJSON(res.ger).addTo(mymap);

    let min = d3.min(res.points.features, (feat) => {
        return feat.properties.dist;
    })
    let max = d3.max(res.points.features, (feat) => {
        return feat.properties.dist;
    })
    console.log(min, max);
    let scale = d3.scaleLinear()
      .domain([min, max])
      .range([0.1, 10])

    L.geoJSON(res.points, {
      pointToLayer: (feat, latLng) => {
        return L.circleMarker(latLng, {
          radius: scale(feat.properties.dist),
          color: 'red'
        });
      }
    }).addTo(mymap);
  })
}


// TASK 1
let task1 = document.querySelector('[name=task-1]')
task1.addEventListener('click', (e) => {
  getGermanyShape();
})

// TASK 2
let task2 = document.querySelector('[name=task-2]')
task2.addEventListener('click', (e) => {
  let url = 'http://localhost:3000';
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      "task": "task2"
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((res) => {
    console.log(res);
    let markerOptions = {
      radius: 5,
      fillColor: "#ff0000",
      color: "#ffffff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    };
    L.geoJSON(res, {
      pointToLayer: (feature, latLng) => {
        if(feature.geometry.type === 'Point') {
          return L.circleMarker(latLng, markerOptions);
        }
      }
    }).addTo(mymap);
    // L.geoJSON(res, {
    //   style: feat => {return {color: feat.properties.color}}
    // }).addTo(mymap);
  })
})

// TASK 3
let task3 = document.querySelector('[name=task-3]')
task3.addEventListener('click', (e) => {
  // getGermanyShape();
})

// TASK 4
let task4 = document.querySelector('[name=task-4]')
task4.addEventListener('click', (e) => {
  let url = 'http://localhost:3000';
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      "task": "task4"
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((res) => {
    console.log(res);
    L.geoJSON(res, {
      style: f => {return {color: f.properties.color}}
    }).addTo(mymap);
  })

})

// TASK 5
let task5 = document.querySelector('[name=task-5]')
task5.addEventListener('click', (e) => {
  // getGermanyShape();
})
