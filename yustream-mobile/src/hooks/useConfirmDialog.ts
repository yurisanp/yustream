import { useState, useCallback } from 'react';

interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmStyle: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'default' | 'destructive';
}

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    confirmStyle: 'default',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const showConfirmDialog = useCallback((
    options: ConfirmDialogOptions,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    setDialogState({
      visible: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      confirmStyle: options.confirmStyle || 'default',
      onConfirm: () => {
        onConfirm();
        hideDialog();
      },
      onCancel: () => {
        onCancel?.();
        hideDialog();
      },
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  return {
    dialogState,
    showConfirmDialog,
    hideDialog,
  };
};
