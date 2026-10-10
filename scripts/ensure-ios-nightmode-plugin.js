#!/usr/bin/env node
/**
 * `npx cap copy ios` (used by ios:build / ios:open) regenerates
 * packageClassList in ios/App/App/capacitor.config.json from npm-installed
 * plugins only (@capacitor/cli dist/util/iosplugin.js), silently dropping
 * locally-declared classes. Re-insert the local NightModePlugin entry after
 * every copy. If you run a raw `npx cap sync ios` outside the npm scripts,
 * run this file afterwards too.
 */
import fs from 'node:fs';

const CONFIG = new URL('../ios/App/App/capacitor.config.json', import.meta.url);
const LOCAL_CLASS = 'NightModePlugin';

const config = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));

if (!Array.isArray(config.packageClassList)) {
    config.packageClassList = [];
}

if (config.packageClassList.includes(LOCAL_CLASS)) {
    console.log(`${LOCAL_CLASS} already registered`);
    process.exit(0);
}

//keep CDVPlugin last, matching the order the Capacitor CLI writes
const cordovaIndex = config.packageClassList.indexOf('CDVPlugin');
if (cordovaIndex !== -1) {
    config.packageClassList.splice(cordovaIndex, 0, LOCAL_CLASS);
} else {
    config.packageClassList.push(LOCAL_CLASS);
}

fs.writeFileSync(CONFIG, `${JSON.stringify(config, null, '\t')}\n`);
console.log(`Added ${LOCAL_CLASS} to packageClassList`);
