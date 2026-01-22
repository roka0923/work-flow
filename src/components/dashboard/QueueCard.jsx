import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function QueueCard({ stage, count, percentage, onClick }) {
    return (
        <div
            className="card"
            style={{
                padding: '16px',
                cursor: 'pointer',
                transition: '0.2s',
                border: '1px solid var(--glass-border)'
            }}
            onClick={onClick}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }}></div>
                    {stage.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold', color: count > 0 ? 'white' : 'var(--text-muted)' }}>{count}건</span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                </div>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                    style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: stage.color,
                        transition: 'width 0.5s ease-out'
                    }}
                />
            </div>
        </div>
    );
}
