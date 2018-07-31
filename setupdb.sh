#!/bin/bash

psql -c "CREATE USER nyc_user WITH PASSWORD 'nyc_pwd'"
createdb -T template0 nyc_db -O nyc_user
psql -c 'GRANT ALL PRIVILEGES ON DATABASE nyc_db TO nyc_user;' -d nyc_db
psql nyc_db < ./data/nyc.dump
psql -c 'GRANT ALL PRIVILEGES ON TABLE ways, nyc TO nyc_user;' -d nyc_db
