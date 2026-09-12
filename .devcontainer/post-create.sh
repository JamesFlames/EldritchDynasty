#!/usr/bin/env bash
set -euo pipefail

sudo chown -R vscode:vscode /home/vscode/.catdesk

if [[ ! -f /home/vscode/.catdesk/AGENTS.md ]]; then
  install -m 0644 .devcontainer/catdesk-AGENTS.md /home/vscode/.catdesk/AGENTS.md
fi

npm install -g --allow-scripts=catdesk catdesk@0.8.0

sudo apt-get update
sudo apt-get install -y ripgrep
