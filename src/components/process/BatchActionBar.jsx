import React, { useState, useRef } from 'react';
import { ChevronRight, Copy, Check } from 'lucide-react';

export default function BatchActionBar({ selectedCount, onAction, pistonSummary }) {
    const [copied, setCopied] = useState(false);
    const longPressTimer = useRef(null);

    if (selectedCount === 0) return null;

    const handleCopy = () => {
        if (!pistonSummary) return;
        navigator.clipboard.writeText(pistonSummary).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const startPress = () => {
        longPressTimer.current = setTimeout(handleCopy, 600);
    };

    const cancelPress = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(34, 211, 238, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#000',
            padding: '16px 20px',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            width: 'calc(100% - 32px)',
            maxWidth: '550px',
            border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '15px' }}>{selectedCount}건 선택됨</span>
                {pistonSummary && (
                    <div
                        onPointerDown={startPress}
                        onPointerUp={cancelPress}
                        onPointerLeave={cancelPress}
                        onClick={handleCopy} // 길게 누르기 힘들 수 있으니 클릭도 지원
                        className="piston-summary-box"
                        style={{
                            fontSize: '12px',
                            background: 'rgba(0,0,0,0.08)',
                            padding: '6px 12px',
                            borderRadius: '10px',
                            fontWeight: '700',
                            maxWidth: '75%',
                            textAlign: 'right',
                            cursor: 'pointer',
                            transition: '0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: '1px solid transparent'
                        }}
                    >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pistonSummary.split('\n')[0]}{pistonSummary.split('\n').length > 1 ? '...' : ''}
                        </div>
                        {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </div>
                )}
            </div>
            {copied && (
                <div style={{ fontSize: '11px', color: '#059669', fontWeight: 'bold', marginTop: '-8px' }}>
                    클립보드에 복사되었습니다!
                </div>
            )}
            <button
                onClick={onAction}
                style={{
                    background: '#000',
                    color: 'var(--primary)',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%'
                }}
            >
                <ChevronRight size={18} />
                다음 단계로 이동 ({selectedCount}건)
            </button>
        </div>
    );
}
