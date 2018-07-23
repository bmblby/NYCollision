'use strict';

import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

import * as d3 from "d3";
import _ from 'lodash';

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as turf from '@turf/turf';

import "../css/style.css";
import '../css/template.css';

// bootstrap layout
let vehType = document.querySelector('.vehicle-type');
vehType.addEventListener('click', function (e) {
  // console.log(e.target.text);
  let currentDisplay = document.querySelector('li.nav-item:nth-child(2) > a:nth-child(1)');
  currentDisplay.text = e.target.text;
})

let secLvl = document.querySelector('.sec-lvl');
secLvl.addEventListener('click', function (e) {
  console.log(e.target.text);
  let text = e.target.text.slice(0, 5);
  let currentDisplay = document.querySelector('li.nav-item:nth-child(4) > a:nth-child(1)');
  currentDisplay.text = text;
})

let homeBtn = document.querySelector('.navbar-brand');
homeBtn.addEventListener('click', function (e) {
  let leafletGroup = document.querySelector('svg.leaflet-zoom-animated > g:nth-child(1)');
  while(leafletGroup.hasChildNodes()) {
    leafletGroup.removeChild(leafletGroup.lastChild);
  }
});


let mymap = L.map('mapid').setView([40.689038, -73.984000], 10.5);
mymap.setMinZoom(11);
// mymap.setBounds(L.bounds(L.points(-74.257965, 40.492915), L.points(-73.705215, 40.869911)))
// console.log(mymap.getBounds());

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoiYm1ibGJ5IiwiYSI6ImNqaDg4cXFhbTAxNW0zM3FkZTFpamx6YXEifQ.-R9m-vKuOfwwG_NujYk7iw'
}).addTo(mymap);

// draw points, lines and Polygons

var geoJSONLayer = {};
window.onload = function() {
}


let points = [];

// set 2 points for start and end of route
let markerOptions = {
  radius: 5,
  fillColor: "#3388ff",
  color: "#ffffff",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.8
}

mymap.addEventListener('click', (e) => {
  let point = L.circleMarker(e.latlng).toGeoJSON();
  L.geoJSON(point, {
    pointToLayer: (feat, latLng) => {
      return L.circleMarker(latLng, markerOptions);
    }
  }).addTo(mymap);

  if (points.length  < 2) {
    points.push(point);
  }
  console.log(points);
})

let routeMeBtn = document.querySelector('#routeMe');
routeMeBtn.addEventListener('click', function (e) {
  if(points.length == 2) {
    send({
      source: points[0],
      target: points[1]
    }, 'getRoute')
    points = [];
  }
  else {
    console.log('not enough points set in the application.');
  }
  // let featCol = turf.featureCollection(points);
  // console.log(featCol);
});


function send(data, task) {
  let url = 'http://localhost:3000/' + task.toString();

  let packageData = {
    task: task,
    data: data
  }
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(packageData),
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }).then(res => res.json())
  .catch(error => console.error('Error: ', error))
  .then((data) => {
    // get featCol with geoJSON path
    console.log(data);
    L.geoJSON(data).addTo(mymap);
  })

}
