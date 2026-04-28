export function buildProductPayload(formData, effectiveRate) {
    const {
        name,
        barcode,
        priceUsd,
        priceBs,
        priceCop,
        costUsd,
        costBs,
        stock,
        stockInLotes,
        packagingType,
        unitsPerPackage,
        granelUnit,
        sellByUnit,
        unitPriceUsd,
        unitPriceCop,
        category,
        lowStockAlert
    } = formData;

    const formattedName = name.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
    const safeRate = effectiveRate > 0 ? effectiveRate : 1;
    const finalPriceUsd = priceUsd ? parseFloat(priceUsd) : (priceBs ? Math.round(parseFloat(priceBs) / safeRate * 100) / 100 : 0);
    const finalCostUsd = costUsd ? parseFloat(costUsd) : (costBs ? Math.round(parseFloat(costBs) / safeRate * 100) / 100 : 0);
    const finalCostBs = costBs ? parseFloat(costBs) : (costUsd ? Math.round(parseFloat(costUsd) * safeRate * 100) / 100 : 0);

    // COP: guardar el valor exacto que escribió el usuario (sin redondeo de ida/vuelta)
    const finalPriceCop = priceCop && parseFloat(priceCop) > 0 ? Math.round(parseFloat(priceCop)) : null;

    // Map packagingType → unit legacy
    let legacyUnit = 'unidad';
    if (packagingType === 'lote') legacyUnit = 'paquete';
    else if (packagingType === 'granel') legacyUnit = granelUnit;

    const isLote = packagingType === 'lote';
    const parsedUnitsPerPkg = isLote && unitsPerPackage ? parseInt(unitsPerPackage) : 1;
    const autoUnitPrice = parsedUnitsPerPkg > 1 ? finalPriceUsd / parsedUnitsPerPkg : finalPriceUsd;
    const finalUnitPrice = sellByUnit && unitPriceUsd ? parseFloat(unitPriceUsd) : autoUnitPrice;

    // Unit price in COP for lote products
    const finalUnitPriceCop = isLote && sellByUnit && unitPriceCop && parseFloat(unitPriceCop) > 0
        ? Math.round(parseFloat(unitPriceCop))
        : (isLote && sellByUnit && finalPriceCop && parsedUnitsPerPkg > 1
            ? Math.round(finalPriceCop / parsedUnitsPerPkg)
            : null);

    // Stock: for lote, convert lotes → units
    let finalStock = stock ? parseInt(stock) : 0;
    if (isLote && stockInLotes && parsedUnitsPerPkg > 0) {
        finalStock = parseInt(stockInLotes) * parsedUnitsPerPkg;
    }

    return {
        name: formattedName,
        barcode: barcode ? barcode.trim() : null,
        priceUsdt: finalPriceUsd,
        priceCop: finalPriceCop,
        costUsd: finalCostUsd,
        costBs: finalCostBs,
        stock: finalStock,
        unit: legacyUnit,
        packagingType: packagingType,
        unitsPerPackage: parsedUnitsPerPkg,
        sellByUnit: isLote ? sellByUnit : false,
        unitPriceUsd: isLote && sellByUnit ? finalUnitPrice : null,
        unitPriceCop: isLote && sellByUnit ? finalUnitPriceCop : null,
        stockInLotes: isLote && stockInLotes ? parseInt(stockInLotes) : null,
        category: category,
        lowStockAlert: lowStockAlert ? parseInt(lowStockAlert) : 5,
    };
}
