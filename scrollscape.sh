#!/usr/bin/env bash
# =============================================================================
# scrollscape.sh — ScrollScape launcher for Linux & macOS
# Usage: chmod +x scrollscape.sh && ./scrollscape.sh
# =============================================================================

set -Eeuo pipefail

R='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
PUR='\033[35m'
BPUR='\033[95m'
CYN='\033[36m'
BCYN='\033[96m'
GRN='\033[32m'
BGRN='\033[92m'
RED='\033[31m'
BRED='\033[91m'
WHT='\033[97m'
GRY='\033[90m'
YLW='\033[33m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
NODE_PID=""

cd "$ROOT_DIR"

trap cleanup EXIT INT TERM

banner() {
  clear
  echo
  echo -e "  ${GRY}+=======================================================+${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}    ${BOLD}${BPUR}_____  _____${R}                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}/ ____|/ ____|${R}      ${BOLD}ScrollScape${R}                     ${GRY}|${R}"
  echo -e "  ${GRY}|${R}  ${BOLD}${PUR}| (___ | (___${R}        ${DIM}Linux / macOS Launcher${R}         ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${BOLD}${PUR}\\___ \\ \\___ \\${R}                                     ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${DIM}${PUR}____) |____) |${R}      ${DIM}Current server.js flow${R}          ${GRY}|${R}"
  echo -e "  ${GRY}|${R}  ${DIM}${PUR}|_____/|_____/${R}       ${DIM}Foreground logs & easy debug${R}    ${GRY}|${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}+=======================================================+${R}"
  echo
}

status_box() {
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo -e "  ${GRY}|${R}    ${BGRN}[ OK ]${R}  ${BOLD}Ready to launch ScrollScape${R}                ${GRY}|${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}       ${BOLD}${WHT}http://localhost:${PORT}${R}                           ${GRY}|${R}"
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo
}

err() {
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo -e "  ${GRY}|${R}    ${BRED}[ ERR ]${R}  ${BOLD}$1${R}"
  if [ -n "${2:-}" ]; then
    echo -e "  ${GRY}|${R}    ${DIM}          $2${R}"
  fi
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo
}

info_line() {
  echo -e "  ${BCYN}[ .. ]${R}  $1"
}

ok_line() {
  echo -e "  ${BGRN}[ OK ]${R}  $1"
}

cleanup_port() {
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -t -i tcp:${PORT} 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill -9 >/dev/null 2>&1 || true
    fi
  fi
}

start_node() {
  export PORT="${PORT}"
  export SCROLLSCAPE_LAUNCHER="1"
  nohup "$NODE_EXE" server.js >/dev/null 2>&1 &
  NODE_PID=$!
}

wait_for_port() {
  local tries=0
  while ! (echo > "/dev/tcp/127.0.0.1/${PORT}") >/dev/null 2>&1; do
    if (( tries >= 20 )); then
      return 1
    fi
    sleep 1
    ((tries+=1))
  done
  return 0
}

cleanup() {
  if [ -n "$NODE_PID" ]; then
    kill "$NODE_PID" >/dev/null 2>&1 || true
  fi
}

install_node() {
  local NODE_VER="v20.15.0"
  local ARCH=""
  case "$(uname -m)" in
    x86_64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) 
      err "Unsupported architecture" "Cannot automatically install Node.js for $(uname -m)."
      read -rp "Press Enter to exit..."
      exit 1
      ;;
  esac

  local OS="linux"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="darwin"
  fi

  local URL="https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-${OS}-${ARCH}.tar.gz"
  local TAR_FILE="$ROOT_DIR/node.tar.gz"
  
  info_line "Downloading Node.js ${NODE_VER} for ${OS}-${ARCH}..."
  mkdir -p "$ROOT_DIR/tools/node"
  if command -v curl >/dev/null 2>&1; then
    curl -#L "$URL" -o "$TAR_FILE"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress "$URL" -O "$TAR_FILE"
  else
    err "Cannot download Node.js" "Neither curl nor wget is installed."
    read -rp "Press Enter to exit..."
    exit 1
  fi

  info_line "Extracting Node.js..."
  tar -xzf "$TAR_FILE" -C "$ROOT_DIR/tools/node" --strip-components=1
  rm -f "$TAR_FILE"

  ok_line "Node.js installed successfully."
}

main_flow() {
  banner

  info_line "Scanning for Node.js runtime environment..."
  NODE_EXE=""
  if [ -x "$ROOT_DIR/tools/node/bin/node" ]; then
    NODE_EXE="$ROOT_DIR/tools/node/bin/node"
    export PATH="$ROOT_DIR/tools/node/bin:$PATH"
  elif [ -x "$ROOT_DIR/tools/node/node" ]; then
    # Legacy support in case it's extracted flat
    NODE_EXE="$ROOT_DIR/tools/node/node"
    export PATH="$ROOT_DIR/tools/node:$PATH"
  elif command -v node >/dev/null 2>&1; then
    NODE_EXE="$(command -v node)"
  fi

  if [ -z "$NODE_EXE" ]; then
    echo
    info_line "Node.js not found. Installing automatically..."
    install_node
    
    if [ -x "$ROOT_DIR/tools/node/bin/node" ]; then
      NODE_EXE="$ROOT_DIR/tools/node/bin/node"
      export PATH="$ROOT_DIR/tools/node/bin:$PATH"
    else
      err "Node.js installation failed" "Could not find node executable after install."
      read -rp "Press Enter to exit..."
      exit 1
    fi
  fi

  NODE_VER=$("$NODE_EXE" --version 2>&1 || true)
  ok_line "Using Node.js ${NODE_VER}"
  
  info_line "Clearing stale node listener on port ${PORT} if present..."
  cleanup_port
  ok_line "Port ${PORT} is free."

  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo
    info_line "First run detected! Installing dependencies..."
    if ! npm install; then
      err "Failed to install dependencies" "Make sure npm is installed and in PATH."
      read -rp "Press Enter to exit..."
      exit 1
    fi
    ok_line "Dependencies installed."
  fi

  echo
  status_box

  info_line "Starting server daemon..."
  start_node
  if [ -z "$NODE_PID" ] || ! kill -0 "$NODE_PID" 2>/dev/null; then
    err "Failed to start server" "Could not launch server.js in background."
    read -rp "Press Enter to exit..."
    exit 1
  fi

  wait_for_port || true
}

menu_loop() {
  while true; do
    echo
    echo -e "  ${GRY}+-------------------------------------------------------+${R}"
    echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}R${R}  ${WHT}Restart & refresh                                ${GRY}|${R}"
    echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}Q${R}  ${WHT}Quit                                             ${GRY}|${R}"
    echo -e "  ${GRY}+-------------------------------------------------------+${R}"
    
    IFS= read -rsn1 choice || choice="q"
    
    case "$choice" in
      r|R)
        banner
        info_line "Restarting server..."
        cleanup
        cleanup_port
        main_flow
        ;;
      q|Q)
        echo
        info_line "Stopping ScrollScape..."
        exit 0
        ;;
      *)
        ;;
    esac
  done
}

main_flow
menu_loop
