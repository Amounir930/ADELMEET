#!/bin/bash
PROJECT_ROOT="/home/adel/projects/meet-2-hardened"

nohup cloudflared tunnel --config $PROJECT_ROOT/config-wsl.yml run classroom-server > $PROJECT_ROOT/tunnel.log 2>&1 &
echo "Cloudflare Tunnel started in background."
