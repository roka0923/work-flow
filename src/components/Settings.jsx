import { Trash2, Info, Database, Github, ExternalLink, X, AlertTriangle, RotateCcw, Archive, ChevronDown, ChevronUp, Package, Upload, CheckCircle2 } from 'lucide-react';
import { ref, set, update } from 'firebase/database';
import { rtdb } from '../firebase/config';
import itemData from '../data/items.json';
import versionInfo from '../config/version.json';

export default function Settings({ onResetData, jobsCount, staffNames, setStaffNames, deletedJobs = [], onRestoreJob, onPermanentDelete, onClearTrash }) {
    const [confirmConfig, setConfirmConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        action: null,
        confirmText: '',
        type: 'danger'
    });
    const [newStaffName, setNewStaffName] = useState('');
    const [isStaffExpanded, setIsStaffExpanded] = useState(false);
    const [isTrashExpanded, setIsTrashExpanded] = useState(false);
    const [isProductExpanded, setIsProductExpanded] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, isUploading: false, status: '' });

    const openConfirm = (title, message, action, confirmText = '확인', type = 'danger') => {
        setConfirmConfig({ isOpen: true, title, message, action, confirmText, type });
    };

    const handleConfirm = () => {
        if (confirmConfig.action) confirmConfig.action();
        setConfirmConfig({ ...confirmConfig, isOpen: false });
    };

    const addStaff = () => {
        if (newStaffName.trim() && !staffNames.includes(newStaffName.trim())) {
            setStaffNames([...staffNames, newStaffName.trim()]);
            setNewStaffName('');
        }
    };

    const removeStaff = (name) => {
        setStaffNames(staffNames.filter(s => s !== name));
    };

    const handleProductMigration = async () => {
        if (uploadProgress.isUploading) return;

        setUploadProgress({ current: 0, total: itemData.length, isUploading: true, status: '마이그레이션 시작...' });

        try {
            const batchSize = 100;
            const total = itemData.length;

            for (let i = 0; i < total; i += batchSize) {
                const batch = itemData.slice(i, i + batchSize);
                const updates = {};

                batch.forEach(item => {
                    // Use code as the key for efficient lookup if it's unique enough, 
                    // or just push if not. Here code seems to be 5-digit unique ID.
                    updates[`/products/${item.code}`] = {
                        code: item.code,
                        model: item.model,
                        updatedAt: new Date().toISOString()
                    };
                });

                await update(ref(rtdb), updates);
                const currentProgress = Math.min(i + batchSize, total);
                setUploadProgress(prev => ({ ...prev, current: currentProgress, status: `${currentProgress} / ${total} 완료` }));
            }

            setUploadProgress(prev => ({ ...prev, isUploading: false, status: '업로드 완료!' }));
            setTimeout(() => setUploadProgress({ current: 0, total: 0, isUploading: false, status: '' }), 3000);
        } catch (error) {
            console.error('Migration failed:', error);
            setUploadProgress(prev => ({ ...prev, isUploading: false, status: '오류 발생: ' + error.message }));
        }
    };

    return (
        <div className="animate-fade-in">
            <h1>설정</h1>

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Database size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>데이터 관리</h3>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '14px' }}>현재 저장된 작업</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>로컬 스토리지 데이터</div>
                    </div>
                    <div style={{ fontWeight: 'bold' }}>{jobsCount}건</div>
                </div>

                <button
                    onClick={() => openConfirm(
                        '데이터 초기화',
                        '모든 작업 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
                        onResetData,
                        '초기화 실행'
                    )}
                    className="btn btn-secondary btn-full"
                    style={{
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                        background: 'rgba(239, 68, 68, 0.05)'
                    }}
                >
                    <Trash2 size={18} />
                    데이터 초기화
                </button>
            </div>

            {/* Employee Management Section */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                    onClick={() => setIsStaffExpanded(!isStaffExpanded)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        cursor: 'pointer',
                        background: isStaffExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                            <Info size={14} />
                        </div>
                        <h3 style={{ margin: 0 }}>직원 등록 및 관리</h3>
                    </div>
                    {isStaffExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                </div>

                {isStaffExpanded && (
                    <div className="animate-fade-in" style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', marginTop: '16px' }}>
                            <input
                                type="text"
                                value={newStaffName}
                                onChange={(e) => setNewStaffName(e.target.value)}
                                placeholder="직원 이름"
                                style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white' }}
                                onKeyPress={(e) => e.key === 'Enter' && addStaff()}
                            />
                            <button
                                onClick={addStaff}
                                className="btn btn-primary"
                                style={{ padding: '0 20px', whiteSpace: 'nowrap' }}
                            >
                                등록
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {staffNames.map(name => (
                                <div
                                    key={name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '20px',
                                        fontSize: '14px'
                                    }}
                                >
                                    {name}
                                    <X
                                        size={14}
                                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                                        onClick={() => removeStaff(name)}
                                    />
                                </div>
                            ))}
                            {staffNames.length === 0 && (
                                <div style={{ width: '100%', textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    등록된 직원이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Product Database Management */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                    onClick={() => setIsProductExpanded(!isProductExpanded)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        cursor: 'pointer',
                        background: isProductExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                            <Package size={14} />
                        </div>
                        <h3 style={{ margin: 0 }}>품목 데이터베이스 관리</h3>
                    </div>
                    {isProductExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                </div>

                {isProductExpanded && (
                    <div className="animate-fade-in" style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '8px' }}>데이터베이스 마이그레이션</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '16px' }}>
                                로컬 `items.json` 파일의 품목 데이터({itemData.length}건)를 Firebase 실시간 데이터베이스로 업로드합니다.
                                기존에 동일한 코드가 있는 경우 새로운 데이터로 업데이트됩니다.
                            </div>

                            {!uploadProgress.isUploading && uploadProgress.status !== '업로드 완료!' ? (
                                <button
                                    onClick={() => openConfirm(
                                        '품목 데이터 업로드',
                                        `총 ${itemData.length}건의 품목 데이터를 Firebase로 전송하시겠습니까?\n이 작업은 몇 초 정도 소요될 수 있습니다.`,
                                        handleProductMigration,
                                        '업로드 시작',
                                        'primary'
                                    )}
                                    className="btn btn-primary btn-full"
                                >
                                    <Upload size={18} />
                                    데이터베이스로 업로드 시작
                                </button>
                            ) : (
                                <div style={{
                                    padding: '16px',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--glass-border)',
                                    textAlign: 'center'
                                }}>
                                    {uploadProgress.status === '업로드 완료!' ? (
                                        <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <CheckCircle2 size={20} />
                                            <span>{uploadProgress.status}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '14px', marginBottom: '12px' }}>{uploadProgress.status}</div>
                                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                                                    height: '100%',
                                                    background: 'var(--primary)',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Trash Bin Section */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                    onClick={() => setIsTrashExpanded(!isTrashExpanded)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        cursor: 'pointer',
                        background: isTrashExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background 0.2s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Archive size={20} color="#94a3b8" />
                        <h3 style={{ margin: 0 }}>휴지통</h3>
                        <div style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)' }}>
                            {deletedJobs.length}건
                        </div>
                    </div>
                    {isTrashExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                </div>

                {isTrashExpanded && (
                    <div className="animate-fade-in" style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                삭제된 작업은 여기에 10일 동안 보관됩니다.
                            </div>
                            {deletedJobs.length > 0 && (
                                <button
                                    onClick={() => openConfirm(
                                        '휴지통 비우기',
                                        '휴지통의 모든 항목을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
                                        onClearTrash,
                                        '전체 비우기'
                                    )}
                                    style={{
                                        fontSize: '11px',
                                        color: 'var(--danger)',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: 'none',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    전체 비우기
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {deletedJobs.map(job => (
                                <div
                                    key={job.id}
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{job.model}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            코드: {job.code} • 삭제일: {new Date(job.deletedAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => openConfirm(
                                                '작업 복원',
                                                `[${job.model}] 작업을 공정 목록으로 복원하시겠습니까?`,
                                                () => onRestoreJob(job.id),
                                                '복원하기',
                                                'primary'
                                            )}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                                            title="복원"
                                        >
                                            <RotateCcw size={16} />
                                        </button>
                                        <button
                                            onClick={() => openConfirm(
                                                '영구 삭제',
                                                `[${job.model}] 작업을 영구 삭제하시겠습니까?\n복구할 수 없습니다.`,
                                                () => onPermanentDelete(job.id),
                                                '삭제하기'
                                            )}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}
                                            title="영구 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {deletedJobs.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '14px', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
                                    휴지통이 비어 있습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Global Confirm Modal */}
            {confirmConfig.isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                        padding: '20px'
                    }}
                    onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                >
                    <div
                        className="card"
                        style={{
                            maxWidth: '400px', width: '100%',
                            border: `1px solid ${confirmConfig.type === 'danger' ? 'var(--danger)' : 'var(--primary)'}`,
                            padding: '24px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '50%',
                                background: confirmConfig.type === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 211, 238, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                {confirmConfig.type === 'danger' ?
                                    <AlertTriangle size={32} color="var(--danger)" /> :
                                    <RotateCcw size={32} color="var(--primary)" />
                                }
                            </div>
                            <h3 style={{ margin: '0 0 8px' }}>{confirmConfig.title}</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-line' }}>
                                {confirmConfig.message}
                            </p>
                        </div>

                        <div className="modal-actions" style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`btn btn-${confirmConfig.type === 'danger' ? 'danger' : 'primary'}`}
                                style={{ flex: 1 }}
                            >
                                {confirmConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Info size={20} color="var(--secondary)" />
                    <h3 style={{ margin: 0 }}>앱 정보</h3>
                </div>

                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>앱 버전</span>
                        <span>v{versionInfo.version} (Stable)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>데이터 동기화</span>
                        <span style={{ color: 'var(--success)' }}>동기화 완료</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>최종 업데이트</span>
                        <span>{versionInfo.lastUpdated}</span>
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px' }}
                    >
                        <Github size={16} />
                        GitHub 저장소 방문
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Daehansa Caliper Flow</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>© 2024 Antigravity AI. All rights reserved.</div>
            </div>
        </div>
    );
}
