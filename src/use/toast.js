import { Capacitor } from '@capacitor/core';
import { Toast as CapToast } from '@capacitor/toast';

export function useToast() {

    const show = async (options) => {
        const {
            message,
            duration = 2500,
            position = 'bottom',
            delay = 0
        } = typeof options === 'string' ? { message: options } : options;

        const isNative = Capacitor.isNativePlatform();

        if (delay > 0) await new Promise((r) => setTimeout(r, delay));

        if (isNative) {
            // 1. Native Execution
            await CapToast.show({
                text: message,
                duration: duration < 3000 ? 'short' : 'long',
                position: position
            });
        } else {
            // 2. Vanilla Web Fallback
            injectVanillaToast(message, duration, position);
        }
    };

    // Internal helper for Web
    const injectVanillaToast = (msg, dur, pos) => {
        const el = document.createElement('div');
        el.className = `v-toast v-toast-${pos}`;
        el.textContent = msg;

        // Minimal inline styles for guaranteed visibility
        Object.assign(el.style, {
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            zIndex: '10000',
            transition: 'opacity 0.3s ease',
            opacity: '0'
        });

        if (pos === 'top') el.style.top = '10%';
        else if (pos === 'center') el.style.top = '50%';
        else el.style.bottom = '10%';

        document.body.appendChild(el);

        // Animate In
        setTimeout(() => el.style.opacity = '1', 10);

        // Animate Out & Cleanup
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, dur);
    };

    return { show };
}
