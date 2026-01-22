import React from 'react';

export default function StatCard({ icon: Icon, label, value, color, onClick, isUrgent }) {
    return (
        <div
            className="card"
            style={{
                padding: '16px 12px',
                textAlign: 'center',
                cursor: onClick ? 'pointer' : 'default',
                transition: '0.2s',
                border: isUrgent ? '1px solid var(--danger)' : '1px solid var(--glass-border)'
            }}
            onClick={onClick}
            onMouseOver={(e) => {
                if (onClick) e.currentTarget.style.borderColor = color || 'var(--primary)';
            }}
            onMouseOut={(e) => {
                if (onClick) e.currentTarget.style.borderColor = isUrgent ? 'var(--danger)' : 'var(--glass-border)';
            }}
        >
            <Icon size={20} color={color} style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isUrgent ? 'var(--danger)' : 'white' }}>{value}</div>
        </div>
    );
}
