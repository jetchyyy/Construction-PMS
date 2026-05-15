import React from 'react';

export const SkeletonLine = ({ width = '100%', height = '14px', style }) => (
  <div className="skeleton" style={{ width, height, ...style }} />
);

export const SkeletonCard = () => (
  <div className="kpi-card kpi-skeleton">
    <SkeletonLine width="44px" height="44px" style={{ borderRadius: '10px', marginBottom: '16px' }} />
    <SkeletonLine width="60px" height="28px" style={{ marginBottom: '8px' }} />
    <SkeletonLine width="100px" height="14px" />
  </div>
);

export const SkeletonTableRow = ({ cols = 4 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '14px 16px' }}>
        <SkeletonLine width={i === 0 ? '70%' : '50%'} height="14px" />
      </td>
    ))}
  </tr>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} cols={cols} />
    ))}
  </>
);
