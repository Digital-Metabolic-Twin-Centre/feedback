#!/bin/sh

echo "Starting migrations..."
npm run migrate:prod-up

if [ $? -ne 0 ]; then
  echo "Migration failed. Exiting."
  exit 1
fi

echo "Starting app..."
npm start
