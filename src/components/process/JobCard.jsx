import React, { useEffect } from 'react';
import { CheckCircle2, Circle, Clock, MessageSquare, Trash2, Square, CheckSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function JobCard({
    group,
    isSelected,
    onToggleSelection,
    onDelete,
    onDetailClick,
    onStageClick,
    stages
}) {
    const { canDelete } = useAuth();
    const items = group.items || [];
    const firstItem = items[0] || { status: {}, model: '정보 없음' };
    const isPair = items.length > 1;
    const jobIds = items.map(j => j.id);

    useEffect(() => {
        console.log('🎴 JobCard 렌더링:', {
            groupId: group.key || group.id,
            items: items.map(item => ({
                id: item.id,
                side: item.side,
                stage: item.stage,
                productNumber: item.productNumber
            }))
        });
    }, [group]);

    // 그룹 내 모든 아이템이 해당 단계를 완료했는지 확인
    const isStageDoneForGroup = (stageKey) => {
        if (items.length === 0) return false;
        return items.every(item => item.status && item.status[stageKey]);
    };

    // 이전 단계가 그룹 전체에 대해 완료되었는지 확인 (체크 가능 여부)
    const canCheckStageForGroup = (index) => {
        if (index === 0) return true;
        const prevStageKey = stages[index - 1].key;
        return isStageDoneForGroup(prevStageKey);
    };

    return (
        <div
            className={`card ${group.urgent ? 'urgent-card' : ''}`}
            style={{
                position: 'relative',
                padding: '20px',
                border: isSelected ? '2px solid var(--primary)' : undefined,
                background: isSelected ? 'rgba(34, 211, 238, 0.05)' : undefined
            }}
        >
            <div style={{ display: 'flex', gap: '12px' }}>
                {/* Checkbox */}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggleSelection(group.key); }}
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        paddingTop: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isSelected ? (
                        <CheckSquare size={24} color="var(--primary)" />
                    ) : (
                        <Square size={24} color="var(--text-muted)" />
                    )}
                </div>

                <div style={{ flex: 1 }}>
                    <div onClick={() => onDetailClick(firstItem)} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 'bold' }}>{group.code}</span>
                                    {group.urgent && (
                                        <span style={{ background: 'var(--danger)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>긴급</span>
                                    )}
                                </div>
                                <h3 style={{ margin: '6px 0', fontSize: '18px' }}>
                                    {isPair ? group.base : firstItem.model} {isPair && <span style={{ fontSize: '13px', color: 'var(--primary)', marginLeft: '8px' }}>(L+R 세트)</span>}
                                </h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        {group.requestDate ? new Date(group.requestDate).toLocaleString() : '날짜 정보 없음'}
                                    </div>
                                    {group.memo && (
                                        <div style={{
                                            marginTop: '8px',
                                            padding: '8px 12px',
                                            background: 'rgba(34, 211, 238, 0.08)',
                                            borderLeft: '3px solid var(--primary)',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: 'var(--text-main)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            maxWidth: 'fit-content'
                                        }}>
                                            <MessageSquare size={14} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                            <span style={{ fontWeight: '500' }}>{group.memo}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {canDelete && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete({ ids: jobIds, model: isPair ? group.base : firstItem.model });
                                        }}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--danger)', padding: '8px', borderRadius: '8px' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Unified Progress Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', height: '60px', marginTop: '10px' }}>
                        <div style={{
                            position: 'absolute',
                            top: '18px',
                            left: '10%',
                            right: '10%',
                            height: '2px',
                            background: 'rgba(255,255,255,0.1)',
                            zIndex: 0
                        }} />

                        {stages.map((stage, index) => {
                            const isDone = isStageDoneForGroup(stage.key);
                            const canCheck = canCheckStageForGroup(index);

                            return (
                                <div
                                    key={stage.key}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '6px',
                                        flex: 1,
                                        zIndex: 1,
                                        opacity: canCheck ? 1 : 0.4
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStageClick(firstItem.id, stage.key);
                                    }}
                                >
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        background: isDone ? 'var(--primary)' : 'var(--glass-bg)',
                                        border: `2px solid ${isDone ? 'var(--primary)' : 'var(--glass-border)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isDone ? '#000' : 'var(--text-muted)',
                                        transition: '0.2s',
                                        cursor: canCheck ? 'pointer' : 'default',
                                        boxShadow: isDone ? '0 0 10px var(--primary-glow)' : 'none'
                                    }}>
                                        {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                    </div>
                                    <span style={{
                                        fontSize: '9px',
                                        fontWeight: '600',
                                        color: isDone ? 'var(--primary)' : 'var(--text-muted)',
                                        textAlign: 'center'
                                    }}>
                                        {stage.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
