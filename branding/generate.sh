#!/usr/bin/env bash

# check if imagemagick is installed
if ! command -v cairosvg &> /dev/null
then
    echo "cairosvg could not be found. Please install it first."
    exit
fi

mkdir -p generated/logomark
mkdir -p generated/logotype

# logomark/mml-logomark-white-square.svg
cairosvg -f png --output-width 16 --output-height 16 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-16x16.png
cairosvg -f png --output-width 32 --output-height 32 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-32x32.png
cairosvg -f png --output-width 64 --output-height 64 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-64x64.png
cairosvg -f png --output-width 128 --output-height 128 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-128x128.png
cairosvg -f png --output-width 256 --output-height 256 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-256x256.png
cairosvg -f png --output-width 512 --output-height 512 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-512x512.png
cairosvg -f png --output-width 1024 --output-height 1024 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-1024x1024.png
cairosvg -f png --output-width 2048 --output-height 2048 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-2048x2048.png
cairosvg -f png --output-width 4096 --output-height 4096 ./src/svg/logomark/mml-logomark-white-square.svg -o ./generated/logomark/mml-logomark-white-square-4096x4096.png

# logomark/mml-logomark-black-square.svg
cairosvg -f png --output-width 16 --output-height 16 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-16x16.png
cairosvg -f png --output-width 32 --output-height 32 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-32x32.png
cairosvg -f png --output-width 64 --output-height 64 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-64x64.png
cairosvg -f png --output-width 128 --output-height 128 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-128x128.png
cairosvg -f png --output-width 256 --output-height 256 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-256x256.png
cairosvg -f png --output-width 512 --output-height 512 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-512x512.png
cairosvg -f png --output-width 1024 --output-height 1024 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-1024x1024.png
cairosvg -f png --output-width 2048 --output-height 2048 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-2048x2048.png
cairosvg -f png --output-width 4096 --output-height 4096 ./src/svg/logomark/mml-logomark-black-square.svg -o ./generated/logomark/mml-logomark-black-square-4096x4096.png

# logomark/mml-logomark-white-square-padding.svg
cairosvg -f png --output-width 16 --output-height 16 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-16x16.png
cairosvg -f png --output-width 32 --output-height 32 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-32x32.png
cairosvg -f png --output-width 64 --output-height 64 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-64x64.png
cairosvg -f png --output-width 128 --output-height 128 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-128x128.png
cairosvg -f png --output-width 256 --output-height 256 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-256x256.png
cairosvg -f png --output-width 512 --output-height 512 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-512x512.png
cairosvg -f png --output-width 1024 --output-height 1024 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-1024x1024.png
cairosvg -f png --output-width 2048 --output-height 2048 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-2048x2048.png
cairosvg -f png --output-width 4096 --output-height 4096 ./src/svg/logomark/mml-logomark-white-square-padding.svg -o ./generated/logomark/mml-logomark-white-square-padding-4096x4096.png

# logomark/mml-logomark-black-square-padding.svg
cairosvg -f png --output-width 16 --output-height 16 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-16x16.png
cairosvg -f png --output-width 32 --output-height 32 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-32x32.png
cairosvg -f png --output-width 64 --output-height 64 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-64x64.png
cairosvg -f png --output-width 128 --output-height 128 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-128x128.png
cairosvg -f png --output-width 256 --output-height 256 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-256x256.png
cairosvg -f png --output-width 512 --output-height 512 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-512x512.png
cairosvg -f png --output-width 1024 --output-height 1024 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-1024x1024.png
cairosvg -f png --output-width 2048 --output-height 2048 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-2048x2048.png
cairosvg -f png --output-width 4096 --output-height 4096 ./src/svg/logomark/mml-logomark-black-square-padding.svg -o ./generated/logomark/mml-logomark-black-square-padding-4096x4096.png

# logotype/mml-logotype-white.svg
cairosvg -f png --output-width 46 --output-height 18 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-46x18.png
cairosvg -f png --output-width 92 --output-height 36 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-92x36.png
cairosvg -f png --output-width 184 --output-height 72 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-184x72.png
cairosvg -f png --output-width 368 --output-height 144 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-368x144.png
cairosvg -f png --output-width 736 --output-height 288 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-736x288.png
cairosvg -f png --output-width 1472 --output-height 576 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-1472x576.png
cairosvg -f png --output-width 2944 --output-height 1152 ./src/svg/logotype/mml-logotype-white.svg -o ./generated/logotype/mml-logotype-white-2944x1152.png

# logotype/mml-logotype-black.svg
cairosvg -f png --output-width 46 --output-height 18 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-46x18.png
cairosvg -f png --output-width 92 --output-height 36 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-92x36.png
cairosvg -f png --output-width 184 --output-height 72 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-184x72.png
cairosvg -f png --output-width 368 --output-height 144 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-368x144.png
cairosvg -f png --output-width 736 --output-height 288 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-736x288.png
cairosvg -f png --output-width 1472 --output-height 576 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-1472x576.png
cairosvg -f png --output-width 2944 --output-height 1152 ./src/svg/logotype/mml-logotype-black.svg -o ./generated/logotype/mml-logotype-black-2944x1152.png