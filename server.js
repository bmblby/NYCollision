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
const cn = "postgres://giuli@localhost:5432/hard_task";
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
// createBorder('./data/germany/germany.json', 'germany_border');

function pointsInGer() {
  db.one('SELECT st_asgeojson(geom, 10, 1) FROM germany_border')
    .then((data) => {
      let globalID = 0;
      let gerGeoJSON = JSON.parse(data.st_asgeojson);
      let points = turf.randomPoint(20000, {bbox: gerGeoJSON.bbox});
      let pointsGer = turf.pointsWithinPolygon(points, gerGeoJSON);
      pointsGer.features = array.slice(pointsGer.features, 1, 10001);

      pointsGer.features.forEach((feat) => {
        feat.geometry.crs = {
          type: 'name',
          properties: {
            name: 'EPSG:4326'
          }
        }

        db.none('INSERT INTO germany(geom) VALUES (ST_GeomFromGeoJSON(${geoJSON}))', {
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
  // console.log(d);

  if(d.task === 'task1') {
    db.task(t => {
      return t.any('select points.id, \
          st_asgeojson(points.geom),\
          p1.id as p1_id,\
          ST_Distance(geography(p1.geom), geography(points.geom)) as distance\
        from\
          (select distinct on(p2.geom)*\
          from germany p2\
          where p2.id is not null) as points\
        cross join lateral\
          (select  id, geom\
          from germany\
          order  by points.geom <-> geom\
                   limit 2) as p1\
        order by distance desc limit 10000')
      .then((data) => {
        return t.one("SELECT st_asgeojson(geom) FROM germany_border")
          .then(ger => {
            // console.log(data);
            let featCol = turf.featureCollection(data.map(f => {
              let feat = turf.feature(JSON.parse(f.st_asgeojson));
              feat.properties.dist = f.distance;
              return feat;
            }))
            return {
              points: featCol,
              ger: JSON.parse(ger.st_asgeojson)
            }
          })
      })
    }).then(data => {
      // console.log(data);
      res.json(data);

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
        ON st_dwithin(\
          st_exteriorring(polygons.geom)::geography,\
          st_buffer(points.geom::geography, 100.0),\
          0.001)"

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
              feat.properties.color = '#a4f521';
              features.push(feat);
            }
            else if(prop === 'border' && d[prop].length != 0) {
              let feat = turf.feature(f);
              feat.properties.color = '#ff3d00';
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
    db.task(t => {
      // query points inside polygon
      let query = "SELECT st_asgeojson(lin. geom) \
          FROM polygons pol \
          JOIN lines lin ON (st_within(lin.geom, pol.geom));";

      // query points on polygon border
      let query2 = "SELECT st_asgeojson(lines.geom) \
        FROM lines INNER JOIN polygons \
        ON st_dwithin(st_exteriorring(polygons.geom),lines.geom,0.001);"

      return t.any(query)
        .then(linesIn => {
          // let Points = [];
          return t.any(query2)
            .then(linesBord => {
              return {
                inside: linesIn.map(p => JSON.parse(p.st_asgeojson)),
                border: linesBord.map(p => JSON.parse(p.st_asgeojson))
              };
            });
        })
    }).then((d) => {
        console.log('\n\nresults from database: \n', d);
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
        console.log(featCol);
        res.json(featCol);
    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
  }
  else if(d.task === 'task3') {
    console.log('\n\nPolys: ', d);
    db.task(t => {
      // query get line from clicked position
      let query = "SELECT st_relate(\
        ST_GeomFromGeoJSON(${poly1}),\
        ST_GeomFromGeoJSON(${poly2}));";

      return t.one(query, {
        poly1: d.polys[0].geometry,
        poly2: d.polys[1].geometry
      })
        .then(states => {
          console.log('Result line: ',states);
          return states;
        })
        .catch(error => {
          console.log("ERROR: ", error);
        })
    }).then((d) => {
      if(d.hasOwnProperty('st_relate')) {
        res.json(d.st_relate);
      }
      else {
        res.json({
          message: "did not get line"
        });
      }
    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
  }
  else if(d.task === 'task5') {
    d.point.geometry.crs = {
      type: "name",
      properties: {
        name: "EPSG:4326"
      }
    };
    console.log('\n\nPoint: ', d.point.geometry.coordinates);
    db.task(t => {
      // query get line from clicked position
      let query = "SELECT st_asewkt(l.geom) \
                  FROM lines as l \
                  WHERE st_intersects(\
                    l.geom::geography, st_buffer(ST_GeomFromGeoJSON(${point})::geography,\
                    5000.0))";

      // query get points to draw line to nearest point
      let query2 = "\
        SELECT\
          st_asgeojson(\
            st_shortestline(\
              ${line}::geometry,\
              p.geom\
            )\
          ) as line\
        FROM points p\
        ORDER BY p.geom <-> ${line}::geometry limit 1";

      return t.oneOrNone(query, {
        point: d.point.geometry
      })
        .then(line => {
          console.log('Result line: ',line);
          if(line != null) {
            return t.one(query2, {
              line: line.st_asewkt
            })
              .then(points => {
                console.log('RESULT NN search:\n', points);
                return {
                  line: JSON.parse(points.line)
                };
              });
          }
          else {
            return {
              ptOnLine: undefined
            }
          }
        })
        .catch(error => {
          console.log("ERROR: ", error);
        })
    }).then((d) => {
        if(d.line != undefined ) {
          // console.log('results from database: \n', d);
          // console.log(d.line);
          res.json(d.line);
        }
        else {
          res.json({
            message: "did not get line"
          });
        }
    })
    .catch((error) => {
      console.log('ERROR: ', error);
    });
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
