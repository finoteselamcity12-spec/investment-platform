export default function AdminDataTable({ title, subtitle, columns, rows, emptyMessage }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <h3>{title}</h3>
        {subtitle && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>{subtitle}</p>}
      </div>
      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <p className="admin-empty">{emptyMessage}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
