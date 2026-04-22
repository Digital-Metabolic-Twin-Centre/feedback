#!/bin/bash
set -e
trap 'echo -e "\033[1;31m❌ Error: Something failed. Check logs above.\033[0m"' ERR

# ==============================
# CONFIGURATION
# ==============================
IMAGE_NAME="sbgroup/imdhub"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

# ==============================
# MAIN LOGIC
# ==============================
case "$1" in
  ""|"imdbuild")
    echo -e "\033[1;34m Running lint checks...\033[0m"
    npm run lint

    echo -e "\033[1;34 Running tests...\033[0m"
    npm test

    echo -e "\033[1;34m Building Docker image...\033[0m"
    docker build -t "$FULL_IMAGE_NAME" .

    echo -e "\033[1;34m Pushing image to Docker Hub...\033[0m"
    docker push "$FULL_IMAGE_NAME"

    echo -e "\033[1;32m Image successfully built and pushed: $FULL_IMAGE_NAME\033[0m"

    echo -e "\033[1;32m Pulling latest images...\033[0m"
    docker compose pull 
    docker compose down 
    docker compose up -d


    ;;
  *)
    echo "Usage: ./try.sh imdbuild"
    ;;
esac
