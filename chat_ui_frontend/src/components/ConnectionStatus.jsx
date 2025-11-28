import React from 'react';

/**
 * PUBLIC_INTERFACE
 * ConnectionStatus shows the current websocket status and provides a reconnect action when applicable.
 * Props:
 * - status: 'connecting' | 'connected' | 'disconnected' | 'error'
 * - onReconnect: function to request reconnect
 */
export default function ConnectionStatus({ status, onReconnect }) {
  const map = {
    connecting: { label: 'Connecting', cls: 'connecting', tip: 'Attempting to connect…' },
    connected: { label: 'Connected', cls: 'connected', tip: 'You are online.' },
    disconnected: { label: 'Disconnected', cls: 'disconnected', tip: 'No connection.' },
    error: { label: 'Error', cls: 'error', tip: 'A connection error occurred.' },
  };
  const data = map[status] || map.disconnected;

  return (
    <div className="row">
      <div className={`badge ${data.cls} tooltip`} data-tip={data.tip} aria-live="polite">
        {data.label}
      </div>
      {(status === 'error' || status === 'disconnected') && (
        <button
          className="reconnect-btn"
          onClick={onReconnect}
          aria-label="Reconnect"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
