#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running migrations..."
  npm run migrate
fi

echo "Starting application..."
exec "$@"