import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const packageJsonPath = path.join(rootDir, 'package.json');

const changelog = fs.readFileSync(changelogPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const headingPattern = /^# (\d+\.\d+\.\d+)(?: - build \d+)?$/;
const releaseExtractorPattern = (version) => new RegExp(`^#{1,6}\\s*\\[?v?${version}\\]?($|\\s|[-–—])`);

const getVersionSections = () => {
    const lines = changelog.split(/\r?\n/);
    const sections = [];
    let currentSection = null;

    lines.forEach((line, index) => {
        if (!line.startsWith('#')) {
            if (currentSection) {
                currentSection.lines.push(line);
            }
            return;
        }

        const match = line.match(headingPattern);

        if (match) {
            currentSection = {
                version: match[1],
                heading: line,
                lineNumber: index + 1,
                lines: []
            };
            sections.push(currentSection);
            return;
        }

        currentSection = null;
    });

    return sections;
};

describe('CHANGELOG.md', () => {
    it('uses the release heading format expected by GitHub release notes extraction', () => {
        const invalidHeadings = changelog
            .split(/\r?\n/)
            .map((line, index) => ({line, lineNumber: index + 1}))
            .filter(({line}) => line.startsWith('#'))
            .filter(({line}) => line !== '## Release Notes')
            .filter(({line}) => !headingPattern.test(line));

        expect(invalidHeadings).toEqual([]);
    });

    it('has unique version headings with release notes content', () => {
        const sections = getVersionSections();
        const versions = sections.map(({version}) => version);
        const duplicateVersions = versions.filter((version, index) => versions.indexOf(version) !== index);
        const emptySections = sections.filter(({lines}) => !lines.some((line) => line.trim().startsWith('- ')));

        expect(duplicateVersions).toEqual([]);
        expect(emptySections).toEqual([]);
    });

    it('contains extractable release notes for the package version', () => {
        const packageVersion = packageJson.version;
        const sections = getVersionSections();
        const currentSection = sections.find(({version}) => version === packageVersion);

        expect(currentSection).toBeDefined();
        expect(releaseExtractorPattern(packageVersion).test(currentSection.heading)).toBe(true);
        expect(currentSection.lines.some((line) => line.trim().startsWith('- '))).toBe(true);
    });
});
