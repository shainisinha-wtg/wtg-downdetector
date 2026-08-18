#!/usr/bin/env bash
# Clean rebuild for local dev when the UI starts crashing after code changes.
# Usage:
#   ./scripts/rebuild.sh            # clean caches + restart `next dev`
#   ./scripts/rebuild.sh --build    # clean caches + full production build (next build)
#   ./scripts/rebuild.sh --docker   # rebuild the docker compose images from scratch
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="dev"
for arg in "$@"; do
  case "$arg" in
    --build) MODE="build" ;;
    --docker) MODE="docker" ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$MODE" == "docker" ]]; then
  echo "==> Rebuilding docker compose images (no cache)"
  docker compose build --no-cache
  docker compose up -d
  exit 0
fi

echo "==> Killing any running next dev/start process on port 3000/3200"
for port in 3000 3200; do
  # lsof can fail to resolve the pid for a socket in this environment; ss is more reliable here.
  pids=$(ss -ltnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u || true)
  if [[ -z "$pids" ]]; then
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  fi
  if [[ -n "$pids" ]]; then
    kill -9 $pids
    echo "  killed pid(s) $pids on port $port"
  fi
done

echo "==> Clearing Next.js / TypeScript build caches"
rm -rf .next dist tsconfig.tsbuildinfo

echo "==> Regenerating Prisma client"
npx prisma generate

if [[ "$MODE" == "build" ]]; then
  echo "==> Running production build"
  npm run build
  echo "==> Build complete. Start it with: npm start"
else
  echo "==> Starting dev server"
  npm run dev
fi
