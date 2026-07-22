export const CapacitorBarcodeScannerTypeHint = {
    ALL: 17
};

export const CapacitorBarcodeScanner = {
    async scanBarcode() {
        throw new Error('Barcode scanning is not available in PWA mode');
    }
};
