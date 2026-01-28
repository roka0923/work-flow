import React, { useState } from 'react';
import { X, Clock, AlertCircle, Trash2, CheckCircle, Split } from 'lucide-react';
import { getJobStage } from '../../utils/statusUtils';
import { useAuth } from '../../contexts/AuthContext';

export default function ProcessModals({
    selectedJob, setSelectedJob,
    isEditing, setIsEditing,
    editData, setEditData,
    saveEdit,
    startEdit,
    confirmTarget, setConfirmTarget,
    selectedStaff, setSelectedStaff,
    handleConfirmStatus,
    staffNames,
    batchConfirmTarget, setBatchConfirmTarget,
    handleBatchConfirmStatus,
    deleteTarget, setDeleteTarget,
    handleDelete,
    stages,
    onDirectComplete,
    onSendToAssemblyWait,
    isReadOnly,
    onSplitJob,
    getNextStage,
    jobs
}) {
    const [splitTarget, setSplitTarget] = useState(null);

    const handleSplitConfirm = (quantities, nextStage, staffName) => {
        if (splitTarget && onSplitJob) {
            // Group handling: Pass all IDs involved in the split
            // If splitTarget has items (prepared in openSplitModal), use them.
            // quantities is a map { [id]: qty }
            // We need to pass the list of IDs that have quantities to move.
            // Or just pass all IDs in the group, and let splitAndMoveJob handle 0 qty (which it does).

            const targetIds = splitTarget.items ? splitTarget.items.map(i => i.id) : [splitTarget.id];

            onSplitJob(targetIds, quantities, nextStage, staffName);
            setSplitTarget(null);
            setSelectedJob(null);
        }
    };

    const openSplitModal = (job) => {
        // Determine default next stage
        const next = getNextStage(job);

        let groupItems = [job];
        if (job.groupId && jobs) {
            const found = jobs.filter(j => j.groupId === job.groupId);
            if (found.length > 0) groupItems = found;
        }

        setSplitTarget({
            ...job,
            items: groupItems,
            defaultNextStage: next ? next.key : ''
        });
    };

    return (
        <>
            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="card modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>작업 상세 정보</h2>
                            <X size={28} onClick={() => setSelectedJob(null)} className="cursor-pointer" />
                        </div>

                        {isEditing ? (
                            <div className="edit-form">
                                <FormItem label="모델명" value={editData.model} onChange={v => setEditData({ ...editData, model: v })} />
                                <FormItem label="지시번호" value={editData.code} onChange={v => setEditData({ ...editData, code: v })} />
                                <div className="flex-row">
                                    <FormItem label="수량" type="number" value={editData.quantity} onChange={v => setEditData({ ...editData, quantity: parseInt(v) || 1 })} />
                                    <UrgentToggle urgent={editData.urgent} onClick={() => setEditData({ ...editData, urgent: !editData.urgent })} />
                                </div>
                                <FormItem label="메모/코멘트" type="textarea" value={editData.memo} onChange={v => setEditData({ ...editData, memo: v })} />
                                <div className="modal-actions">
                                    <button onClick={() => setIsEditing(false)} className="btn btn-secondary">취소</button>
                                    <button onClick={saveEdit} className="btn btn-primary">저장</button>
                                </div>
                            </div>
                        ) : (
                            <div className="detail-view">
                                <div className="detail-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div className="code">{selectedJob.code}</div>
                                            <h1>{selectedJob.model}</h1>
                                        </div>
                                        {!isReadOnly && <button onClick={() => startEdit(selectedJob)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>편집</button>}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div className="badge" style={{ fontSize: '15px', padding: '6px 12px' }}>수량: {selectedJob.quantity || 1}개</div>
                                        {selectedJob.urgent && <div className="badge badge-urgent" style={{ fontSize: '15px', padding: '6px 12px' }}><AlertCircle size={14} style={{ marginRight: '4px' }} /> 긴급</div>}
                                        {!isReadOnly && (selectedJob.currentStage === 'new_added' || getJobStage(selectedJob) === 'new_added') && (
                                            <>
                                                <button
                                                    onClick={() => onSendToAssemblyWait(selectedJob)}
                                                    className="badge cursor-pointer"
                                                    style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#0e7490', color: 'white', fontSize: '15px', fontWeight: '600' }}
                                                >
                                                    <Clock size={16} /> 조립대기로
                                                </button>
                                                <button
                                                    onClick={() => onDirectComplete(selectedJob)}
                                                    className="badge badge-success cursor-pointer"
                                                    style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '15px', fontWeight: '600' }}
                                                >
                                                    <CheckCircle size={16} /> 바로 완료
                                                </button>
                                            </>
                                        )}
                                        {/* Partial Move Button - Show for all active stages except complete */}
                                        {!isReadOnly && !selectedJob.status?.complete && (selectedJob.quantity >= 1) && (
                                            <button
                                                onClick={() => openSplitModal(selectedJob)}
                                                className="badge cursor-pointer"
                                                style={{ border: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#6366f1', color: 'white', fontSize: '15px', fontWeight: '600' }}
                                            >
                                                <Split size={16} /> 부분 이동
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="memo-box">
                                    <div className="label">메모/코멘트</div>
                                    <div className="content">{selectedJob.memo || '코멘트가 없습니다.'}</div>
                                </div>
                                <HistoryList history={selectedJob.history} stages={stages} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmTarget && (
                <div className="modal-overlay">
                    <div className="card modal-small" onClick={e => e.stopPropagation()}>
                        <h3>{confirmTarget.label} 확인</h3>
                        <p>{confirmTarget.question}</p>
                        <StaffSelector
                            selectedStaff={selectedStaff}
                            setSelectedStaff={setSelectedStaff}
                            staffNames={staffNames}
                        />
                        <div className="modal-actions">
                            <button onClick={() => { setConfirmTarget(null); setSelectedStaff(''); }} className="btn btn-secondary">취소</button>
                            <button onClick={handleConfirmStatus} disabled={!selectedStaff} className="btn btn-primary">확인 완료</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Confirm Modal */}
            {batchConfirmTarget && (
                <div className="modal-overlay">
                    <div className="card modal-small" onClick={e => e.stopPropagation()}>
                        <h3>일괄 처리: {batchConfirmTarget.label}</h3>
                        <p style={{ marginBottom: '4px' }}><strong>{batchConfirmTarget.count}건</strong>의 작업을 이동합니다.</p>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>{batchConfirmTarget.question}</p>
                        <StaffSelector selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} staffNames={staffNames} />
                        <div className="modal-actions">
                            <button onClick={() => { setBatchConfirmTarget(null); setSelectedStaff(''); }} className="btn btn-secondary">취소</button>
                            <button onClick={handleBatchConfirmStatus} disabled={!selectedStaff} className="btn btn-primary">일괄 처리</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteTarget && (
                <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="card modal-small border-danger" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="delete-icon"><Trash2 size={30} color="var(--danger)" /></div>
                            <h3>작업 삭제</h3>
                            <p><strong>{deleteTarget.model}</strong> 작업을 삭제하시겠습니까?</p>
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setDeleteTarget(null)} className="btn btn-secondary">취소</button>
                            <button onClick={handleDelete} className="btn btn-danger">삭제하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Split Modal */}
            {splitTarget && (
                <SplitModal
                    job={splitTarget}
                    onClose={() => setSplitTarget(null)}
                    onConfirm={handleSplitConfirm}
                    stages={stages}
                    staffNames={staffNames}
                    initialStaff={selectedStaff}
                />
            )}
        </>
    );
}

// Internal Sub-components for Modals
function FormItem({ label, value, onChange, type = 'text' }) {
    return (
        <div className="form-item">
            <label>{label}</label>
            {type === 'textarea' ? (
                <textarea className="input-field" value={value} onChange={e => onChange(e.target.value)} />
            ) : (
                <input type={type} className="input-field" value={value} onChange={e => onChange(e.target.value)} />
            )}
        </div>
    );
}

function UrgentToggle({ urgent, onClick }) {
    return (
        <div className="form-item flex-1">
            <label style={{ marginBottom: '8px', display: 'block' }}>긴급 여부</label>
            <button
                type="button"
                onClick={onClick}
                className={`btn ${urgent ? 'btn-danger' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'center', opacity: urgent ? 1 : 0.7 }}
            >
                <AlertCircle size={18} style={{ marginRight: '6px' }} />
                {urgent ? '긴급 (ON)' : '일반 (OFF)'}
            </button>
        </div>
    );
}

function StaffSelector({ selectedStaff, setSelectedStaff, staffNames }) {
    return (
        <div className="staff-selector">
            <label>체크 담당자</label>
            <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                <option value="">담당자를 선택하세요</option>
                {staffNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
    );
}

function HistoryList({ history, stages }) {
    return (
        <div className="history-section">
            <h3><Clock size={18} color="var(--primary)" /> 작업 이력</h3>
            <div className="history-list">
                {history?.length > 0 ? (
                    history.map((h, i) => (
                        <div key={i} className="history-item">
                            <div className="timeline-line"><div className="timeline-dot"></div></div>
                            <div className="history-content">
                                <div className="stage">{stages.find(s => s.key === h.stage)?.label} 완료</div>
                                <div className="meta">{h.staffName} • {new Date(h.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-history">작업 이력이 없습니다.</div>
                )}
            </div>
        </div>
    );
}

function SplitModal({ job, onClose, onConfirm, stages, staffNames, initialStaff }) {
    if (!job) return null;

    const isGroup = Array.isArray(job.items) && job.items.length > 1;
    const items = isGroup ? job.items : [job];

    // Initialize quantities (key: jobId, value: default 1 or 0)
    const [quantities, setQuantities] = useState(() => {
        const initial = {};
        try {
            if (Array.isArray(items)) {
                items.forEach(item => {
                    if (item && item.id) {
                        initial[item.id] = 1;
                    }
                });
            }
        } catch (e) {
            console.error("Error initializing quantities:", e);
        }
        return initial;
    });

    const [targetStage, setTargetStage] = useState(job.defaultNextStage);
    const [staff, setStaff] = useState(initialStaff || '');

    const handleQtyChange = (id, val, max) => {
        const num = parseInt(val) || 0;
        const safeNum = Math.min(max, Math.max(0, num));
        setQuantities(prev => ({ ...prev, [id]: safeNum }));
    };

    const getTotalMoveCount = () => Object.values(quantities).reduce((a, b) => a + b, 0);

    return (
        <div className="modal-overlay">
            <div className="card modal-small" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>부분 이동 (공정 분할)</h3>
                    <X size={24} onClick={onClose} className="cursor-pointer" />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <p style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>
                        {isGroup ? '그룹(세트) 내 각 항목별로 이동할 수량을 입력하세요.' : '다음 공정으로 이동할 수량을 입력하세요.'}
                    </p>
                </div>

                <div className="form-item">
                    <label>이동할 수량</label>
                    {items.map(item => {
                        const maxQty = item.quantity || 1;
                        const currentQty = quantities[item.id] !== undefined ? quantities[item.id] : 0;
                        const sideLabel = item.side ? `(${item.side})` : '';

                        return (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', background: 'var(--glass-bg)', padding: '8px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '14px' }}>
                                    {item.model || job.model} <span style={{ color: 'var(--primary)' }}>{sideLabel}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                        (잔여: {maxQty}개)
                                    </span>
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        className="input-field"
                                        style={{ width: '80px', textAlign: 'right' }}
                                        min="0"
                                        max={maxQty}
                                        value={currentQty}
                                        onChange={e => handleQtyChange(item.id, e.target.value, maxQty)}
                                    />
                                    <span style={{ fontSize: '13px' }}>개 이동</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="staff-selector" style={{ marginTop: '12px' }}>
                    <label>이동 대상 공정</label>
                    <select value={targetStage} onChange={e => setTargetStage(e.target.value)} className="input-field">
                        <option value="">공정 선택</option>
                        {stages.map(s => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                    </select>
                </div>

                <StaffSelector selectedStaff={staff} setSelectedStaff={setStaff} staffNames={staffNames} />

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary">취소</button>
                    <button
                        onClick={() => onConfirm(quantities, targetStage, staff)}
                        disabled={!staff || !targetStage || getTotalMoveCount() < 1}
                        className="btn btn-primary"
                    >
                        이동 확인
                    </button>
                </div>
            </div>
        </div>
    );
}
