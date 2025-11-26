module.exports = {
  apps: [
    {
      name: 'Ovx',
      script: 'src/index.js',
      watch: true,
      watch_options: { followSymlinks: false, usePolling: true, interval: 1000 },
      ignore_watch: [
        'node_modules',
        'package.json',
        'package-lock.json',
        '.git',
        'src/UnusedCommands',
        'src/Converted',
      ],
      env: { NODE_ENV: 'Development' },
    },
  ],
};
