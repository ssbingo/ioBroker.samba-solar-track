/*
 * Frontend build of the samba-solar-track adapter.
 *
 * The vis-2 widgets (React + Vite + Module Federation, as in ioBroker.pondpump) live in src-widgets/ and are
 * built into widgets/samba-solar-track/, which is committed to git so the adapter/CI build (`build-adapter ts`)
 * never needs the Vite toolchain. Run this only when the widget sources change:
 *
 *   npm run build:widgets   -> src-widgets/ -> widgets/samba-solar-track/
 */
const { existsSync } = require('node:fs');
const adapterName = require('./package.json').name.replace('iobroker.', '');
const { deleteFoldersRecursive, copyFiles, npmInstall, buildReact } = require('@iobroker/build-tools');

function buildWidgets() {
    const SRC = 'src-widgets/';
    const src = `${__dirname}/${SRC}`;
    deleteFoldersRecursive(`${src}build`);
    deleteFoldersRecursive(`${__dirname}/widgets`);
    const npmPromise = existsSync(`${src}/node_modules`) ? Promise.resolve() : npmInstall(src);
    return npmPromise
        .then(() => buildReact(src, { rootDir: __dirname, vite: true }))
        .then(() => {
            copyFiles([`${SRC}build/customWidgets.js`], `widgets/${adapterName}`);
            // Serve the module-federation manifest next to the entry: vis-2 >= 2.20 loads a widget set
            // through mf-manifest.json instead of the bare customWidgets.js. Without it the set 404s on
            // /vis-2/widgets/<set>/mf-manifest.json and is skipped.
            copyFiles([`${SRC}build/mf-manifest.json`], `widgets/${adapterName}`);
            copyFiles([`${SRC}build/mf-stats.json`], `widgets/${adapterName}`);
            copyFiles([`${SRC}build/icon-set.json`], `widgets/${adapterName}`);
            copyFiles([`${SRC}build/assets/*.*`], `widgets/${adapterName}/assets`);
            copyFiles([`${SRC}build/img/*`], `widgets/${adapterName}/img`);
            // Licence of the bundled font Montserrat (SIL Open Font License 1.1)
            copyFiles([`${SRC}src/fonts/OFL.txt`], `widgets/${adapterName}/fonts`);
        });
}

if (process.argv.includes('--typescript') || process.argv.length === 2) {
    buildWidgets().catch(e => {
        console.error(`Cannot build widgets: ${e}`);
        process.exit(1);
    });
}
