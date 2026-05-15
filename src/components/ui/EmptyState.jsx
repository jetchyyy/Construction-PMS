import React from 'react';
import { FiInbox } from 'react-icons/fi';

const EmptyState = ({ icon, title = 'No data found', description = 'There are no records to display.', action }) => (
  <div className="empty-state">
    <div className="empty-icon">{icon || <FiInbox />}</div>
    <h4>{title}</h4>
    <p>{description}</p>
    {action && <div style={{ marginTop: '16px' }}>{action}</div>}
  </div>
);

export default EmptyState;
