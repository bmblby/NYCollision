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
const cn = "postgres://nyc_user@localhost:5432/nyc_db";
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

function computePath(source, target, res, cost, method, user) {
  // get route back from db and send featCol of routing path
  let sourceQuery = "SELECT gid, source, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${source})\
                            LIMIT 1;"

  let targetQuery = "SELECT gid, target, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${target})\
                            LIMIT 1;"

  return db.task(t => {
    return t.one(sourceQuery, {
      source: source
    }).then(source => {
      return t.one(targetQuery, {
        target: target
      }).then(target => {
        console.log(source.source, target.target);
        // TODO: add cost into inner query -> db update is needed for that
        let routeQuery = '';
        if (user === 'Car') {
          routeQuery = 'SELECT\
                      st_asgeojson(ways.the_geom) as geojson, ways.length_m as cost, \
                      car_accidents_killed as user_killed,\
                      car_accidents_injured as user_injured\
                      FROM (SELECT * FROM '+ method.toString() +'(\
                        \'SELECT gid as id, source, target, '+ cost.toString() +' as cost FROM ways\', '+
                        target.target.toString() + ', ' +
                        source.source.toString()
                        +')) as route\
                        LEFT OUTER JOIN ways ways ON ways.gid = route.edge';

        } else {
          routeQuery = 'SELECT\
                      st_asgeojson(ways.the_geom) as geojson, ways.length_m as cost, \
                      '+user.toString()+'s_killed as user_killed, '+user.toString()+'s_injured as user_injured\
                      FROM (SELECT * FROM '+ method.toString() +'(\
                        \'SELECT gid as id, source, target, '+ cost.toString() +' as cost FROM ways\', '+
                        target.target.toString() + ', ' +
                        source.source.toString()
                        +')) as route\
                        LEFT OUTER JOIN ways ways ON ways.gid = route.edge';
        }
        console.log('routeQuery: ', routeQuery);
        return t.any(routeQuery).then(result => {
          console.log(result);
          return result.filter(d => d.geojson != null);
        })
      })
    });
  }).then(data => {
    // console.log(data);
    let segments = data.map(f => {
      let feat = turf.feature(JSON.parse(f.geojson));
      feat.properties.cost = f.cost;
      feat.properties.user_killed = f.user_killed;
      feat.properties.user_injured = f.user_injured;
      return feat;
    });
    let featCol = turf.featureCollection(segments);
    console.log(featCol);
    res.json(featCol);
    // return featCol;
  }).catch(error => {
    console.error(error);
  })
}

function kShortPath(source, target, res, cost, method, user, k = 2) {
  // get route back from db and send featCol of routing path
  let sourceQuery = "SELECT gid, source, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${source})\
                            LIMIT 1;"

  let targetQuery = "SELECT gid, target, st_asgeojson(the_geom)\
                            FROM ways\
                            ORDER BY the_geom <-> ST_GeomFromGeoJSON(${target})\
                            LIMIT 1;"

  return db.task(t => {
    return t.one(sourceQuery, {
      source: source
    }).then(source => {
      return t.one(targetQuery, {
        target: target
      }).then(target => {
        console.log(source.source, target.target);
        // TODO: add cost into inner query -> db update is needed for that
        let kspQuery = 'SELECT\
                    st_asgeojson(ways.the_geom) as geojson, ways.length_m as cost\
                    FROM (SELECT * FROM '+ method.toString() +'(\
                      \'SELECT gid as id, source, target, length_m as cost,\
                      x1, x2, y1, y2 FROM ways\', '+
                      target.target.toString() + ', ' +
                      source.source.toString()
                      +', 4)) as route\
                      LEFT OUTER JOIN ways ways ON ways.gid = route.edge';
        return t.any(kspQuery).then(result => {
          // console.log(result);
          return result.filter(d => d.geojson != null);
        })
      })
    });
  }).then(data => {
    // console.log(data);
    let segments = data.map(f => {
      let feat = turf.feature(JSON.parse(f.geojson));
      feat.properties.cost = f.cost;
      return feat;
    });
    let featCol = turf.featureCollection(segments);
    console.log(featCol);
    res.json(featCol);
    // return featCol;
  }).catch(error => {
    console.error(error);
  })
}

app.post('/route', (req, res) => {
  let d = req.body.data;
  let method = req.body.method;
  let secLvl = req.body.secLvl;
  let user = req.body.user;
  console.log(req.body);

  let source = addSRID(d.source);
  let target = addSRID(d.target);
  let featCol = turf.featureCollection([source, target]);
  // featCol.features.forEach(f => console.log(f.geometry));

  //build string for column access
  let cost = user.toString().toLowerCase() + 's_' + secLvl.toString().toLowerCase();
  if(secLvl === 'Level0') {
    cost = 'length_m'
  }
  console.log(cost);
  // computePath(source.geometry, target.geometry, res, 'length_m', 'pgr_dijkstra');

  if (method === 'pgr_dijkstra') {
    computePath(source.geometry, target.geometry, res, cost, method, user);
  }
  else if(method === 'pgr_ksp') {
    let k = 3;
    kShortPath(source.geometry, target.geometry, res, cost, method, user, k);
  }

});
