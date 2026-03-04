/**
 * ConfirmDialog — Reusable modal dialog for confirmations and alerts.
 * 
 * Usage:
 * <ConfirmDialog
 *   isOpen={showDialog}
 *   onClose={() => setShowDialog(false)}
 *   onConfirm={handleConfirmAction}
 *   title="Block IP Address"
 *   message="Are you sure you want to block this IP?"
 *   confirmText="Block"
 *   cancelText="Cancel"
 *   type="danger" // 'danger' | 'warning' | 'success' | 'info'
 * />
 */

import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle, CheckCircle, Info, Shield } from 'lucide-react'

const typeStyles = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    border: 'border-red-200',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    border: 'border-yellow-200',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmBtn: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    border: 'border-green-200',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    border: 'border-blue-200',
  },
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  showCancel = true,
  isLoading = false,
}) {
  const dialogRef = useRef(null)
  const style = typeStyles[type] || typeStyles.info
  const Icon = style.icon

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          className={`relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 border ${style.border}`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            {/* Icon */}
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${style.iconBg}`}>
              <Icon className={`h-7 w-7 ${style.iconColor}`} />
            </div>

            {/* Content */}
            <div className="mt-4 text-center">
              <h3 className="text-lg font-bold text-gray-900">
                {title}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              {showCancel && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all disabled:opacity-50"
                >
                  {cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${style.confirmBtn}`}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog


// ============================================================================
// Toast Notification Component (for success/error feedback)
// ============================================================================

export function Toast({ message, type = 'success', isVisible, onClose }) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const icons = {
    success: CheckCircle,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  }

  const Icon = icons[type] || icons.info

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => onClose(), 3000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[type]}`}>
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 p-1 hover:bg-black/5 rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}


// ============================================================================
// useToast Hook for easy toast management
// ============================================================================

export function useConfirmDialog() {
  const [dialogState, setDialogState] = React.useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Confirm',
    onConfirm: () => {},
  })

  const showDialog = ({ title, message, type = 'info', confirmText = 'Confirm', onConfirm }) => {
    setDialogState({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      onConfirm,
    })
  }

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }))
  }

  const DialogComponent = () => (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      onClose={closeDialog}
      onConfirm={() => {
        dialogState.onConfirm()
        closeDialog()
      }}
      title={dialogState.title}
      message={dialogState.message}
      type={dialogState.type}
      confirmText={dialogState.confirmText}
    />
  )

  return { showDialog, closeDialog, DialogComponent }
}
