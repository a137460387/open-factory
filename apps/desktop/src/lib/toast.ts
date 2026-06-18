export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastEventDetail {
  title: string;
  message?: string;
  kind?: ToastKind;
  action?: {
    label: string;
    onClick(): void;
  };
}

export function showToast(detail: ToastEventDetail): void {
  window.dispatchEvent(new CustomEvent<ToastEventDetail>('open-factory-toast', { detail }));
}
