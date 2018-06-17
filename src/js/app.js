'use strict';

import * as d3 from "d3";
import _ from 'lodash';
import "leaflet/dist/leaflet.css";
import "../css/style.css";
import L from "leaflet";

let mymap = L.map('mapid').setView([50.85, 9.88], 5.5);
console.log("ready to go on in the tutorial!");

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoiYm1ibGJ5IiwiYSI6ImNqaDg4cXFhbTAxNW0zM3FkZTFpamx6YXEifQ.-R9m-vKuOfwwG_NujYk7iw'
}).addTo(mymap);

// draw points, lines and Polygons

let globalID = 0;
let points = [];
let lines = [];
let paths = [];
let polygons = [];

let polyline = [];
let polygon = [];

let radioBtn = document.querySelector('.radio-btn');
radioBtn.addEventListener("click", (e) => {
  let button = e.originalTarget.value;
  if (button === "point") {
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      L.circleMarker(e.latlng).addTo(mymap);
      globalID += 1;
      points.push({
        id: globalID,
        point_geom: e.latlng
      })
      // console.log(points);
    })
  }
  else if(button === "line") {
    var line = [];
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      line.push(e.latlng);
      if (line.length == 2) {
        L.polyline(line, {color: 'red'}).addTo(mymap);
        globalID += 1;
        lines.push({
          id: globalID,
          line_geom: line
        })
        line = [];
      }
      // console.log(lines);
    });
  }
  else if(button === "polyline") {
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      polyline.push(e.latlng);
      L.polyline(polyline, {color: 'red'}).addTo(mymap);
      // console.log('polyline: ', polyline);
    });
  }
  else if (button === "polygon") {
    mymap.removeEventListener();
    mymap.addEventListener('click', (e) => {
      polygon.push(e.latlng);
      L.polyline(polygon, {color: 'green'}).addTo(mymap);
      // console.log('polygon: ', polygon);
    });
  }
})

let finishBtn = document.querySelector('button');
finishBtn.addEventListener('click', (e) => {
  let radioBtn = document.querySelector('[name=geom-mode]:checked');
  if (radioBtn.value === 'polyline') {
    globalID += 1;
    paths.push({
      id: globalID,
      paths_geom: polyline
    })
    polyline = [];
    console.log('paths', paths);
  }
  else if (radioBtn.value === 'polygon') {
    L.polygon(polygon, {color: 'green'}).addTo(mymap);
    globalID += 1;
    polygons.push({
      id: globalID,
      polygon_geom: polygon
    })
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
  console.log("send geometries to server: ", geometries);
  send(geometries, 'localhost', 3000);
});

let clearBtn = document.querySelector('[name=clear-db]');

function send(data, host, port) {
  let url = 'http://';
  url = url + host.toString() + ':' + port.toString();
  data.task = 'insert';

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
      "test": "Is this a Test?"
    }),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((res) => {
    console.log(res.test);
  })
}

getGermanyShape();
// console.log(stuff);
