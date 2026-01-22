import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function BatchActionBar({ selectedCount, onAction }) {
    if (selectedCount === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary)',
            color: '#000',
            padding: '12px 24px',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 20px rgba(34, 211, 238, 0.4)',
            zIndex: 1000
        }}>
            <span style={{ fontWeight: 'bold' }}>{selectedCount}건 선택됨</span>
            <button
                onClick={onAction}
                style={{
                    background: '#000',
                    color: 'var(--primary)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
            >
                <ChevronRight size={18} />
                다음 단계로 이동
            </button>
        </div>
    );
}
