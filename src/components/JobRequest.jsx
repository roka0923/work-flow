import React, { useState, useEffect } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../contexts/AuthContext';
import { Search, Package, AlertCircle, Loader2 } from 'lucide-react';

export default function JobRequest({ onAddJob, prefillData, onClearPrefill, staffNames }) {
    const { currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [quantityL, setQuantityL] = useState(1);
    const [quantityR, setQuantityR] = useState(1);
    const [isUrgent, setIsUrgent] = useState(false);

    // 로그인한 사용자의 이름을 기본값으로 설정
    const defaultAuthor = currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0] || '') : '';
    const [author, setAuthor] = useState(defaultAuthor);
    const [memo, setMemo] = useState('');

    // staffNames가 로드된 후에도 작성자가 비어있다면 다시 한번 기본값 체크
    useEffect(() => {
        if (!author && defaultAuthor && staffNames.includes(defaultAuthor)) {
            setAuthor(defaultAuthor);
        }
    }, [staffNames, defaultAuthor, author]);

    // Use the product hook for real-time Firebase data
    const { products, loading: productsLoading, searchProducts } = useProducts();

    useEffect(() => {
        if (prefillData && !productsLoading) {
            // Find item by code or model
            const item = products.find(i => i.code === prefillData.code) ||
                { code: prefillData.code, model: prefillData.model };

            setSelectedItem(item);
            setQuantity(prefillData.quantity || 1);
            setQuantityL(prefillData.quantity || 1);
            setQuantityR(prefillData.quantity || 1);
            setIsUrgent(prefillData.urgent || false);
            setMemo(prefillData.memo || '');
            setSearchTerm(`${item.code} - ${item.model}`);

            // Clear prefill data once consumed
            onClearPrefill();
        }
    }, [prefillData, onClearPrefill, productsLoading, products]);

    // Item 1: Auto-select when 5-digit code is typed
    useEffect(() => {
        const pureCode = searchTerm.trim();
        if (pureCode.length === 5 && /^\d+$/.test(pureCode) && (!selectedItem || selectedItem.code !== pureCode)) {
            const match = products.find(item => item.code === pureCode);
            if (match) {
                setSelectedItem(match);
                setSearchTerm(`${match.code} - ${match.model}`);
            }
        }
    }, [searchTerm, selectedItem, products]);

    const filteredItems = searchProducts(searchTerm);

    const [isSetRegistration, setIsSetRegistration] = useState(true);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        const timestamp = Date.now();
        const baseJob = {
            code: selectedItem.code,
            quantity: isSetRegistration ? 0 : quantity, // 단일일 때만 quantity 사용
            urgent: isUrgent,
            memo,
            author,
            requestDate: new Date().toISOString(),
            status: {
                waiting: false,
                disassembly: false,
                plating_release: false,
                assembly_wait: false,
                complete: false,
                lastUpdated: new Date().toISOString()
            }
        };

        // Decision: Use passed groupId (from add opposite) OR generate new one
        const groupId = (prefillData && prefillData.groupId) ? prefillData.groupId : `${timestamp}_${selectedItem.code}`;

        if (isSetRegistration) {
            // LH+RH 세트 등록 플래그 포함 + 개별 수량 전달
            onAddJob({
                ...baseJob,
                model: selectedItem.model,
                addBothSides: true,
                quantityL,
                quantityR
            });
        } else {
            // 단일 작업
            onAddJob({ ...baseJob, model: selectedItem.model });
        }
    };

    return (
        <div className="animate-fade-in">
            <h1>새 작업 지시</h1>

            <form onSubmit={handleSubmit}>
                <div className="card">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>품목 검색 (코드 또는 모델명)</label>
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder={productsLoading ? "품목 정보를 불러오는 중..." : "예: 11011 또는 아토스"}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={productsLoading}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: 'white',
                                outline: 'none',
                                opacity: productsLoading ? 0.6 : 1
                            }}
                        />
                        {productsLoading && (
                            <Loader2
                                size={18}
                                className="animate-spin"
                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}
                            />
                        )}
                    </div>

                    {searchTerm && !selectedItem && (
                        <div style={{
                            marginBottom: '12px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                                검색 결과 {filteredItems.length}건
                            </div>
                            {filteredItems.map(item => (
                                <div
                                    key={item.code}
                                    onClick={() => {
                                        setSelectedItem(item);
                                        setSearchTerm(`${item.code} - ${item.model}`);
                                    }}
                                    style={{
                                        padding: '12px',
                                        borderBottom: '1px solid var(--glass-border)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>{item.model}</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{item.code}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedItem && (
                        <div className="animate-fade-in" style={{ padding: '12px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Package color="var(--primary)" />
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--primary)' }}>선택된 품목</div>
                                <div style={{ fontWeight: 'bold' }}>{selectedItem.model} ({selectedItem.code})</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                className="btn btn-secondary"
                                style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                            >
                                취소
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                {isSetRegistration ? 'L/R 수량 (각각 입력)' : '작업 수량'}
                            </label>
                            {isSetRegistration ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>LH (좌)</div>
                                        <input
                                            type="number"
                                            value={quantityL}
                                            onChange={(e) => setQuantityL(parseInt(e.target.value) || 1)}
                                            min="1"
                                            className="input-field"
                                            style={{ width: '100%', padding: '10px' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>RH (우)</div>
                                        <input
                                            type="number"
                                            value={quantityR}
                                            onChange={(e) => setQuantityR(parseInt(e.target.value) || 1)}
                                            min="1"
                                            className="input-field"
                                            style={{ width: '100%', padding: '10px' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                                    min="1"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'white'
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                            <div
                                onClick={() => setIsUrgent(!isUrgent)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: isUrgent ? 'var(--danger)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    height: '46px'
                                }}
                            >
                                <AlertCircle size={16} />
                                <span style={{ fontWeight: '600', fontSize: '13px' }}>긴급</span>
                            </div>
                            <div
                                onClick={() => setIsSetRegistration(!isSetRegistration)}
                                style={{
                                    flex: 1.2,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: isSetRegistration ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isSetRegistration ? 'var(--primary)' : 'var(--glass-border)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    cursor: 'pointer',
                                    transition: '0.2s',
                                    height: '46px'
                                }}
                            >
                                <span style={{ fontWeight: '600', fontSize: '12px', color: isSetRegistration ? 'var(--primary)' : 'white' }}>반대방향(L/R) 같이</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>작성자 (필수 선택)</label>
                        <select
                            value={author}
                            onChange={(e) => setAuthor(e.target.value)}
                            className="btn-full"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: author ? 'white' : 'var(--text-muted)',
                                outline: 'none',
                                fontSize: '14px',
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" disabled style={{ background: '#1e293b' }}>작성자를 선택해주세요</option>
                            {staffNames.map(name => (
                                <option key={name} value={name} style={{ background: '#1e293b' }}>{name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>메모 (특이사항)</label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            placeholder="예: 긴급 도금 필요, 조립 시 주의 등"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: 'white',
                                outline: 'none',
                                minHeight: '80px',
                                resize: 'none',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={!selectedItem || !author}
                    >
                        {isSetRegistration ? 'L+R 세트 작업 요청 등록' : '작업 요청 등록'}
                    </button>
                </div>
            </form >
        </div >
    );
}
