#!/bin/bash

createuser nyc_user
createdb -T template0 nyc_db -O nyc_user
psql -c 'GRANT ALL PRIVILEGES ON DATABASE nyc_db TO nyc_user;' -d nyc_db
psql nyc_db < $1
psql -c 'GRANT ALL PRIVILEGES ON TABLE ways, nyc TO nyc_user;' -d nyc_db
