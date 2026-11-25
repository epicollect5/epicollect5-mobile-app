import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {utilsService} from '@/services/utilities/utils-service';

describe('rewriteBranchUrl', () => {
    let replaceStateSpy;

    beforeEach(() => {
        replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    });

    afterEach(() => {
        replaceStateSpy.mockRestore();
    });

    it('strips trailing /branch and preserves query and hash', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch?uuid=123#q');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl();
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
        expect(window.location.search).toBe('?uuid=123');
        expect(window.location.hash).toBe('#q');
    });

    it('strips trailing /branch/ with trailing slash', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch/');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl();
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
    });

    it('does nothing when path does not end with /branch', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl();
        expect(replaceStateSpy).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
    });

    it('restores the query from the previous route when navigation dropped it', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl({uuid: '123'});
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
        expect(window.location.search).toBe('?uuid=123');
    });

    it('does not overwrite a live query with the fallback', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch?uuid=456');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl({uuid: '123'});
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
        expect(window.location.search).toBe('?uuid=456');
    });

    it('does nothing when branch is not the last segment', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/branch/entries');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl();
        expect(replaceStateSpy).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe('/base/project/test-pwa/branch/entries');
    });

    it('restores the origin pathname segment and query when navigating from an edit', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch#q');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl({uuid: '123'}, '/base/project/test-pwa/edit-entry');
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/edit-entry');
        expect(window.location.search).toBe('?uuid=123');
        expect(window.location.hash).toBe('#q');
    });

    it('keeps the add-entry segment when the navigation came from an add', () => {
        window.history.pushState({}, '', '/base/project/test-pwa/add-entry/branch');
        replaceStateSpy.mockClear();
        utilsService.rewriteBranchUrl({}, '/base/project/test-pwa/add-entry');
        expect(replaceStateSpy).toHaveBeenCalledOnce();
        expect(window.location.pathname).toBe('/base/project/test-pwa/add-entry');
    });
});
