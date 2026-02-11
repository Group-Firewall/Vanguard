import React, { useState } from 'react'
import TestDataButton from './TestDataButton'

/**
 * Shown when there is no live data yet. Encourages starting capture for real data;
 * all dashboard metrics and alerts come from the backend (stored from capture).
 * Test data is optional and de-emphasized (dev only).
 */
function CaptureEmptyState() {
  const [showDevOptions, setShowDevOptions] = useState(false)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-blue-900">Use real data from capture</h3>
          <p className="text-sm text-blue-800 mt-1">
            No live data yet. Click <strong>Start Capture</strong> in the header to collect real network traffic.
            Packets are processed by the backend (feature extraction → ML detection → alerts), and metrics and
            alerts are stored in the database and shown here.
          </p>
          <button
            type="button"
            onClick={() => setShowDevOptions(!showDevOptions)}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showDevOptions ? 'Hide' : 'Show'} development option (test data)
          </button>
          {showDevOptions && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <TestDataButton />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CaptureEmptyState
