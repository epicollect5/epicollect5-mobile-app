export const CapacitorZip = {
    async zip() {
        throw new Error('ZIP export is not available in PWA mode');
    },
    async unzip() {
        throw new Error('ZIP import is not available in PWA mode');
    }
};
