#!/bin/bash
mkdir -p dist/styles dist/icons dist/_locales
cp -r styles/* dist/styles/
cp -r icons/* dist/icons/
cp -r _locales/* dist/_locales/
cp manifest.json dist/
cp *.html dist/ 