import React, { useState, useEffect } from 'react';
import { Trash2, Info, Database, Github, ExternalLink, X, AlertTriangle, RotateCcw, Archive, ChevronDown, ChevronUp, Package, Upload, CheckCircle2, Link as LinkIcon, RefreshCw, Activity } from 'lucide-react';
import { ref, update, get, remove, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import versionInfo from '../config/version.json';
import { debugFirebaseStructure } from '../utils/debugFirebase';

export default function Settings({ onResetData, jobsCount, deletedJobs = [], onRestoreJob, onPermanentDelete, onClearTrash }) {
    const [confirmConfig, setConfirmConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        action: null,
        confirmText: '',
        type: 'danger'
    });
    const [isTrashExpanded, setIsTrashExpanded] = useState(false);
    const [isProductExpanded, setIsProductExpanded] = useState(false);

    // Google Sheets Sync States
    const [sheetsUrl, setSheetsUrl] = useState(localStorage.getItem('sheetsUrl') || '');
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState(false);
    const [productsCount, setProductsCount] = useState(undefined);

    const openConfirm = (title, message, action, confirmText = '확인', type = 'danger') => {
        setConfirmConfig({ isOpen: true, title, message, action, confirmText, type });
    };

    const handleConfirm = () => {
        if (confirmConfig.action) confirmConfig.action();
        setConfirmConfig({ ...confirmConfig, isOpen: false });
    };


    // Google Sheets Sync Logic
    useEffect(() => {
        const fetchProductsCount = async () => {
            try {
                const productsRef = ref(rtdb, 'products');
                const snapshot = await get(productsRef);
                if (snapshot.exists()) {
                    setProductsCount(Object.keys(snapshot.val()).length);
                } else {
                    setProductsCount(0);
                }
            } catch (err) {
                console.error("Error fetching products count:", err);
            }
        };
        fetchProductsCount();
    }, [syncMessage]);

    const handleSyncFromSheets = async () => {
        if (!sheetsUrl) {
            setSyncMessage('Google Sheets URL을 입력해주세요');
            setSyncError(true);
            return;
        }

        setSyncing(true);
        setSyncError(false);
        setSyncMessage('');

        try {
            // 1. URL Storage
            localStorage.setItem('sheetsUrl', sheetsUrl);

            // 2. CSV Download
            setSyncProgress('데이터 다운로드 중...');
            const response = await fetch(sheetsUrl);

            if (!response.ok) {
                throw new Error('Google Sheets 데이터를 가져올 수 없습니다. URL을 확인하고 "웹에 게시"가 활성화되어 있는지 확인하세요.');
            }

            const csvText = await response.text();

            // 3. CSV Parsing
            setSyncProgress('데이터 파싱 중...');
            const lines = csvText.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                throw new Error('데이터가 비어있습니다 (헤더 제외 최소 1줄 필요)');
            }

            // Headers parsing
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

            // Column mapping (Compatible with existing code/model pattern)
            const numberIndex = headers.findIndex(h =>
                h.includes('품목번호') || h.toLowerCase().includes('number') || h.includes('코드')
            );
            const nameIndex = headers.findIndex(h =>
                h.includes('품목명') || h.toLowerCase().includes('name') || h.includes('모델')
            );
            const categoryIndex = headers.findIndex(h =>
                h.includes('카테고리') || h.toLowerCase().includes('category')
            );

            if (numberIndex === -1 || nameIndex === -1) {
                throw new Error('필수 열이 없습니다. "품목번호"와 "품목명" 열이 필요합니다.');
            }

            // 4. Transform Data
            const products = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

                if (values[numberIndex] && values[nameIndex]) {
                    products.push({
                        code: values[numberIndex],
                        model: values[nameIndex],
                        category: categoryIndex !== -1 ? (values[categoryIndex] || '') : '',
                        updatedAt: new Date().toISOString()
                    });
                }
            }

            if (products.length === 0) {
                throw new Error('유효한 데이터가 없습니다');
            }

            // 5. Firebase Upload (Batch)
            const batchSize = 500;
            const productsRef = ref(rtdb, 'products');

            // Delete existing products
            setSyncProgress('기존 데이터 삭제 중...');
            await remove(productsRef);

            // Upload new products
            for (let i = 0; i < products.length; i += batchSize) {
                const batch = products.slice(i, i + batchSize);
                const updates = {};

                batch.forEach(product => {
                    // Use product code as key for faster lookup
                    updates[`/products/${product.code}`] = product;
                });

                await update(ref(rtdb), updates);
                setSyncProgress(`업로드 중: ${Math.min(i + batchSize, products.length)}/${products.length}`);

                // Prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            setSyncMessage(`✅ 동기화 완료! ${products.length}개 품목이 업데이트되었습니다.`);
            setSyncError(false);

        } catch (error) {
            console.error('Sync failed:', error);
            setSyncMessage(`❌ 오류: ${error.message}`);
            setSyncError(true);
        } finally {
            setSyncing(false);
            setSyncProgress('');
        }
    };

    const cleanupGhostNodes = async () => {
        try {
            const processesRef = ref(rtdb, 'processes');
            const snapshot = await get(processesRef);

            if (!snapshot.exists()) {
                alert('정리할 데이터가 없습니다');
                return;
            }

            const data = snapshot.val();
            const updates = {};
            let ghostCount = 0;

            Object.entries(data).forEach(([key, value]) => {
                // 1. 타임스탬프 형태의 유령 노드 (13자리 숫자)
                if (/^\d{13}$/.test(key)) {
                    console.log('타임스탬프 유령 노드 발견:', key, value);
                    updates[`processes/${key}`] = null;
                    ghostCount++;
                }

                // 2. "undefined" 노드
                else if (key === 'undefined') {
                    console.log('undefined 노드 발견:', value);
                    updates[`processes/undefined`] = null;
                    ghostCount++;
                }

                // 3. 필수 필드 없는 불완전한 노드 (프로젝트 표준인 code, model 기준)
                else if (!value.code || !value.model) {
                    console.log('불완전한 노드 발견:', key, value);
                    updates[`processes/${key}`] = null;
                    ghostCount++;
                }
            });

            if (ghostCount > 0) {
                await update(ref(rtdb), updates);
                alert(`✅ ${ghostCount}개의 유령 노드를 정리했습니다`);
            } else {
                alert('✅ 정리할 유령 노드가 없습니다');
            }

        } catch (error) {
            console.error('데이터 정리 실패:', error);
            alert(`❌ 오류: ${error.message}`);
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

            {/* Trash Bin Section */}

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
                        <div style={{ marginTop: '16px' }}>
                            <div className="info-box" style={{
                                background: 'rgba(34, 211, 238, 0.05)',
                                borderLeft: '4px solid var(--primary)',
                                padding: '16px',
                                marginBottom: '20px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                lineHeight: '1.6'
                            }}>
                                <h4 style={{ marginTop: 0, color: 'var(--primary)', marginBottom: '8px' }}>📚 Google Sheets 설정 방법</h4>
                                <ol style={{ margin: '0', paddingLeft: '20px', color: 'var(--text-muted)' }}>
                                    <li>Google Sheets에서 품목 데이터 작성 (열: 품목번호, 품목명, 카테고리)</li>
                                    <li>파일 → 공유 → 웹에 게시 클릭</li>
                                    <li>"전체 문서" 선택, 형식 "쉼표로 구분된 값(.csv)" 선택</li>
                                    <li>"게시" 클릭 후 생성된 URL 복사</li>
                                    <li>아래 입력란에 URL 붙여넣기</li>
                                    <li>"동기화" 버튼 클릭</li>
                                </ol>
                                <p style={{ marginTop: '8px', fontWeight: 'bold' }}>💡 팁: Google Sheets를 수정한 후 "동기화" 버튼만 누르면 자동으로 Firebase가 업데이트됩니다!</p>
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    Google Sheets URL
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <LinkIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="url"
                                        value={sheetsUrl}
                                        onChange={(e) => setSheetsUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/e/..."
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 40px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '12px',
                                            color: 'white',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSyncFromSheets}
                                disabled={!sheetsUrl || syncing}
                                className="btn btn-primary btn-full"
                                style={{
                                    height: '48px',
                                    fontSize: '15px'
                                }}
                            >
                                {syncing ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" style={{ marginRight: '8px' }} />
                                        {syncProgress}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={18} style={{ marginRight: '8px' }} />
                                        Google Sheets에서 동기화
                                    </>
                                )}
                            </button>

                            {syncMessage && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: syncError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    color: syncError ? 'var(--danger)' : '#10b981',
                                    border: `1px solid ${syncError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    {syncError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                                    {syncMessage}
                                </div>
                            )}

                            {productsCount !== undefined && (
                                <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    현재 DB 저장된 품목: <strong>{productsCount.toLocaleString()}개</strong>
                                </p>
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

            {/* Debugging Tools */}
            <div className="card" style={{ marginTop: '24px', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <Activity size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>🔧 개발자 도구</h3>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <button
                        onClick={debugFirebaseStructure}
                        className="btn btn-secondary btn-full"
                        style={{ marginBottom: '8px', justifyContent: 'center' }}
                    >
                        🔍 Firebase 데이터 구조 확인 (콘솔 로그)
                    </button>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5', margin: 0 }}>
                        F12를 눌러 콘솔을 열고 이 버튼을 클릭하면 현재 Firebase 데이터 구조를 확인할 수 있습니다.
                    </p>
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🧹 데이터베이스 정리
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '12px' }}>
                        잘못된 데이터 노드(유령 노드)를 제거합니다. 타임스탬프 ID 노드나 필수 정보가 없는 노드를 정리합니다.
                    </p>
                    <button
                        onClick={cleanupGhostNodes}
                        className="btn btn-danger btn-full"
                        style={{ marginBottom: '12px', justifyContent: 'center' }}
                    >
                        🗑️ 유령 노드 정리 실행
                    </button>
                    <p style={{ color: 'var(--danger)', fontSize: '10px', opacity: 0.8 }}>
                        ⚠️ 주의: 이 작업은 되돌릴 수 없습니다. 실행 전에 데이터를 확인하세요.
                    </p>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Daehansa Caliper Flow</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>© 2024 Antigravity AI. All rights reserved.</div>
            </div>
        </div>
    );
}
