import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

const ErrorState = ({ message = 'Something went wrong.', onRetry }) => (
  <div className="error-state">
    <div className="error-icon"><FiAlertTriangle /></div>
    <h4>Error</h4>
    <p>{message}</p>
    {onRetry && (
      <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

export default ErrorState;
