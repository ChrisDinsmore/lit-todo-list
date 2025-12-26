import fs from 'fs';
import path from 'path';

const root = process.cwd();
const appFile = path.join(root, 'src/read-later-app.js');
const swFile = path.join(root, 'sw.js');
const pkgFile = path.join(root, 'package.json');

function bump() {
    // 1. Read app file to find current version
    let appContent = fs.readFileSync(appFile, 'utf8');
    const versionMatch = appContent.match(/<span class="version-badge">v(\d+)<\/span>/);

    if (!versionMatch) {
        console.error('Could not find version in src/read-later-app.js');
        process.exit(1);
    }

    const currentVersion = parseInt(versionMatch[1]);
    const newVersion = currentVersion + 1;
    const oldV = `v${currentVersion}`;
    const newV = `v${newVersion}`;

    console.log(`Bumping version: ${oldV} -> ${newV}`);

    // 2. Update src/read-later-app.js
    appContent = appContent.replace(
        `<span class="version-badge">${oldV}</span>`,
        `<span class="version-badge">${newV}</span>`
    );
    fs.writeFileSync(appFile, appContent);

    // 3. Update sw.js
    let swContent = fs.readFileSync(swFile, 'utf8');
    swContent = swContent.replace(
        `const CACHE_NAME = 'read-later-${oldV}'`,
        `const CACHE_NAME = 'read-later-${newV}'`
    );
    fs.writeFileSync(swFile, swContent);

    // 4. Update package.json (optional but good practice)
    if (fs.existsSync(pkgFile)) {
        let pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        pkg.version = `0.0.${newVersion}`;
        fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
    }

    console.log('Successfully updated all versions.');
}

bump();
