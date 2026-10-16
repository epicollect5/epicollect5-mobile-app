import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

describe('release build scripts', () => {
    it('builds the release bundle with the debug flags cleared', () => {
        const nativeProd = packageJson.scripts['native:prod'];

        expect(nativeProd).toMatch(/VITE_DEBUG=(\s|$)/);
        expect(nativeProd).toMatch(/VITE_BYPASS_UNIQUENESS=(\s|$)/);
    });
});
