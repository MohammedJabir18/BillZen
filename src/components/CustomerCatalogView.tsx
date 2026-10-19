import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  AlertTriangle,
  Archive,
  RefreshCw,
  Edit2,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import type { Customer, CreateCustomerDto, UpdateCustomerDto, BusinessSettings } from '../types';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
} from '../adapters/tauri';
import { formatMinorUnits } from '../domain/financial';
import { translations, Language } from '../i18n';

interface CustomerCatalogViewProps {
  settings: BusinessSettings;
  language: Language;
}

export const CustomerCatalogView: React.FC<CustomerCatalogViewProps> = ({ settings, language }) => {
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form fields
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formTaxId, setFormTaxId] = useState<string>('');
  const [formAddress1, setFormAddress1] = useState<string>('');
  const [formAddress2, setFormAddress2] = useState<string>('');
  const [formCity, setFormCity] = useState<string>('');
  const [formState, setFormState] = useState<string>('');
  const [formPostal, setFormPostal] = useState<string>('');
  const [formCountry, setFormCountry] = useState<string>('India');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchCustomerData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const activeParam =
        statusFilter === 'all' ? null : statusFilter === 'active';
      const fetched = await getCustomers({
        search: searchQuery.trim() || null,
        is_active: activeParam,
      });
      setCustomers(fetched);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [searchQuery, statusFilter]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormTaxId('');
    setFormAddress1('');
    setFormAddress2('');
    setFormCity('');
    setFormState('');
    setFormPostal('');
    setFormCountry(settings.country || 'India');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormTaxId(c.tax_identifier || '');
    setFormAddress1(c.address_line1 || '');
    setFormAddress2(c.address_line2 || '');
    setFormCity(c.city || '');
    setFormState(c.state || '');
    setFormPostal(c.postal_code || '');
    setFormCountry(c.country || settings.country || 'India');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameClean = formName.trim();
    if (!nameClean) {
      setFormError(t.err_name_required);
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        const updateDto: UpdateCustomerDto = {
          id: editingCustomer.id,
          name: nameClean,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          tax_identifier: formTaxId.trim() || null,
          address_line1: formAddress1.trim() || null,
          address_line2: formAddress2.trim() || null,
          city: formCity.trim() || null,
          state: formState.trim() || null,
          postal_code: formPostal.trim() || null,
          country: formCountry.trim() || 'India',
        };
        await updateCustomer(updateDto);
        setSuccessMsg(t.msg_customer_saved);
      } else {
        const createDto: CreateCustomerDto = {
          name: nameClean,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          tax_identifier: formTaxId.trim() || null,
          address_line1: formAddress1.trim() || null,
          address_line2: formAddress2.trim() || null,
          city: formCity.trim() || null,
          state: formState.trim() || null,
          postal_code: formPostal.trim() || null,
          country: formCountry.trim() || 'India',
        };
        await createCustomer(createDto);
        setSuccessMsg(t.msg_customer_saved);
      }
      setIsModalOpen(false);
      await fetchCustomerData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setFormError(typeof err === 'string' ? err : err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm(t.confirm_archive)) return;
    try {
      await archiveCustomer(id);
      setSuccessMsg(t.msg_archived);
      await fetchCustomerData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to archive customer');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreCustomer(id);
      setSuccessMsg(t.msg_restored);
      await fetchCustomerData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Failed to restore customer');
    }
  };

  return (
    <div className={`p-4 sm:p-6 pb-24 lg:pb-6 max-w-7xl mx-auto ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            {t.tab_customers}
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            Manage your customer database, contact details, tax identifiers, and balances
          </p>
        </div>

        <button
          onClick={openCreateModal}
          data-testid="add-customer-button"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <Plus className="w-5 h-5" />
          {t.action_add_new}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-gray-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            data-testid="customer-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone (+91/+971...), or tax ID..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 rounded-lg text-sm focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="active">{t.filter_active}</option>
            <option value="archived">{t.filter_archived}</option>
            <option value="all">{t.filter_all}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            Loading customer records...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-zinc-400">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
            <p className="text-base font-medium text-gray-700 dark:text-zinc-200">{t.empty_state_no_items}</p>
            <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">Add a new customer to start maintaining contacts</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-zinc-300">
                <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-semibold border-b border-gray-200 dark:border-zinc-700 uppercase text-xs">
                  <tr>
                    <th className="py-3 px-4">{t.customer_name}</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">{t.customer_tax_id}</th>
                    <th className="py-3 px-4 text-right">{t.customer_balance}</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      data-testid={`customer-row-${c.name}`}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-900 dark:text-zinc-100 block">{c.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        {c.phone && (
                          <span className="text-xs text-gray-700 dark:text-zinc-300 flex items-center gap-1 font-mono">
                            <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
                            {c.email}
                          </span>
                        )}
                        {!c.phone && !c.email && <span className="text-gray-400 dark:text-zinc-500 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-gray-700 dark:text-zinc-300 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                          <span>
                            {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.tax_identifier ? (
                          <span className="font-mono text-xs text-gray-800 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            {c.tax_identifier}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-zinc-100 tabular-nums">
                        {settings.currency_symbol}{' '}
                        {formatMinorUnits(c.current_balance_minor, settings.currency_exponent)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.is_active ? (
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
                            onClick={() => openEditModal(c)}
                            data-testid={`edit-customer-${c.name}`}
                            title={t.action_edit}
                            className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {c.is_active ? (
                            <button
                              onClick={() => handleArchive(c.id)}
                              data-testid={`archive-customer-${c.name}`}
                              title={t.action_archive}
                              className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(c.id)}
                              data-testid={`restore-customer-${c.name}`}
                              title={t.action_restore}
                              className="p-1.5 text-gray-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-zinc-800">
              {customers.map((c) => (
                <div
                  key={c.id}
                  data-testid={`customer-row-${c.name}`}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-zinc-100 block text-base">{c.name}</span>
                      <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                        <span>{[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}</span>
                      </div>
                    </div>
                    {c.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {t.status_active}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                        {t.status_archived}
                      </span>
                    )}
                  </div>

                  {/* Contact Info Badges */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md font-mono text-gray-700 dark:text-zinc-300">
                        <Phone className="w-3 h-3 text-gray-500 dark:text-zinc-400" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-gray-700 dark:text-zinc-300">
                        <Mail className="w-3 h-3 text-gray-500 dark:text-zinc-400" />
                        {c.email}
                      </span>
                    )}
                    {c.tax_identifier && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-md font-mono text-indigo-700 dark:text-indigo-300">
                        TRN: {c.tax_identifier}
                      </span>
                    )}
                  </div>

                  {/* Balance Display */}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-zinc-800/60">
                    <span className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{t.customer_balance}</span>
                    <span className="font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
                      {settings.currency_symbol}{' '}
                      {formatMinorUnits(c.current_balance_minor, settings.currency_exponent)}
                    </span>
                  </div>

                  {/* Actions Toolbar - Thumb friendly */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      onClick={() => openEditModal(c)}
                      data-testid={`edit-customer-${c.name}`}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 active:bg-gray-300 dark:active:bg-zinc-600 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600 dark:text-zinc-400" />
                      {t.action_edit}
                    </button>
                    {c.is_active ? (
                      <button
                        onClick={() => handleArchive(c.id)}
                        data-testid={`archive-customer-${c.name}`}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 active:bg-rose-200 dark:active:bg-rose-900/60 rounded-lg transition-colors border border-rose-100 dark:border-rose-900/50"
                      >
                        <Archive className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        {t.action_archive}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(c.id)}
                        data-testid={`restore-customer-${c.name}`}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:bg-emerald-200 dark:active:bg-emerald-900/60 rounded-lg transition-colors border border-emerald-100 dark:border-emerald-900/50"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        {t.action_restore}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Drawer for Create / Edit Customer */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" data-testid="customer-modal-dialog" className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                {editingCustomer ? t.action_edit : t.action_add_new} {t.tab_customers}
              </h2>
              <button
                data-testid="close-customer-modal"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {formError && (
                <div
                  data-testid="customer-form-error"
                  className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 rounded-lg text-sm flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                  {t.customer_name} *
                </label>
                <input
                  type="text"
                  data-testid="input-customer-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Al-Nuaimi Trading LLC / Rahul Sharma"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_phone}
                  </label>
                  <input
                    type="text"
                    data-testid="input-customer-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+971 50 123 4567 / +91 98765 43210"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_email}
                  </label>
                  <input
                    type="email"
                    data-testid="input-customer-email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="contact@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tax Identifier & Country */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_tax_id}
                  </label>
                  <input
                    type="text"
                    data-testid="input-customer-tax-id"
                    value={formTaxId}
                    onChange={(e) => setFormTaxId(e.target.value)}
                    placeholder="GSTIN (India) / TRN (UAE/KSA)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg font-mono uppercase text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_country}
                  </label>
                  <input
                    type="text"
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    placeholder="India / United Arab Emirates"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Address Lines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_address1}
                  </label>
                  <input
                    type="text"
                    value={formAddress1}
                    onChange={(e) => setFormAddress1(e.target.value)}
                    placeholder="Building, street, road..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_address2}
                  </label>
                  <input
                    type="text"
                    value={formAddress2}
                    onChange={(e) => setFormAddress2(e.target.value)}
                    placeholder="Suite, unit, floor..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* City, State, Postal Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_city}
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_state}
                  </label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    placeholder="State / Emirate"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                    {t.customer_postal}
                  </label>
                  <input
                    type="text"
                    value={formPostal}
                    onChange={(e) => setFormPostal(e.target.value)}
                    placeholder="PIN / Postal Code"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-900 flex justify-end gap-3 pt-4 pb-2 border-t border-gray-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center justify-center"
                >
                  {t.action_cancel}
                </button>
                <button
                  type="submit"
                  data-testid="save-customer-submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
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
