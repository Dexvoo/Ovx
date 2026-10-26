import fs from 'fs';
import path from 'path';

/**
 * Checks the local package.json version against the latest GitHub repository version.
 * @param {Function} LogData - The logging utility function
 */
export async function checkVersion(LogData) {
    try {
        const pkgPath = path.resolve(process.cwd(), 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const localVersion = pkg.version;

        if (!localVersion) {
            return LogData('Version Check', 'No version found in local package.json.', 'warning');
        }

        const response = await fetch(`https://raw.githubusercontent.com/Dexvoo/Mushroom/main/package.json`, {
            headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok)
            return LogData(
                'Version Check',
                `Could not reach GitHub. Error ${response.status}: ${response.statusText}`,
                'debug'
            );

        const remotePkg = await response.json();
        const remoteVersion = remotePkg.version;

        if (remoteVersion !== localVersion) {
            LogData(
                'Update Available!',
                `You are running v${localVersion}, but v${remoteVersion} is available on GitHub!`,
                'warning'
            );
        } else {
            LogData('Version Check', `You are running the latest version (v${localVersion}).`, 'success');
        }
    } catch (error) {
        LogData('Version Check', `Failed to verify version: ${error.message}`, 'error');
    }
}
