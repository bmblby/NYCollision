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
const cn = "postgres://giuli:test123@localhost:5432/hard_task";
const db = pgp(cn);
module.export = db;

// Basic server setup
var DIST_DIR = path.join(__dirname, "dist"),
    PORT = 3000,
    app = express();

// //Send index.html when the user access the web
// app.get("/", function (req, res) {
//   res.sendFile(path.join(DIST_DIR, "index.html"));
// });
// 
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

function createGermanyBorder() {
  fs.readFile('./data/germany.json',
    {encoding: 'UTF-8'},
    (err, data) => {

    let gerGeoJSON = JSON.parse(data);
    gerGeoJSON.geometry.crs = {
      type: 'name',
      properties: {
        name: 'EPSG:4326'
      }
    }
    db.none('INSERT INTO germanyjson(id, geom) VALUES (${id}, ST_GeomFromGeoJSON(${geoJSON}))', {
      id: 1,
      geoJSON: gerGeoJSON.geometry
    })
    .then(() => {
      // console.log("DATA: ", data);
      console.log('success insert: ' + gerGeoJSON.geometry.type
                  + ' id: 1');
    })
    .catch(error => {
      console.log("ERROR: ", error);
    })
  })
}
// createGermanyBorder();

function pointsInGer() {
  db.one('SELECT st_asgeojson(geom, 10, 1) FROM germanyjson')
    .then((data) => {
      let globalID = 0;
      let gerGeoJSON = JSON.parse(data.st_asgeojson);
      let points = turf.randomPoint(20000, {bbox: gerGeoJSON.bbox});
      let pointsGer = turf.pointsWithinPolygon(points, gerGeoJSON);
      pointsGer.features = array.slice(pointsGer.features, 1, 10001);

      pointsGer.features.forEach((feat) => {
        globalID += 1;
        feat.properties = {
          id: globalID
        }
        feat.geometry.crs = {
          type: 'name',
          properties: {
            name: 'EPSG:4326'
          }
        }

        db.none('INSERT INTO pointst1(id, geom) VALUES (${id}, ST_GeomFromGeoJSON(${geoJSON}))', {
            id: feat.properties.id,
            geoJSON: feat.geometry
          })
          .then()
          .catch((error) => {
            console.log('ERROR: ', error);
          });
      })
      console.log('inserted 10000 points within boundary of Germany');
    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
}
// pointsInGer();


app.post('/', (req, res) => {
  let d = req.body;
  console.log(d);

  if(d.task === 'germany') {
    let gerGeoJSON = {};
    db.task(t => {
      return t.one('SELECT st_asgeojson(geom, 10, 1) FROM germanyjson')
      .then((data) => {
        let globalID = 0;
        gerGeoJSON = JSON.parse(data.st_asgeojson);
        let points = turf.randomPoint(20000, {bbox: gerGeoJSON.bbox});
        let pointsGer = turf.pointsWithinPolygon(points, gerGeoJSON);
        pointsGer.features = array.slice(pointsGer.features, 1, 10001);

        pointsGer.features.forEach((feat) => {
          globalID += 1;
          feat.properties = {
            id: globalID
          }
          feat.geometry.crs = {
            type: 'name',
            properties: {
              name: 'EPSG:4326'
            }
          }

          t.none('INSERT INTO points(id, geom) VALUES (${id}, ST_GeomFromGeoJSON(${geoJSON}))', {
              id: feat.properties.id,
              geoJSON: feat.geometry
            })
            .then(d => {})
        })

        console.log('inserted 10000 points within boundary of Germany');

        return t.many('SELECT st_asgeojson(geom, 10) FROM points LIMIT 50')
          .then(points => {
            let Points = [];
            points.forEach(point => {
              Points.push(turf.feature(JSON.parse(point.st_asgeojson)));
            })
            return {
              ger:  gerGeoJSON,
              point: turf.featureCollection(Points)
            }
          })
      })
    }).then(data => {
      let pts = data.point;
      pts.features.forEach((p, i) => {
        let search = pts.features.filter(a => {
          if(!turf.booleanEqual(a, p)) {
            return true;
          }
        });
        let searchCol = turf.featureCollection(search);
        let nearest = turf.nearestPoint(p, searchCol);
        let minDist = turf.distance(p, nearest);
        pts.features[i].properties.min = minDist;
        // console.log(p, nearest, minDist);
      })
      res.json({
        points: pts,
        ger: gerGeoJSON
      });

    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
  }
  else if(d.task === 'task2') {
    db.task(t => {
      // query points inside polygon
      let query = "SELECT st_asgeojson(poi. geom) \
        FROM polygons pol \
          JOIN points poi ON (st_within(poi.geom, pol.geom))";

      // query points on polygon border
      let query2 = "SELECT st_asgeojson(points.geom) \
        FROM points INNER JOIN polygons\
        ON st_dwithin(st_exteriorring(polygons.geom),points.geom,0.001)"

      return t.any(query)
        .then(ptsInside => {
          // let Points = [];
          return t.any(query2)
            .then(ptsBorder => {
              return {
                inside: ptsInside.map(p => JSON.parse(p.st_asgeojson)),
                border: ptsBorder.map(p => JSON.parse(p.st_asgeojson))
              };
            });
        })
    }).then((d) => {
        console.log(d);
        let features = [];
        for(let prop in d) {
          d[prop].forEach(f => {
            if(prop === "inside" && d[prop].length != 0) {
              let feat = turf.feature(f);
              feat.properties.color = '#ff0000';
              features.push(feat);
            }
            else if(prop === 'border' && d[prop].length != 0) {
              let feat = turf.feature(f);
              feat.properties.color = '#ff8200';
              features.push(feat);
            }
          });
        }
        let featCol = turf.featureCollection(features);
        res.json(featCol);
    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
  }
  else if(d.task === 'task4') {
    // db.task(t => {
    //   return t.many('SELECT st_asgeojson(geom, 10) FROM lines')
    //     .then(lines => {
    //       let Lines = [];
    //       return t.many('SELECT st_asgeojson(geom, 10) FROM polygons')
    //         .then(polys => {
    //           let Polys = [];
    //           polys.forEach(poly => {
    //             Polys.push(turf.feature(JSON.parse(poly.st_asgeojson)));
    //           })
    //           points.forEach(point => {
    //             Points.push(turf.feature(JSON.parse(point.st_asgeojson)));
    //           })
    //           return {
    //             lines: turf.featureCollection(Lines),
    //             poly: turf.featureCollection(Polys)
    //           };
    //         })
    //     })
    // }).then(data => {
    //   let lines = data.lines;
    //   let contain =
    // })
  }
  else if (d.task === "clear") {
    db.none('DELETE FROM points *');
    db.none('DELETE FROM lines *');
    db.none('DELETE FROM polygons *');

    res.json({
      test: 'cleared all entries from all entries!'
    });
  }
  else if (d.task === "insert") {
    console.log('inserting into database');
    insert2DB(d.data);
    res.json({
      test: "here goes the server response!"
    });
  }
  else if (d.task === "loadDatabase") {
    console.log('requesting new page');
    let pointQ = 'SELECT st_asgeojson(geom) FROM points';
    let lineQ = 'SELECT st_asgeojson(geom) FROM lines';
    let polygonQ = 'SELECT st_asgeojson(geom) FROM polygons';

    console.log('query server for existing geometries');
    db.task(t => {
      return t.any(pointQ)
        .then(points => {
          return t.any(lineQ)
            .then(lines => {
              return t.any(polygonQ)
                .then(polygons => {
                  return {
                    points: points.map(p => JSON.parse(p.st_asgeojson)),
                    lines: lines.map(l => JSON.parse(l.st_asgeojson)),
                    polygons: polygons.map(pol => JSON.parse(pol.st_asgeojson))
                  }
                })
            })
        })
    })
    .then(data => {
      // console.log(data);
      let features = [];
      for(let prop in data) {
        data[prop].forEach(d => features.push(turf.feature(d)));
      }
      let featCol = turf.featureCollection(features);
      res.json(featCol);
      // console.log(featCol);
    })
    .catch(error => {
      console.log('ERROR: ', error);
    });
  }
  else {
    res.json({
      test: 'No task specified! Please resend data with task!'
    });
  }
})



// webpack middleware setup

// const express = require('express');
// const webpack = require('webpack');
// const devMiddleware = require('webpack-dev-middleware');
// // const hotMiddleware = require('webpack-hot-middleware');
//
// const app = express();
// const config = require('./webpack.dev.js');
// const compiler = webpack(config);
//
// // Tell express to use the webpack-dev-middleware and use the webpack.config.js
// // configuration file as a base.
// app.use(devMiddleware(compiler, {
//   publicPath: config[0].output.publicPath,
//   writeToDisk: true
// }));
//
// // Attach hot middleware to same compiler as dev-middleware
// // app.use(hotMiddleware(compiler));
//
// // Serve the files on port 8080
// let PORT = 3000;
// app.listen(PORT, (req, res) => {
//   console.log("Example app listening on Port: ", PORT);
// })
