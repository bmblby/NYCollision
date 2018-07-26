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
  clear();
  let currentDisplay = document.querySelector('li.nav-item:nth-child(2) > a:nth-child(1)');
  currentDisplay.text = e.target.text;
})

var secLvl = 'Level0';
let secList = document.querySelector('.sec-lvl')
secList.addEventListener('click', function (e) {
  secLvl = e.target.attributes.value.value;
  if (reqData.length != 0) {
    highlightPath(secLvl, 'lawngreen', 'orangered');
  }
});

let homeBtn = document.querySelector('.navbar-brand');
homeBtn.addEventListener('click', function (e) {
  clear();
});

function clear() {
  // mymap.removeLayer(killed);
  // mymap.removeLayer(injured)
  mymap.eachLayer(function (layer) {
    if (layer.hasOwnProperty('feature')) {
      layer.remove();
    }
  })
  reqData = [];
  points = [];
  secLvl = 'Level0';
}

// layer controls leaflet
var killed = L.layerGroup();
var injured = L.layerGroup();
var accidentType = {
  'killed': killed,
  'injured': injured
}

let mymap = L.map('mapid', {
  center: [40.689038, -73.984000],
  zoom: 10.5,
  layer: [accidentType]
});
L.control.layers(accidentType).addTo(mymap);
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

let old_secLvl = secLvl;
let reqData = [];
let points = [];
let lastQuery = [];
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

// TODO: cannot find css path
// let altPaths = document.querySelector('li.nav-item:nth-child(5) > a:nth-child(1)');
// altPaths.addEventListener('click', function (e) {
//   let user = document.querySelector('li.nav-item:nth-child(3) > a:nth-child(1)').text;
//   console.log(lastQuery);
//   send({
//     source: lastQuery[0],
//     target: lastQuery[1]
//   }, 'pgr_ksp', secLvl, user);
// })

let routeMeBtn = document.querySelector('#routeMe');
routeMeBtn.addEventListener('click', function (e) {
  let user = document.querySelector('li.nav-item:nth-child(2) > a:nth-child(1)').text;
  if (secLvl !== old_secLvl) {
    // hide original path
    console.log(reqData);
    mymap.eachLayer(function (layer) {
      if(layer.hasOwnProperty('feature')) {
        if (layer.feature.properties.secLvl === old_secLvl) {
          layer.setStyle({color: '#778899'});
          console.log(layer.feature.properties.secLvl);
        }
      }
    })
  }
  if(points.length == 2) {
    let data = {
      source: points[0],
      target: points[1]
    };
    send(data, 'pgr_dijkstra', secLvl, user);
    lastQuery = points;
    old_secLvl = secLvl;
    // points = [];
  }
  else {
    console.log('not enough points set in the application.');
  }
  // let featCol = turf.featureCollection(points);
  // console.log(featCol);
});


function send(data, task, lvl, user) {
  // TODO: check for set parameter bevor sending req to server
  let url = 'http://localhost:3000/route';

  let packageData = {
    method: task,
    secLvl: lvl,
    user: user,
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
  .then((res) => {
    // get featCol with geoJSON path
    console.log('Server response: ', res);
    res.features.forEach(f => {
      f.properties.secLvl = lvl;
    })
    let leaflet_id = colorPath(res, 'lawngreen', 'orangered', user);
    console.log(mymap);

    reqData.push({
      data: res,
      secLvl: lvl,
      source: data.source,
      target: data.target,
      leafletId: leaflet_id
    });
  })
}

function highlightPath(secLevel, minColor, maxColor) {
  console.log(secLevel);
  let d = reqData.find(d => d.secLvl === secLvl);
  console.log(d);
  let min = _.minBy(d.data.features, 'properties.user_killed');
  let max = _.maxBy(d.data.features, 'properties.user_killed');
  // console.log(min.properties.cost, max.properties.cost);
  let color = d3.scaleLinear()
    .domain([min.properties.user_killed, max.properties.user_killed])
    .range([minColor, maxColor])
  mymap.eachLayer(function (layer) {
    if(layer.hasOwnProperty('feature')) {
      if(layer.feature.properties.secLvl === secLvl) {
        let cost = layer.feature.properties.user_killed;
        layer.bringToFront();
        layer.setStyle({color: color(cost)})
      }
      else {
        layer.setStyle({color: '#778899'});
      }
    }
  })
}

function colorPath(data, minColor, maxColor, user) {
  // add to killed layer
  let min = _.minBy(data.features, 'properties.user_killed');
  let max = _.maxBy(data.features, 'properties.user_killed');
  let color = d3.scaleLinear()
    .domain([min.properties.user_killed, max.properties.user_killed])
    .range([minColor, maxColor])
  let handle = L.geoJSON(data, {
    style: function (f) {
      let cost = f.properties.user_killed;
      return {color: color(cost).toString()};
    }
  })
  .bindTooltip(function (layer) {
    if (user === 'Car') {
      let msg = 'Car accidents killed: ' +layer.feature.properties.user_killed+
        '\n' + 'Car accidents injured: ' +layer.feature.properties.user_injured;
      return msg;
    }
    else {
      let msg = user.toString() + ' killed: ' +layer.feature.properties.user_killed+
        '\n' + user.toString() + ' injured: ' +layer.feature.properties.user_injured;
      return msg;
    }
  })
  .addTo(killed);

  //add to injured layer
  min = _.minBy(data.features, 'properties.user_injured');
  max = _.maxBy(data.features, 'properties.user_injured');
  color = d3.scaleLinear()
    .domain([min.properties.user_injured, max.properties.user_injured])
    .range([minColor, maxColor])
  let handle_injured = L.geoJSON(data, {
    style: function (f) {
      let cost = f.properties.user_injured;
      return {color: color(cost).toString()};
    }
  })
  .bindTooltip(function (layer) {
    if (user === 'Car') {
      let msg = 'Car accidents injured: ' +layer.feature.properties.user_injured+
        '\n' + 'Car accidents injured: ' +layer.feature.properties.user_injured;
      return msg;
    }
    else {
      let msg = user.toString() + ' injured: ' +layer.feature.properties.user_injured+
        '\n' + user.toString() + ' injured: ' +layer.feature.properties.user_injured;
      return msg;
    }
  })
  .addTo(injured);
  return handle._leaflet_id;
}
