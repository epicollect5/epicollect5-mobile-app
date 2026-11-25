//PWA stub: the barcode scanner plugin (and its 1.2 MB html5-qrcode web
//dependency) is native-only - PWA barcode questions are plain text inputs
export class CapacitorBarcodeScanner {
    static async scanBarcode() {
        throw new Error('barcode scanning is not available on the PWA');
    }
}

export const CapacitorBarcodeScannerTypeHint = {
    ALL: 'ALL'
};

export default undefined;
