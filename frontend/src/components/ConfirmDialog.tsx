interface ConfirmDialogProps {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[100]" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-7 max-w-[360px] w-[90%] shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">{title}</h3>
        {children && <div className="mb-5">{children}</div>}
        <div className="flex gap-3 justify-end">
          <button
            className="bg-red-700 hover:bg-red-800 text-white border-none rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2 rounded-lg border border-slate-200 text-sm cursor-pointer transition-colors"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
