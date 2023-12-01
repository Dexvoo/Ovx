@echo off
pm2 start src/index.js --name "Oxv Discord Bot" --watch --ignore-watch="node_modules"