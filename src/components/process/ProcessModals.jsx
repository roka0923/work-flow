import React from 'react';
import { X, Clock, AlertCircle, Trash2 } from 'lucide-react';

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
    stages
}) {
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
                                    <div className="code">{selectedJob.code}</div>
                                    <h1>{selectedJob.model}</h1>
                                    <button onClick={() => startEdit(selectedJob)} className="btn btn-secondary">편집</button>
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
            <label>긴급 여부</label>
            <div onClick={onClick} className={`urgent-btn ${urgent ? 'active' : ''}`}>
                <AlertCircle size={18} /> <span>긴급</span>
            </div>
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
