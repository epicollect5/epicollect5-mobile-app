import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// scripts/ is outside src/, so the `@` alias does not reach it.
import { hasDeployPathOverlap } from '../../../scripts/deploy-pwa.js';

describe('hasDeployPathOverlap', () => {
    const base = mkdtempSync(join(tmpdir(), 'deploy-pwa-spec-'));
    const distDir = join(base, 'mobile-app', 'dist');

    beforeAll(() => {
        mkdirSync(distDir, {recursive: true});
    });

    afterAll(() => {
        rmSync(base, {recursive: true, force: true});
    });

    it('rejects a target equal to the build directory', () => {
        expect(hasDeployPathOverlap(distDir, distDir)).toBe(true);
    });

    it('rejects a target that is an ancestor of the build directory', () => {
        //this is the repo root shape: the wipe would delete the whole repo
        expect(hasDeployPathOverlap(distDir, join(base, 'mobile-app'))).toBe(true);
        expect(hasDeployPathOverlap(distDir, base)).toBe(true);
    });

    it('rejects a target inside the build directory', () => {
        expect(hasDeployPathOverlap(distDir, join(distDir, 'assets'))).toBe(true);
    });

    it('accepts a sibling deployment directory', () => {
        //the real target shape: ../epicollect5-server/public/pwa
        expect(hasDeployPathOverlap(distDir, join(base, 'epicollect5-server', 'public', 'pwa'))).toBe(false);
    });

    it('accepts unrelated directories even with relative or unnormalised input', () => {
        expect(hasDeployPathOverlap(distDir, join(base, 'server', 'public', 'pwa') + '/')).toBe(false);
        expect(hasDeployPathOverlap(distDir, join(distDir, '..', 'server', 'public', 'pwa'))).toBe(false);
    });

    it('rejects a target symlinked into the build directory once resolved', () => {
        const linkDir = join(base, 'link-into-dist');
        symlinkSync(distDir, linkDir);
        //the comparator is textual on purpose: it never resolves links itself
        expect(hasDeployPathOverlap(distDir, linkDir)).toBe(false);
        //main() resolves both sides with realpathSync() before calling, so
        //the wipe cannot follow the link into dist
        expect(hasDeployPathOverlap(realpathSync(distDir), realpathSync(linkDir))).toBe(true);
    });
});
