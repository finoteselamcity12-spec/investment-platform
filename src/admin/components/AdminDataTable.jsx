export default function AdminDataTable({ title, subtitle, columns, rows, emptyMessage }) {
  const safeRows = Array.isArray(rows) ? rows : []
  const safeColumns = Array.isArray(columns) ? columns : []

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <h3>{title}</h3>
        {subtitle && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>{subtitle}</p>}
      </div>
      <div className="admin-table-wrap">
        {safeRows.length === 0 ? (
          <p className="admin-empty">{emptyMessage}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {safeColumns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>{safeRows}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
