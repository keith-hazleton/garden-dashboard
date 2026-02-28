#!/bin/bash
cd "$(dirname "$0")"
echo "Pulling latest changes..."
git pull
echo "Installing backend dependencies..."
cd backend && npm install
echo "Building frontend..."
cd ../frontend && npm run build
echo "Restarting server..."
pm2 restart garden-dashboard
echo "Deploy complete!"
