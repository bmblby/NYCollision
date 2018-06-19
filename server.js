'use strict';

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

//Serving the files on the dist folder
app.use(express.static(DIST_DIR));
app.use(bodyParser.json());

//Send index.html when the user access the web
app.get("*", function (req, res) {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

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
    console.log(d);
    d.geometry.crs = {
      type: 'name',
      properties: {
        name: 'EPSG:4326'
      }
    }
    db.none('INSERT INTO ' + table.toString() + '(id, geom) VALUES (${id}, ST_GeomFromGeoJSON(${geoJSON}))', {
      id: d.properties.id,
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

app.post('/', (req, res) => {
  let d = req.body;
  console.log(d);

  if(d.test) {
    let string = d.test;
    string = string.replace(/Test/i, "fucking Test");
    res.json({
      test: string
    });
  }
  else if (d.task === "clear") {
    db.none('DELETE FROM points *');
    db.none('DELETE FROM lines *');
    db.none('DELETE FROM paths *');
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
