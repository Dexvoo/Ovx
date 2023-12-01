@echo off

start cmd /k pm2 monit
pm2 start pm2-process.json