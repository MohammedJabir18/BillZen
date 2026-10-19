/**
 * Dynamic print styling and document geometry preparation for BillZen.
 * Configures exact @page dimensions for A4 portrait vs 80mm thermal continuous printing.
 */

export function preparePrintStyles(format: 'a4' | 'thermal80', contentElement?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('billzen-dynamic-print-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'billzen-dynamic-print-style';
    document.head.appendChild(styleEl);
  }

  if (format === 'thermal80') {
    let heightMm = 180;
    if (contentElement) {
      const scrollHeight = contentElement.scrollHeight || contentElement.offsetHeight;
      if (scrollHeight > 0) {
        // Convert px to mm (1 in = 96 px = 25.4 mm), plus 10mm padding to ensure clean single-page boundary
        heightMm = Math.max(100, Math.ceil((scrollHeight * 25.4) / 96) + 12);
      }
    }
    styleEl.textContent = `
      @page {
        size: 80mm ${heightMm}mm !important;
        margin: 0 !important;
      }
    `;
    document.body.setAttribute('data-print-format', 'thermal80');
  } else {
    styleEl.textContent = `
      @page {
        size: A4 portrait !important;
        margin: 10mm 12mm !important;
      }
    `;
    document.body.setAttribute('data-print-format', 'a4');
  }
}

export function cleanupPrintStyles(): void {
  if (typeof document === 'undefined') return;
  document.body.removeAttribute('data-print-format');
}
