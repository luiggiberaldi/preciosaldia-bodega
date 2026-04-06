export async function generateFingerprint() {
    const nav = window.navigator;
    const screen = window.screen;

    const components = [
        nav.userAgent,
        nav.language,
        nav.hardwareConcurrency || 1,
        nav.deviceMemory || 1,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset()
    ].join('|');

    if (!window.crypto || !window.crypto.subtle) {
        // Fallback (solo en http sin SSL)
        let hash = 0;
        for (let i = 0; i < components.length; i++) {
            hash = ((hash << 5) - hash) + components.charCodeAt(i);
            hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
        return `PDA-${hex}`;
    }

    // Mismo hardware = mismo hash SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(components);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().substring(0, 8);
    return `PDA-${hex}`;
}
