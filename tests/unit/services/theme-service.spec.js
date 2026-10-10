import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PARAMETERS } from '@/config';

const platformState = vi.hoisted(() => ({ platform: 'web' }));
const setNightModeMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@capacitor/core', () => ({
    Capacitor: { getPlatform: vi.fn(() => platformState.platform) },
    registerPlugin: vi.fn(() => ({ setNightMode: setNightModeMock }))
}));

describe('Theme Service', () => {
    let themeService;
    let systemMatches;
    let addEventListenerMock;

    beforeEach(async () => {
        //fresh module state per test: the last-set preference and the
        //cached MediaQueryList are module-level
        vi.resetModules();

        systemMatches = false;
        platformState.platform = PARAMETERS.WEB;
        setNightModeMock.mockClear();
        addEventListenerMock = vi.fn();
        window.matchMedia = vi.fn(() => ({
            get matches() {
                return systemMatches;
            },
            addEventListener: addEventListenerMock
        }));

        document.body.className = '';

        const module = await import('@/services/theme-service');
        themeService = module.themeService;
    });

    it('adds the theme-dark body class for the dark preference', () => {
        themeService.applyTheme('dark');

        expect(document.body.classList.contains('theme-dark')).toBe(true);
    });

    it('removes the theme-dark body class for the light preference', () => {
        systemMatches = true;
        themeService.applyTheme('system');
        themeService.applyTheme('light');

        expect(document.body.classList.contains('theme-dark')).toBe(false);
    });

    it('follows the OS preference for the system theme', () => {
        systemMatches = false;
        themeService.applyTheme('system');
        expect(document.body.classList.contains('theme-dark')).toBe(false);

        systemMatches = true;
        themeService.applyTheme('system');
        expect(document.body.classList.contains('theme-dark')).toBe(true);
    });

    it('re-applies on OS theme changes only while the preference is system', () => {
        themeService.applyTheme('system');
        expect(addEventListenerMock).toHaveBeenCalledTimes(1);

        //OS flips to dark while following the system: the class is added
        systemMatches = true;
        addEventListenerMock.mock.calls[0][1]();
        expect(document.body.classList.contains('theme-dark')).toBe(true);

        //explicit light: the same OS change must not touch the theme at all
        themeService.applyTheme('light');
        expect(document.body.classList.contains('theme-dark')).toBe(false);
        const toggleSpy = vi.spyOn(document.body.classList, 'toggle');
        addEventListenerMock.mock.calls[0][1]();
        expect(toggleSpy).not.toHaveBeenCalled();
        expect(document.body.classList.contains('theme-dark')).toBe(false);
        toggleSpy.mockRestore();
    });

    it('sets the root color scheme to match the effective theme', () => {
        const setProperty = vi.spyOn(document.documentElement.style, 'setProperty');

        systemMatches = true;
        themeService.applyTheme('system');
        expect(setProperty).toHaveBeenCalledWith('color-scheme', 'dark');

        themeService.applyTheme('light');
        expect(setProperty).toHaveBeenCalledWith('color-scheme', 'light');

        setProperty.mockRestore();
    });

    it('pins the native night mode to match the in-app preference', () => {
        platformState.platform = PARAMETERS.ANDROID;

        themeService.applyTheme('light');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'no' });

        themeService.applyTheme('dark');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'yes' });

        themeService.applyTheme('system');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'follow_system' });
    });

    it('drives the same night mode contract on iOS', () => {
        platformState.platform = PARAMETERS.IOS;

        themeService.applyTheme('light');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'no' });

        themeService.applyTheme('dark');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'yes' });

        themeService.applyTheme('system');
        expect(setNightModeMock).toHaveBeenCalledWith({ mode: 'follow_system' });
    });

    it('never calls the native plugin on the web', () => {
        platformState.platform = PARAMETERS.WEB;

        themeService.applyTheme('light');
        themeService.applyTheme('dark');
        themeService.applyTheme('system');

        expect(setNightModeMock).not.toHaveBeenCalled();
    });

    it('never stacks listeners across repeated saves', () => {
        themeService.applyTheme('system');
        themeService.applyTheme('system');
        themeService.applyTheme('light');
        themeService.applyTheme('system');

        expect(window.matchMedia).toHaveBeenCalledTimes(1);
        expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
        expect(addEventListenerMock).toHaveBeenCalledTimes(1);
    });
});
