#!/bin/bash

DEST="/Users/mmenegazzo/Sites/epicollect5-server/public/pwa"

mkdir -p "$DEST/js"
mkdir -p "$DEST/css"
mkdir -p "$DEST/css/images"
mkdir -p "$DEST/assets"
mkdir -p "$DEST/img"


cp -r dist/js/* "$DEST/js/"
cp -r dist/css/* "$DEST/css/"
cp -r dist/assets/* "$DEST/assets/"
cp -r dist/img/* "$DEST/img/"

cp -r src/leaflet/images/* "$DEST/css/images/"


echo "Done!"
