import { Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";

interface DeleteConfirmDialogProps {
  /** Name of the activity to display in the confirmation message */
  activityName: string;
  /** Called when the user confirms the deletion */
  onConfirm: () => void;
  /** Called when the user cancels or closes the dialog */
  onCancel: () => void;
  /** Whether the delete action is currently in progress */
  isDeleting?: boolean;
  /** Element that opened the dialog and should regain focus when it closes */
  returnFocusTo?: HTMLElement | null;
}

/**
 * Modal dialog that asks the user to confirm before deleting an activity.
 */
const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  activityName,
  onConfirm,
  onCancel,
  isDeleting = false,
  returnFocusTo,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = returnFocusTo ?? document.activeElement;
    cancelButtonRef.current?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [returnFocusTo]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      if (!isDeleting) {
        event.preventDefault();
        onCancel();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleCancel = () => {
    if (!isDeleting) onCancel();
  };

  return (
    /* Backdrop */
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/50 p-0"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Panel */}
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" aria-hidden="true" />
            </div>
            <h2
              id="delete-dialog-title"
              className="text-lg font-semibold text-gray-900"
            >
              Delete activity
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-900">"{activityName}"</span>?
          This action cannot be undone.
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={handleCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting && (
              <span
                className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default DeleteConfirmDialog;
