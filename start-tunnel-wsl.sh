#!/bin/bash
PROJECT_ROOT="/mnt/c/Users/Dell/Desktop/learn/meet-2"
nohup cloudflared tunnel --config $PROJECT_ROOT/config-wsl.yml run classroom-server > $PROJECT_ROOT/tunnel.log 2>&1 &
echo "Cloudflare Tunnel started in background."
