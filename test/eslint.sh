#!/usr/bin/env bash

if [ ! -d "./node_modules/" ]; then
    npm install
    echo "Installing test dependencies"
fi

echo "Test: /src/"
./node_modules/.bin/eslint ./src/**/**/*.js

echo "Test: /srv/"
./node_modules/.bin/eslint ./srv/**/**/*.js
