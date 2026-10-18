import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Archive,
  RefreshCw,
  Edit2,
  Check,
  X,
  ScanBarcode,
  Tag,
} from 'lucide-react';
import type { Product, Category, CreateProductDto, UpdateProductDto, BusinessSettings } from '../types';
import {
  getProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  getCategories,
  createCategory,
} from '../adapters/tauri';
import { formatMinorUnits, parseToMinorUnits, MAX_MONEY_MINOR, MAX_QUANTITY_SCALED } from '../domain/financial';
import { translations, Language } from '../i18n';

interface ProductCatalogViewProps {
  settings: BusinessSettings;
  language: Language;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({ settings, language }) => {
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [formSku, setFormSku] = useState<string>('');
  const [formBarcode, setFormBarcode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('pcs');
  const [formUnitPrice, setFormUnitPrice] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formTaxRate, setFormTaxRate] = useState<string>('0');
  const [formIsTracked, setFormIsTracked] = useState<boolean>(true);
  const [formOpeningStock, setFormOpeningStock] = useState<string>('0');
  const [formMinThreshold, setFormMinThreshold] = useState<string>('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Quick category creation
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchCatalogData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const activeParam =
        statusFilter === 'all' ? null : statusFilter === 'active';
      const fetchedProducts = await getProducts({
        search: searchQuery.trim() || null,
        category_id: categoryFilter || null,
        is_active: activeParam,
        low_stock_only: lowStockFilter || null,
      });
      setProducts(fetchedProducts);

      const fetchedCategories = await getCategories();
      setCategories(fetchedCategories);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogData();
  }, [searchQuery, statusFilter, categoryFilter, lowStockFilter]);

