'use strict';

const fs = require('fs');
const turf = require('@turf/turf');
const array = require('lodash/array');

const path = require("path");
const express = require("express");
const bodyParser = require('body-parser');
const pgp = require('pg-promise')({
  // insert options for database
});

// pgp code
const cn = "postgres://giuli@localhost:5432/postgres";
const db = pgp(cn);
module.export = db;

// Basic server setup
var DIST_DIR = path.join(__dirname, "dist"),
    PORT = 3000,
    app = express();

//Serving the files on the dist folder
app.use(express.static(DIST_DIR));
app.use(bodyParser.json());

app.listen(PORT);

// Database handling inserts, changes and deletion

function insert2DB(data) {
  if(data.points.length !== 0) {
    insertTable(data.points, 'points');
  }
  if(data.lines.length !== 0) {
    insertTable(data.lines, 'lines');
  }
  if(data.paths.length !== 0) {
    insertTable(data.paths, 'lines');
  }
  if(data.polygons.length !== 0) {
    insertTable(data.polygons, 'polygons');
  }
}

function insertTable(data, table) {
  data.forEach((d) => {
    console.log('Object to insert: \n',d);
    d.geometry.crs = {
      type: 'name',
      properties: {
        name: 'EPSG:4326'
      }
    }
    db.none('INSERT INTO ' + table.toString() + '(geom)\
     VALUES (ST_GeomFromGeoJSON(${geoJSON}))', {
      geoJSON: d.geometry
    })
    .then(() => {
      // console.log("DATA: ", data);
      console.log('success insert: ' + d.geometry.type
                  + ' id: ', d.properties.id);
    })
    .catch(error => {
      console.log("ERROR: ", error);
    })
  });
}

function createBorder(pathToJSON, table) {
  fs.readFile(pathToJSON,
    {encoding: 'UTF-8'},
    (err, data) => {

    let geoJSON = JSON.parse(data);
    geoJSON.features.forEach(f => {
      f.geometry.crs = {
        type: 'name',
        properties: {
          name: 'EPSG:4326'
        }
      }
      db.none('INSERT INTO germany_border(geom)\
        VALUES (ST_GeomFromGeoJSON(${geoJSON}))', {
        // table: table,
        geoJSON: f.geometry
      })
      .then((d) => {
        console.log(f.geometry);
        console.log('success insert: ');
      })
      .catch(error => {
        console.log("ERROR: ", error);
      })
    });
  });
}
// createBorder('./data/community_districts.geojson');


function addSRID(feature) {
  feature.geometry.crs = {
    type: "name",
    properties: {
      name: "EPSG:4326"
    }
  };
  return feature;
}

app.post('/getRoute', (req, res) => {
  let d = req.body.data;
  let source = addSRID(d.source);
  let target = addSRID(d.target);
  let featCol = turf.featureCollection([source, target]);
  featCol.features.forEach(f => console.log(f.geometry));


  // get route back from db and send featCol of routing path
  let sourceQuery = "SELECT gid, source, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${source})\
                            LIMIT 1;"

  let targetQuery = "SELECT gid, target, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${target})\
                            LIMIT 1;"

  // TODO: req route path with two ids
  // let routeQuery = "SELECT st_asgeojson(the_geom)"


  db.task(t => {
    return t.one(sourceQuery, {
      source: featCol.features[0].geometry
    }).then(source => {
      return t.one(targetQuery, {
        target: featCol.features[1].geometry
      }).then(target => {
        console.log(source.source, target.target);
        let routeQuery = 'SELECT\
                    st_asgeojson(ways.the_geom)\
                    FROM (SELECT * FROM pgr_dijkstra(\
                      \'SELECT gid as id, source, target, length_m as cost FROM ways\', '+
                      target.target.toString() + ', ' +
                      source.source.toString()
                      +')) as route\
                      LEFT OUTER JOIN ways ways ON ways.gid = route.edge';
        return t.any(routeQuery).then(result => {
          return result.filter(d => d.st_asgeojson != null);
        })
      })
    });
  }).then(data => {
    let segments = data.map(f => turf.feature(JSON.parse(f.st_asgeojson)))
    let featCol = turf.featureCollection(segments);
    // console.log(featCol);
    res.json(featCol);

  }).catch(error => {
    console.error(error);
  })

});
