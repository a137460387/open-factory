#!/bin/bash
set -e

# Fix volume permissions if running as root, then drop to 'of' user.
if [ "$(id -u)" = '0' ]; then
  # Only chown if directory ownership doesn't already match (avoids slow
  # recursive chown on large workspace volumes at every container start).
  for dir in /tmp/open-factory /workspace; do
    if [ -d "$dir" ] && [ "$(stat -c '%U' "$dir" 2>/dev/null)" != 'of' ]; then
      chown -R of:of "$dir"
    fi
  done
  exec gosu of "$@"
fi

exec "$@"
