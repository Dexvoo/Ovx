@echo off

start cmd /k pm2 monit
pm2 start src/index.js --name "Oxv" --watch --ignore-watch="node_modules"