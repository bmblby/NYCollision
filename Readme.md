# NYCollision
web-based visualization to show vehicle collision data from NYC

To run this web-based visualization you need git and node/npm on your machine,
as well as some webserver architecture

## install
Get repository from github

    git clone https://github.com/bmblby/wifiOnIce

install modules from package.json from root directory of the project

    npm install

start webpack service from the root directory of the project to watch files from ./src

    npm run watch

start local server on ./dist directory for example with node to launch the application locally

    npm install -g http-server
    http-server -p 8000
