/**
 * Service responsible for determining appropriate exchange rates and contexts.
 * Decouples rate logic from UI/Chat components.
 */
export const RateService = {
    /**
     * Normalizes loose currency input to standard codes.
     * @param {string} c - Currency input (e.g. "bolivares", "usdt")
     * @returns {string} - 'VES', 'USDT', 'EUR', or 'USD'
     */
    normalizeCurrencyCode: (c) => {
        if (!c) return 'USD';
        const upper = c.toUpperCase();
        if (['BS', 'BOLIVARES', 'BOLÍVARES', 'VES', 'BOLIVAR'].includes(upper)) return 'VES';
        if (['USDT', 'TETHER', 'BINANCE', 'TETER'].includes(upper)) return 'USDT';
        if (['EUR', 'EURO'].includes(upper)) return 'EUR';
        return 'USD';
    },

    /**
     * Determines the rate to use, the name of the rate, and the target currency
     * based on the input currency and desired target.
     * NOTE: This logic mimics the original fallback logic found in useChatCalculator.
     * 
     * @param {string} currency - Normalized Source Currency (VES, USDT, etc)
     * @param {string} target - Normalized Target Currency (or null/undefined)
     * @param {object} rates - The rates object containing { usdt, bcv, euro }
     * @returns {object} { rateUsed, rateName, target }
     */
    getExchangeContext: (currency, target, rates) => {
        let rateUsed = 0;
        let rateName = '';

        // Auto-detect target if logic requires it (e.g. VES usually goes to USD, others to VES)
        let effectiveTarget = target;
        if (!effectiveTarget || effectiveTarget === currency) {
            effectiveTarget = currency === 'VES' ? 'USD' : 'VES';
        }

        if (currency === 'USDT') {
            if (effectiveTarget === 'USD') {
                rateUsed = rates.usdt.price / rates.bcv.price;
                rateName = 'Brecha (USDT → BCV)';
            } else if (effectiveTarget === 'EUR') {
                rateUsed = rates.usdt.price / rates.euro.price;
                rateName = 'Cross (USDT → EUR)';
            } else {
                rateUsed = rates.usdt.price;
                rateName = 'Tasa USDT';
                effectiveTarget = 'VES';
            }
        } else if (currency === 'USD') {
            if (effectiveTarget === 'USDT') {
                rateUsed = rates.bcv.price / rates.usdt.price;
                rateName = 'Brecha (BCV → USDT)';
            } else if (effectiveTarget === 'EUR') {
                rateUsed = rates.bcv.price / rates.euro.price;
                rateName = 'Cross (USD → EUR)';
            } else {
                rateUsed = rates.bcv.price;
                rateName = 'Tasa BCV';
                effectiveTarget = 'VES';
            }
        } else if (currency === 'EUR') {
            if (effectiveTarget === 'USD' || effectiveTarget === 'USDT') {
                rateUsed = rates.euro.price / rates.bcv.price;
                rateName = 'EUR → USD (Implícito)';
                effectiveTarget = 'USD';
            } else {
                rateUsed = rates.euro.price;
                rateName = 'Tasa Euro BCV';
                effectiveTarget = 'VES';
            }
        } else if (currency === 'VES') {
            if (effectiveTarget === 'USDT') {
                rateUsed = 1 / rates.usdt.price;
                rateName = 'Compra USDT';
            } else if (effectiveTarget === 'EUR') {
                rateUsed = 1 / rates.euro.price;
                rateName = 'Compra EUR';
            } else {
                rateUsed = 1 / rates.bcv.price;
                rateName = 'Compra BCV';
                effectiveTarget = 'USD';
            }
        }

        return { rateUsed, rateName, target: effectiveTarget };
    }
};
