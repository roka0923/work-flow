import React, { useState } from 'react';
import { X, Clock, AlertCircle, Trash2, CheckCircle, Split } from 'lucide-react';
import { getJobStage } from '../../utils/statusUtils';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Global cache for product data to avoid redundant fetches
const productDataCache = {};

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
    const [confirmQuantities, setConfirmQuantities] = useState({});

    // 모달 타겟이 변경될 때 수량 입력 초기화
    React.useEffect(() => {
        setConfirmQuantities({});
    }, [confirmTarget, batchConfirmTarget]);

    // Preload product info when selectedJob changes
    React.useEffect(() => {
        if (selectedJob && selectedJob.code) {
            const code = selectedJob.code;

            // If not in cache, fetch it in background
            if (!productDataCache[code]) {
                // We define a separate async function to not block effect
                const preload = async () => {
                    try {
                        const docRef = doc(db, 'products', code);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            if (data.이미지 && data.이미지.includes('dropbox.com')) {
                                data.이미지 = data.이미지.replace('dl=0', 'raw=1');
                            }
                            // Save to cache
                            productDataCache[code] = data;

                            // Measure: Preload image
                            if (data.이미지) {
                                const img = new Image();
                                img.src = data.이미지;
                            }
                        }
                    } catch (err) {
                        console.warn("Background preload failed:", err);
                    }
                };
                preload();
            } else {
                // If already in data cache BUT image might not be in browser cache, 
                // we can trigger image load again just in case (optional, but safe)
                const data = productDataCache[code];
                if (data.이미지) {
                    const img = new Image();
                    img.src = data.이미지;
                }
            }
        }
    }, [selectedJob]);

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

    const [productInfo, setProductInfo] = useState(null);
    const [loadingProduct, setLoadingProduct] = useState(false);

    const handleShowProductInfo = async (code) => {
        if (!code) return;

        // Check cache first
        if (productDataCache[code]) {
            setProductInfo(productDataCache[code]);
            return;
        }

        setLoadingProduct(true);
        try {
            const docRef = doc(db, 'products', code);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Dropbox 이미지 링크 변환 (dl=0 -> raw=1)
                if (data.이미지 && data.이미지.includes('dropbox.com')) {
                    data.이미지 = data.이미지.replace('dl=0', 'raw=1');
                }
                productDataCache[code] = data; // Save to cache
                setProductInfo(data);
            } else {
                alert('해당 품목의 상세 정보가 없습니다.');
            }
        } catch (error) {
            console.error("Error fetching product info:", error);
            alert('품목 정보를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoadingProduct(false);
        }
    };

    return (
        <>
            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => { setSelectedJob(null); setIsEditing(false); }}>
                    <div className="card modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>작업 상세 정보</h2>
                            </div>
                            <X size={28} onClick={() => { setSelectedJob(null); setIsEditing(false); }} className="cursor-pointer" />
                        </div>

                        {isEditing ? (
                            <div className="edit-form">
                                <FormItem label="모델명" value={editData.model} onChange={v => setEditData({ ...editData, model: v })} />
                                <FormItem label="지시번호" value={editData.code} onChange={v => setEditData({ ...editData, code: v })} />
                                <div className="flex-row">
                                    {editData.quantities && selectedJob.items ? (
                                        <div className="form-item">
                                            <label style={{ marginBottom: '8px', display: 'block' }}>수량 (개별 변경)</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--glass-bg)', padding: '10px', borderRadius: '8px' }}>
                                                {selectedJob.items
                                                    .slice()
                                                    .sort((a, b) => {
                                                        if (a.side === 'LH') return -1;
                                                        if (b.side === 'LH') return 1;
                                                        return 0;
                                                    })
                                                    .map(item => (
                                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{item.side}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <input
                                                                    type="number"
                                                                    className="input-field"
                                                                    style={{ width: '80px', textAlign: 'right' }}
                                                                    value={editData.quantities[item.id]}
                                                                    onChange={e => {
                                                                        const val = parseInt(e.target.value) || 0;
                                                                        setEditData({
                                                                            ...editData,
                                                                            quantities: {
                                                                                ...editData.quantities,
                                                                                [item.id]: val
                                                                            }
                                                                        });
                                                                    }}
                                                                />
                                                                <span style={{ fontSize: '13px' }}>개</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <FormItem label="수량" type="number" value={editData.quantity} onChange={v => setEditData({ ...editData, quantity: parseInt(v) || 1 })} />
                                    )}
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
                                            <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <h1 style={{ margin: 0 }}>{selectedJob.model}</h1>
                                                <button
                                                    onClick={() => handleShowProductInfo(selectedJob.code)}
                                                    className="btn-primary"
                                                    style={{
                                                        fontSize: '14px',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        height: '36px'
                                                    }}
                                                    disabled={loadingProduct}
                                                >
                                                    {loadingProduct ? '로딩중...' : <>📷 품목 정보</>}
                                                </button>
                                            </div>
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

            {/* Product Info Modal (New) */}
            {productInfo && (
                <div className="modal-overlay" onClick={() => setProductInfo(null)}>
                    <div className="card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>품목 상세 정보</h3>
                            <X size={24} onClick={() => setProductInfo(null)} className="cursor-pointer" />
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            {productInfo.이미지 ? (
                                <img
                                    src={productInfo.이미지}
                                    alt={productInfo.model}
                                    style={{
                                        maxWidth: '100%',
                                        borderRadius: '12px',
                                        border: '1px solid var(--glass-border)',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    padding: '60px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '12px',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <AlertCircle size={48} style={{ opacity: 0.5 }} />
                                    <span>이미지가 등록되지 않았습니다</span>
                                </div>
                            )}
                        </div>
                        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-item">
                                <label style={{ color: 'var(--primary)', fontWeight: '600' }}>하우징</label>
                                <div className="input-field disabled" style={{ fontSize: '16px', fontWeight: '500' }}>
                                    {productInfo.하우징 || '-'}
                                </div>
                            </div>
                            <div className="form-item">
                                <label style={{ color: 'var(--primary)', fontWeight: '600' }}>캐리어</label>
                                <div className="input-field disabled" style={{ fontSize: '16px', fontWeight: '500' }}>
                                    {productInfo.캐리어 || '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmTarget && (
                <div className="modal-overlay">
                    <div className="card modal-small" onClick={e => e.stopPropagation()}>
                        <h3>{confirmTarget.label} 확인</h3>
                        <p style={{ marginBottom: confirmTarget.stageKey === 'plating_release' ? '8px' : '16px' }}>
                            {confirmTarget.question}
                        </p>

                        {/* 도금출고 이동 시 수량 확인/수정 UI */}
                        {confirmTarget.stageKey === 'plating_release' && (
                            <div className="quantity-confirm-box" style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    최종 출고 수량을 확인(수정)해주세요.
                                </div>
                                {jobs.filter(j => confirmTarget.jobIds.includes(j.id))
                                    .sort((a, b) => {
                                        // LH 먼저 표시
                                        if (a.side === 'LH') return -1;
                                        if (b.side === 'LH') return 1;
                                        return 0;
                                    })
                                    .map(job => (
                                        <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '14px', flex: 1 }}>
                                                {job.model} {job.side && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{job.side}</span>}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <input
                                                    type="number"
                                                    value={confirmQuantities[job.id] !== undefined ? confirmQuantities[job.id] : (job.quantity || 1)}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setConfirmQuantities(prev => ({ ...prev, [job.id]: val }));
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="input-field"
                                                    style={{ width: '80px', textAlign: 'right', height: '32px' }}
                                                    min="1"
                                                />
                                                <span style={{ fontSize: '13px' }}>개</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}

                        <StaffSelector
                            selectedStaff={selectedStaff}
                            setSelectedStaff={setSelectedStaff}
                            staffNames={staffNames}
                        />
                        <div className="modal-actions">
                            <button onClick={() => { setConfirmTarget(null); setSelectedStaff(''); setConfirmQuantities({}); }} className="btn btn-secondary">취소</button>
                            <button
                                onClick={() => handleConfirmStatus(confirmQuantities)}
                                disabled={!selectedStaff}
                                className="btn btn-primary"
                            >
                                {confirmTarget.stageKey === 'plating_release' ? '수량 확정 및 이동' : '확인 완료'}
                            </button>
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
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: batchConfirmTarget.stageKey === 'plating_release' ? '8px' : '16px' }}>
                            {batchConfirmTarget.question}
                        </p>

                        {/* 일괄 처리 시에도 도금출고면 수량 수정 UI 표시 */}
                        {batchConfirmTarget.stageKey === 'plating_release' && (
                            <div className="quantity-confirm-box" style={{ marginBottom: '16px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    각 항목의 수량을 최종 확정해주세요.
                                </div>
                                {batchConfirmTarget.groups.flatMap(g => g.items).map(job => (
                                    <div key={job.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                                            <span style={{ fontSize: '14px' }}>
                                                {job.model} {job.side && <span style={{ color: 'var(--primary)' }}>{job.side}</span>}
                                            </span>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.code}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input
                                                type="number"
                                                value={confirmQuantities[job.id] !== undefined ? confirmQuantities[job.id] : (job.quantity || 1)}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setConfirmQuantities(prev => ({ ...prev, [job.id]: val }));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="input-field"
                                                style={{ width: '70px', textAlign: 'right', height: '30px' }}
                                                min="1"
                                            />
                                            <span style={{ fontSize: '12px' }}>개</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <StaffSelector selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} staffNames={staffNames} />
                        <div className="modal-actions">
                            <button onClick={() => { setBatchConfirmTarget(null); setSelectedStaff(''); setConfirmQuantities({}); }} className="btn btn-secondary">취소</button>
                            <button
                                onClick={() => handleBatchConfirmStatus(confirmQuantities)}
                                disabled={!selectedStaff}
                                className="btn btn-primary"
                            >
                                {batchConfirmTarget.stageKey === 'plating_release' ? '일괄 확정 및 이동' : '일괄 처리'}
                            </button>
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
                                <div className="stage">
                                    {h.stage === 'new_added'
                                        ? '신규추가'
                                        : `${stages.find(s => s.key === h.stage)?.label || h.stage} 완료`}
                                </div>
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
                                        onFocus={(e) => e.target.select()}
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
