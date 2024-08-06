#!/bin/bash

# Update the package lists
apt-get update

# Install FFmpeg
apt-get install -y ffmpeg

# Verify installation
ffmpeg -version
