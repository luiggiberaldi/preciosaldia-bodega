import { useState } from 'react';

export function useProductForm() {
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [barcode, setBarcode] = useState('');
    const [priceUsd, setPriceUsd] = useState('');
    const [priceBs, setPriceBs] = useState('');
    const [costUsd, setCostUsd] = useState('');
    const [costBs, setCostBs] = useState('');
    const [stock, setStock] = useState('');
    const [unit, setUnit] = useState('unidad');
    const [unitsPerPackage, setUnitsPerPackage] = useState('');
    const [sellByUnit, setSellByUnit] = useState(false);
    const [unitPriceUsd, setUnitPriceUsd] = useState('');
    const [category, setCategory] = useState('otros');
    const [lowStockAlert, setLowStockAlert] = useState('5');
    const [image, setImage] = useState(null);
    const [packagingType, setPackagingType] = useState('suelto');
    const [stockInLotes, setStockInLotes] = useState('');
    const [granelUnit, setGranelUnit] = useState('kg');
    const [isFormShaking, setIsFormShaking] = useState(false);

    const resetForm = () => {
        setName(''); setBarcode(''); setPriceUsd(''); setPriceBs(''); setCostUsd(''); setCostBs(''); setStock(''); setUnit('unidad'); setUnitsPerPackage(''); setSellByUnit(false); setUnitPriceUsd(''); setCategory('otros'); setLowStockAlert('5'); setImage(null); setEditingId(null);
        setPackagingType('suelto'); setStockInLotes(''); setGranelUnit('kg');
    };

    const populateForm = (product, effectiveRate) => {
        setEditingId(product.id);
        setName(product.name);
        setBarcode(product.barcode || '');

        const currentPriceUsd = product.priceUsdt || 0;
        setPriceUsd(currentPriceUsd > 0 ? currentPriceUsd.toString() : '');
        setPriceBs(currentPriceUsd > 0 ? (currentPriceUsd * effectiveRate).toFixed(2) : '');

        const currentCostUsd = product.costUsd || (product.costBs ? product.costBs / effectiveRate : 0);
        setCostUsd(currentCostUsd > 0 ? currentCostUsd.toFixed(2) : '');

        const currentCostBs = product.costBs || (product.costUsd ? product.costUsd * effectiveRate : 0);
        setCostBs(currentCostBs > 0 ? currentCostBs.toFixed(2) : '');

        setStock(product.stock ?? '');
        setUnit(product.unit || 'unidad');
        setUnitsPerPackage(product.unitsPerPackage || '');
        setSellByUnit(product.sellByUnit || false);
        setUnitPriceUsd(product.unitPriceUsd ? product.unitPriceUsd.toString() : '');
        setCategory(product.category || 'otros');
        setLowStockAlert(product.lowStockAlert ?? 5);
        setImage(product.image);

        // Derive packagingType from legacy unit
        const u = product.unit || 'unidad';
        if (product.packagingType) {
            setPackagingType(product.packagingType);
        } else if (u === 'paquete') {
            setPackagingType('lote');
        } else if (u === 'kg' || u === 'litro') {
            setPackagingType('granel');
            setGranelUnit(u);
        } else {
            setPackagingType('suelto');
        }

        // Stock in lotes
        if (product.stockInLotes) {
            setStockInLotes(product.stockInLotes.toString());
        } else if (u === 'paquete' && product.unitsPerPackage && product.stock) {
            setStockInLotes(Math.floor(product.stock / (product.unitsPerPackage || 1)).toString());
        } else {
            setStockInLotes('');
        }

        if (u === 'kg' || u === 'litro') setGranelUnit(u);
    };

    return {
        editingId, setEditingId,
        name, setName,
        barcode, setBarcode,
        priceUsd, setPriceUsd,
        priceBs, setPriceBs,
        costUsd, setCostUsd,
        costBs, setCostBs,
        stock, setStock,
        unit, setUnit,
        unitsPerPackage, setUnitsPerPackage,
        sellByUnit, setSellByUnit,
        unitPriceUsd, setUnitPriceUsd,
        category, setCategory,
        lowStockAlert, setLowStockAlert,
        image, setImage,
        packagingType, setPackagingType,
        stockInLotes, setStockInLotes,
        granelUnit, setGranelUnit,
        isFormShaking, setIsFormShaking,
        resetForm,
        populateForm,
    };
}
