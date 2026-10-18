import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkPrintSupport } from '../adapters/tauri';
import { PrintableInvoiceDocument } from './PrintableInvoiceDocument';
import type { InvoiceDTO } from '../types';
import { Printer, Eye, CheckCircle2, AlertTriangle, XCircle, Info, Clock } from 'lucide-react';

type DialogStatus = 'untested' | 'observed' | 'not_observed';
type OutputStatus = 'untested' | 'confirmed' | 'canceled' | 'failed';

export interface PrintFeasibilityProbeProps {
  invoice?: InvoiceDTO;
}

export const PrintFeasibilityProbe: React.FC<PrintFeasibilityProbeProps> = ({ invoice }) => {
  const [inAppPreviewOpen, setInAppPreviewOpen] = useState(false);
  const [invocationTimestamp, setInvocationTimestamp] = useState<string | null>(null);
  const [dialogStatus, setDialogStatus] = useState<DialogStatus>('untested');
  const [outputStatus, setOutputStatus] = useState<OutputStatus>('untested');

  const { data: supportInfo, isLoading } = useQuery({
    queryKey: ['print_support'],
    queryFn: checkPrintSupport,
  });

  const handleNativePrint = () => {
    setInvocationTimestamp(new Date().toLocaleTimeString());
    // Directly invoke WebKitGTK / browser window.print()
    window.print();
  };

  const getEmpiricalSummary = () => {
    if (dialogStatus === 'observed' && outputStatus === 'confirmed') {
      return {
        badge: 'PASSED: Fully Verified',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        detail: 'Native print dialog appeared and physical or PDF output was successfully produced.',
      };
    }
    if (dialogStatus === 'observed') {
      return {
        badge: 'PARTIAL: Dialog Observed',
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        detail: 'Native print dialog appeared on screen. Output generation pending verification.',
      };
    }
    if (dialogStatus === 'not_observed') {
      return {
        badge: 'FAILED: Dialog Not Observed',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        detail: 'window.print() was dispatched, but no native OS print modal appeared.',
      };
    }
    return {
      badge: 'UNVERIFIED: Awaiting Test',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      detail: 'Printing capability is not empirically verified until the native dialog has been observed on this system.',
    };
  };

  const empirical = getEmpiricalSummary();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Probe UI Controls & Diagnostics — STRICTLY HIDDEN IN PRINT */}
      <div className="no-print space-y-6">
        <div className="pb-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Printer className="w-6 h-6 text-slate-800" /> Native Print & A4 Feasibility Probe
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Empirical testing of host WebKitGTK / browser print capabilities, OS print dialog invocation, and in-app A4 styling.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${empirical.color}`}>
            {empirical.badge}
          </span>
        </div>

        {/* Diagnostics Card */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-700" /> Platform Print Diagnostic
          </h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Inspecting platform capabilities...</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-xs text-gray-500 block uppercase">Detected Platform</span>
                  <span className="font-semibold text-gray-900 font-mono">{supportInfo?.platform || 'Unknown'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-xs text-gray-500 block uppercase">Native Dialog Capability</span>
                  <span className={`font-semibold flex items-center gap-1 ${supportInfo?.native_dialog_available ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {supportInfo?.native_dialog_available ? 'Available for Dispatch' : 'Unavailable / No Display'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-xs text-gray-500 block uppercase">CUPS / lp Detected</span>
                  <span className={`font-semibold flex items-center gap-1 ${supportInfo?.cups_detected ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {supportInfo?.cups_detected ? 'Detected in PATH' : 'Not Found in PATH'}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <span className="text-xs text-gray-500 block uppercase">A4 CSS Isolation</span>
                  <span className="font-semibold flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Isolated (@page A4)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                <strong>Architecture Note:</strong> {supportInfo?.notes}
              </div>
            </div>
          )}
        </div>

        {/* Empirical Verification Workflow */}
        <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Three-Stage Empirical Capability Verification</h2>

          {/* Stage 1: Invocation */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 1: Invocation</span>
              {invocationTimestamp && (
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Dispatched at {invocationTimestamp}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleNativePrint}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-sm flex items-center gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Trigger window.print() Probe
              </button>
              <button
                type="button"
                onClick={() => setInAppPreviewOpen(!inAppPreviewOpen)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded font-medium text-sm flex items-center gap-2 shadow-sm"
              >
                <Eye className="w-4 h-4" />
                {inAppPreviewOpen ? 'Hide In-App A4 Preview' : 'Show In-App A4 Preview'}
              </button>
            </div>
          </div>

          {/* Stage 2: Native Dialog Observation */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 2: Dialog Observation</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                dialogStatus === 'observed' ? 'bg-emerald-100 text-emerald-800' :
                dialogStatus === 'not_observed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {dialogStatus === 'observed' ? 'Observed' : dialogStatus === 'not_observed' ? 'Not Observed' : 'Untested'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Did the native operating system / GTK print modal window physically appear on your desktop?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDialogStatus('observed')}
                className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                  dialogStatus === 'observed'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Yes, Native Dialog Appeared
              </button>
              <button
                type="button"
                onClick={() => setDialogStatus('not_observed')}
                className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                  dialogStatus === 'not_observed'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> No, Nothing Appeared
              </button>
            </div>
          </div>

          {/* Stage 3: Print Output / Spool Verification */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 3: Output Verification</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                outputStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                outputStatus === 'failed' ? 'bg-rose-100 text-rose-800' :
                outputStatus === 'canceled' ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {outputStatus === 'confirmed' ? 'Output Confirmed' :
                 outputStatus === 'failed' ? 'Print Failed' :
                 outputStatus === 'canceled' ? 'Canceled by User' : 'Untested'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Was a physical printout dispatched, or a valid PDF file successfully produced on disk?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setOutputStatus('confirmed')}
                className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                  outputStatus === 'confirmed'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed (Printed or Saved PDF)
              </button>
              <button
                type="button"
                onClick={() => setOutputStatus('canceled')}
                className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                  outputStatus === 'canceled'
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Dismissed / Canceled
              </button>
              <button
                type="button"
                onClick={() => setOutputStatus('failed')}
                className={`px-3 py-1.5 rounded text-xs font-medium border flex items-center gap-1.5 ${
                  outputStatus === 'failed'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Failed / Error
              </button>
            </div>
          </div>

          {/* Status Explanation */}
          <div className={`p-4 rounded-lg border text-xs space-y-1 ${empirical.color}`}>
            <div className="font-semibold flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Empirical Result: {empirical.badge}
            </div>
            <div>{empirical.detail}</div>
          </div>
        </div>
      </div>

      {/* In-App Simulated On-Screen Preview — STRICTLY no-print since App root mounts the print document */}
      {inAppPreviewOpen && (
        <div className="bg-gray-100 p-8 border border-gray-300 rounded-lg overflow-x-auto flex justify-center shadow-inner no-print">
          <div className="shadow-2xl">
            <PrintableInvoiceDocument invoice={invoice} />
          </div>
        </div>
      )}
    </div>
  );
};
