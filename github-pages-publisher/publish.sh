#!/usr/bin/env bash

# Exit on error and echo each command
set -ex

# Set the working directory to the location of this script
cd "$(dirname "$0")"

# Create the build directory
mkdir -p ./build

# Copy the index.html file that redirects into the build directory
cp ./index.html ./build/index.html

# Copy the files for each app into the build directory
mkdir -p ./build/v1
cp -r ../packages/mml-viewer/build/* ./build/v1/
