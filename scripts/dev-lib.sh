# Shared by dev-up.sh, dev-down.sh and dev-watchdog.sh (sourced, not run).
# Answers one question safely: which program holds a port, and is it THIS
# folder's dev server? Another project (or a Docker container) may own :3000 —
# it must never be mistaken for the MNW app, and never be stopped by us.
dev_root=$(pwd -P)

listener() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }

mine() {   # true when the program listening on port $1 was started in this folder
  local pid; pid=$(listener "$1"); [ -n "$pid" ] || return 1
  [ "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)" = "$dev_root" ]
}

who() {    # short name of whatever holds port $1, for messages
  local c; c=$(docker ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null | head -1)
  if [ -n "$c" ]; then echo "Docker container $c"; else ps -o comm= -p "$(listener "$1")" 2>/dev/null | sed 's|.*/||'; fi
}

saved_port() { local p; p=$(cat .dev-port 2>/dev/null || true); case "$p" in ''|*[!0-9]*) return 1 ;; esac; echo "$p"; }

pick_port() {   # this folder's running server if there is one, else the first free port from 3000
  local p
  for p in $(saved_port || true) 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009; do mine "$p" && { echo "$p"; return 0; }; done
  for p in 3000 3001 3002 3003 3004 3005 3006 3007 3008 3009; do [ -z "$(listener "$p")" ] && { echo "$p"; return 0; }; done
  return 1
}