  // Handle keyboard-wedge scanner Enter on search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = searchQuery.trim();
      if (code) {
        setLastScannedBarcode(code);
        setTimeout(() => setLastScannedBarcode(null), 3000);
      }
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormSku('');
    setFormBarcode('');
    setFormName('');
    setFormDescription('');
    setFormCategoryId('');
    setFormUnit('pcs');
    setFormUnitPrice('');
    setFormCostPrice('');
    setFormTaxRate('0');
    setFormIsTracked(true);
    setFormOpeningStock('0');
    setFormMinThreshold('0');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormBarcode(p.barcode || '');
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormCategoryId(p.category_id || '');
    setFormUnit(p.unit);
    setFormUnitPrice(formatMinorUnits(p.unit_price_minor, settings.currency_exponent));
    setFormCostPrice(
      p.cost_price_minor > 0
        ? formatMinorUnits(p.cost_price_minor, settings.currency_exponent)
        : ''
    );
    setFormTaxRate((p.tax_rate_bp / 100).toString());
    setFormIsTracked(p.is_stock_tracked);
    setFormOpeningStock((p.current_stock_scaled / 1000).toString());
    setFormMinThreshold((p.min_stock_threshold_scaled / 1000).toString());
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory({ name: newCatName.trim() });
      setCategories([...categories, created]);
      setFormCategoryId(created.id);
      setNewCatName('');
      setIsAddingCategory(false);
    } catch (err: any) {
      setFormError(typeof err === 'string' ? err : err.message || 'Failed to create category');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const skuClean = formSku.trim().toUpperCase();
    if (!skuClean) {
      setFormError(t.err_sku_required);
      return;
    }
    if (!formName.trim()) {
      setFormError(t.err_name_required);
      return;
    }

    let unitPriceMinor: number;
    try {
      unitPriceMinor = parseToMinorUnits(formUnitPrice, settings.currency_exponent);
      if (unitPriceMinor < 0 || unitPriceMinor > MAX_MONEY_MINOR) throw new Error();
    } catch {
      setFormError(t.err_invalid_price);
      return;
    }

    let costPriceMinor = 0;
    if (formCostPrice.trim()) {
      try {
        costPriceMinor = parseToMinorUnits(formCostPrice, settings.currency_exponent);
        if (costPriceMinor < 0 || costPriceMinor > MAX_MONEY_MINOR) throw new Error();
      } catch {
        setFormError('Cost price must be between 0 and 1,000,000,000');
        return;
      }
    }

    const taxPercent = parseFloat(formTaxRate || '0');
    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      setFormError('Tax rate must be between 0% and 100%');
      return;
    }
    const taxRateBp = Math.round(taxPercent * 100);

    const minThresholdFloat = parseFloat(formMinThreshold || '0');
    if (isNaN(minThresholdFloat) || minThresholdFloat < 0) {
      setFormError('Minimum threshold must be a non-negative number');
      return;
    }
    const minThresholdScaled = Math.round(minThresholdFloat * 1000);
    if (minThresholdScaled > MAX_QUANTITY_SCALED) {
      setFormError('Minimum threshold exceeds maximum supported quantity (1,000,000)');
      return;
    }

    setSaving(true);
    try {
      if (editingProduct) {
        // Update product (stock quantity remains ledger-controlled and is untouched)
        const updateDto: UpdateProductDto = {
          id: editingProduct.id,
          sku: skuClean,
          barcode: formBarcode.trim() || null,
          name: formName.trim(),
          description: formDescription.trim() || null,
          category_id: formCategoryId || null,
          unit: formUnit.trim() || 'pcs',
          unit_price_minor: unitPriceMinor,
          cost_price_minor: costPriceMinor,
          tax_rate_bp: taxRateBp,
          is_stock_tracked: formIsTracked,
          min_stock_threshold_scaled: minThresholdScaled,
        };
        await updateProduct(updateDto);
        setSuccessMsg(t.msg_product_saved);
      } else {
        // Create product
        let openingStockScaled = 0;
        if (!formIsTracked) {
          const openingStockFloat = parseFloat(formOpeningStock || '0');
          if (!isNaN(openingStockFloat) && openingStockFloat > 0) {
            setFormError('Untracked products cannot have opening stock');
            setSaving(false);
            return;
          }
        } else {
          const openingStockFloat = parseFloat(formOpeningStock || '0');
          if (isNaN(openingStockFloat) || openingStockFloat < 0) {
            setFormError('Opening stock must be a non-negative number');
            setSaving(false);
            return;
          }
          openingStockScaled = Math.round(openingStockFloat * 1000);
          if (openingStockScaled > MAX_QUANTITY_SCALED) {
            setFormError('Opening stock exceeds maximum supported quantity (1,000,000)');
            setSaving(false);
            return;
          }
        }

        const createDto: CreateProductDto = {
          sku: skuClean,
          barcode: formBarcode.trim() || null,
          name: formName.trim(),
          description: formDescription.trim() || null,
          category_id: formCategoryId || null,
          unit: formUnit.trim() || 'pcs',
          unit_price_minor: unitPriceMinor,
          cost_price_minor: costPriceMinor,
          tax_rate_bp: taxRateBp,
          is_stock_tracked: formIsTracked,
          opening_stock_scaled: formIsTracked ? openingStockScaled : 0,
          min_stock_threshold_scaled: minThresholdScaled,
        };
        await createProduct(createDto);
        setSuccessMsg(t.msg_product_saved);
      }
      setIsModalOpen(false);
      await fetchCatalogData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setFormError(typeof err === 'string' ? err : err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm(t.confirm_archive)) return;
    try {
      await archiveProduct(id);
      setSuccessMsg(t.msg_archived);
      await fetchCatalogData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to archive product');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreProduct(id);
      setSuccessMsg(t.msg_restored);
      await fetchCatalogData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to restore product');
    }
  };

  return (
    <div className={`p-4 sm:p-6 pb-24 lg:pb-6 max-w-7xl mx-auto ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600 dark:text-lime-400" />
            {t.tab_products}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Manage your inventory items, pricing, barcodes, and stock levels
          </p>
        </div>

        <button
          onClick={openCreateModal}
          data-testid="add-product-button"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-lime-500 dark:hover:bg-lime-400 text-white dark:text-zinc-950 font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 dark:focus:ring-lime-400 focus:outline-none"
        >
          <Plus className="w-5 h-5" />
          {t.action_add_new}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {lastScannedBarcode && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 rounded-lg flex items-center gap-2 animate-pulse">
          <ScanBarcode className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          <span>
            {t.product_scanner_detected}: <strong>{lastScannedBarcode}</strong>
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-gray-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            data-testid="product-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t.search_placeholder}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-lime-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-lime-400 focus:outline-none"
          >
            <option value="active">{t.filter_active}</option>
            <option value="archived">{t.filter_archived}</option>
            <option value="all">{t.filter_all}</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-lime-400 focus:outline-none"
          >
            <option value="">{t.product_category_all}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="w-4 h-4 text-indigo-600 dark:text-lime-500 rounded focus:ring-indigo-500 dark:focus:ring-lime-400"
            />
            {t.filter_low_stock}
          </label>
        </div>
      </div>

      {/* Table & Cards Container */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 dark:text-lime-400" />
            Loading catalog records...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
            <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
            <p className="text-base font-medium text-gray-700 dark:text-zinc-200">{t.empty_state_no_items}</p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">Try adjusting search or filters, or add a new product</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile, visible on md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-zinc-300">
                <thead className="bg-gray-50 dark:bg-zinc-800/80 text-gray-700 dark:text-zinc-300 font-semibold border-b border-gray-200 dark:border-zinc-800 uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">{t.product_sku} / {t.product_barcode}</th>
                    <th className="py-3 px-4">{t.product_name}</th>
                    <th className="py-3 px-4">{t.product_category}</th>
                    <th className="py-3 px-4 text-right">{t.product_selling_price}</th>
                    <th className="py-3 px-4 text-center">{t.product_tax_rate}</th>
                    <th className="py-3 px-4 text-right">{t.product_current_stock}</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {products.map((p) => {
                    const isLow =
                      p.is_stock_tracked && p.current_stock_scaled <= p.min_stock_threshold_scaled;
                    return (
                      <tr
                        key={p.id}
                        data-testid={`product-row-${p.sku}`}
                        className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-gray-900 dark:text-zinc-100 block">{p.sku}</span>
                          {p.barcode && (
                            <span className="text-xs font-mono text-gray-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                              <ScanBarcode className="w-3.5 h-3.5" />
                              {p.barcode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 dark:text-zinc-100 block">{p.name}</span>
                          {p.description && (
                            <span className="text-xs text-gray-400 dark:text-zinc-500 truncate max-w-xs block">
                              {p.description}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.category_name ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-300">
                              <Tag className="w-3 h-3" />
                              {p.category_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-zinc-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-zinc-100 tabular-nums">
                          {settings.currency_symbol}{' '}
                          {formatMinorUnits(p.unit_price_minor, settings.currency_exponent)}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-gray-700 dark:text-zinc-300">
                          {(p.tax_rate_bp / 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {p.is_stock_tracked ? (
                            <div>
                              <span className={`font-semibold ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-zinc-200'}`}>
                                {(p.current_stock_scaled / 1000).toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 3,
                                })}{' '}
                                <span className="text-xs font-normal text-gray-500 dark:text-zinc-400">{p.unit}</span>
                              </span>
                              {isLow && (
                                <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium">Low stock</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-zinc-500 italic">Not tracked</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.is_active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              {t.status_active}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                              {t.status_archived}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              data-testid={`edit-product-${p.sku}`}
                              title={t.action_edit}
                              className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-lime-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {p.is_active ? (
                              <button
                                onClick={() => handleArchive(p.id)}
                                data-testid={`archive-product-${p.sku}`}
                                title={t.action_archive}
                                className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestore(p.id)}
                                data-testid={`restore-product-${p.sku}`}
                                title={t.action_restore}
                                className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (visible on < md screens) */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
              {products.map((p) => {
                const isLow =
                  p.is_stock_tracked && p.current_stock_scaled <= p.min_stock_threshold_scaled;
                return (
                  <div
                    key={p.id}
                    data-testid={`product-card-${p.sku}`}
                    className="p-4 space-y-3 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-base leading-snug break-words">
                          {p.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-zinc-400 font-mono flex-wrap">
                          <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-zinc-300 font-semibold">
                            {p.sku}
                          </span>
                          {p.barcode && (
                            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                              <ScanBarcode className="w-3.5 h-3.5" />
                              {p.barcode}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {p.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            {t.status_active}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                            {t.status_archived}
                          </span>
                        )}
                        {p.category_name && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                            <Tag className="w-3 h-3" />
                            {p.category_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">{p.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800 text-sm">
                      <div>
                        <span className="text-xs text-gray-400 dark:text-zinc-500 block">{t.product_selling_price}</span>
                        <span className="font-semibold text-gray-900 dark:text-zinc-100 tabular-nums">
                          {settings.currency_symbol}{' '}
                          {formatMinorUnits(p.unit_price_minor, settings.currency_exponent)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500 ml-1">
                          ({(p.tax_rate_bp / 100).toFixed(1)}% tax)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 dark:text-zinc-500 block">{t.product_current_stock}</span>
                        {p.is_stock_tracked ? (
                          <div>
                            <span
                              className={`font-semibold tabular-nums ${
                                isLow ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-zinc-200'
                              }`}
                            >
                              {(p.current_stock_scaled / 1000).toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 3,
                              })}{' '}
                              <span className="text-xs font-normal text-gray-500 dark:text-zinc-400">{p.unit}</span>
                            </span>
                            {isLow && (
                              <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium">
                                Low stock
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-zinc-500 italic">Not tracked</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                      <button
                        onClick={() => openEditModal(p)}
                        data-testid={`edit-product-mobile-${p.sku}`}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 min-h-[44px]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {t.action_edit}
                      </button>
                      {p.is_active ? (
                        <button
                          onClick={() => handleArchive(p.id)}
                          data-testid={`archive-product-mobile-${p.sku}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1.5 min-h-[44px]"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          {t.action_archive}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestore(p.id)}
                          data-testid={`restore-product-mobile-${p.sku}`}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center gap-1.5 min-h-[44px]"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {t.action_restore}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Drawer for Create / Edit Product */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {editingProduct ? t.action_edit : t.action_add_new} {t.tab_products}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5">
              {formError && (
                <div
                  data-testid="product-form-error"
                  className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 rounded-lg text-sm flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* SKU */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_sku} *
                  </label>
                  <input
                    type="text"
                    data-testid="input-product-sku"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    placeholder="e.g. ITEM-001"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg font-mono uppercase text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_barcode}
                  </label>
                  <input
                    type="text"
                    data-testid="input-product-barcode"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="e.g. 0012345678905"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  {t.product_name} *
                </label>
                <input
                  type="text"
                  data-testid="input-product-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Premium Basmati Rice 5kg"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                      {t.product_category}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(!isAddingCategory)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                    >
                      + Quick Add
                    </button>
                  </div>

                  {isAddingCategory ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Category Name"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">No Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_unit}
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="e.g. pcs, kg, bag, box"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_selling_price} ({settings.currency_symbol}) *
                  </label>
                  <input
                    type="text"
                    data-testid="input-product-price"
                    value={formUnitPrice}
                    onChange={(e) => setFormUnitPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg tabular-nums text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_cost_price} ({settings.currency_symbol})
                  </label>
                  <input
                    type="text"
                    data-testid="input-product-cost-price"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg tabular-nums text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.product_tax_rate}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg tabular-nums text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Stock Tracking Configuration */}
              <div className="p-4 bg-gray-50 dark:bg-zinc-800/40 border border-gray-200 dark:border-zinc-800 rounded-xl space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-gray-900 dark:text-zinc-100 text-sm">
                  <input
                    type="checkbox"
                    checked={formIsTracked}
                    onChange={(e) => setFormIsTracked(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  {t.product_stock_tracking}
                </label>

                {formIsTracked && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                        {editingProduct ? t.product_current_stock : t.product_opening_stock}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        data-testid="input-product-opening-stock"
                        value={formOpeningStock}
                        onChange={(e) => setFormOpeningStock(e.target.value)}
                        disabled={!!editingProduct}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg tabular-nums text-sm ${
                          editingProduct ? 'bg-gray-100 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 cursor-not-allowed' : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100'
                        }`}
                      />
                      {editingProduct && (
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                          Stock quantity is ledger-controlled and cannot be edited directly.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                        {t.product_min_threshold}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={formMinThreshold}
                        onChange={(e) => setFormMinThreshold(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg tabular-nums text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  {t.product_desc}
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional notes or details..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  {t.action_cancel}
                </button>
                <button
                  type="submit"
                  data-testid="save-product-submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {t.action_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
