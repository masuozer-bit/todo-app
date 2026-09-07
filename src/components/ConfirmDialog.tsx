"use client";

import { useI18n } from "./I18nProvider";
import Dialog from "./ui/Dialog";

/** A dialog only appears when something disappears for good. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  /** Defaults to "Delete", the only reason this dialog exists. */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button onClick={onCancel} className="btn btn-secondary">{t("Cancel")}</button>
          <button onClick={onConfirm} className="btn btn-danger">{confirmLabel ?? t("Delete")}</button>
        </>
      }
    >
      {message}
    </Dialog>
  );
}
