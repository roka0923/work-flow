import React, { useState, useEffect } from 'react';
import itemData from '../data/items.json';
import { Search, Package, AlertCircle } from 'lucide-react';

export default function JobRequest({ onAddJob, prefillData, onClearPrefill, staffNames }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [isUrgent, setIsUrgent] = useState(false);
    const [author, setAuthor] = useState('');
    const [memo, setMemo] = useState('');

    useEffect(() => {
        if (prefillData) {
            // Find item by code or model
            const item = itemData.find(i => i.code === prefillData.code) ||
                { code: prefillData.code, model: prefillData.model };

            setSelectedItem(item);
            setQuantity(prefillData.quantity || 1);
            setIsUrgent(prefillData.urgent || false);
            setMemo(prefillData.memo || '');
            setSearchTerm(`${item.code} - ${item.model}`);

            // Clear prefill data once consumed
            onClearPrefill();
        }
    }, [prefillData, onClearPrefill]);

    // Item 1: Auto-select when 5-digit code is typed
    useEffect(() => {
        const pureCode = searchTerm.trim();
        if (pureCode.length === 5 && /^\d+$/.test(pureCode) && (!selectedItem || selectedItem.code !== pureCode)) {
            const match = itemData.find(item => item.code === pureCode);
            if (match) {
                setSelectedItem(match);
                setSearchTerm(`${match.code} - ${match.model}`);
            }
        }
    }, [searchTerm, selectedItem]);

    const filteredItems = itemData.filter(item =>
        (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.code && item.code.includes(searchTerm))
    ).slice(0, 50); // Show up to 50 results instead of 5

    const [isSetRegistration, setIsSetRegistration] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        const timestamp = Date.now();
        const baseJob = {
            code: selectedItem.code,
            quantity,
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
            // Create LH and RH pair
            // Logic: selectedItem.model might be just "Poster 2" or "Poster 2 LH".
            // We need to robustly generate the opposite name.

            const isLH = selectedItem.model.includes('LH');
            const isRH = selectedItem.model.includes('RH');

            let model1 = selectedItem.model;
            let model2 = selectedItem.model;

            if (isLH) {
                model2 = selectedItem.model.replace('LH', 'RH');
            } else if (isRH) {
                model2 = selectedItem.model.replace('RH', 'LH');
            } else {
                // If no suffix, append LH and RH? Or just assume it mimics "Add Opposite" logic
                // But usually items in DB have specific names. 
                // Let's assume standard "Name LH" / "Name RH" pattern exists in DB or we just append.
                model1 = selectedItem.model + ' (LH)';
                model2 = selectedItem.model + ' (RH)';
            }

            const job1 = { ...baseJob, id: timestamp, groupId, model: model1 };
            const job2 = { ...baseJob, id: timestamp + 1, groupId, model: model2 };

            onAddJob([job1, job2]);
        } else {
            // Single job
            const job = { ...baseJob, id: timestamp, groupId, model: selectedItem.model };
            onAddJob(job);
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
                            placeholder="예: 11011 또는 아토스"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 40px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--glass-border)',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
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
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>작업 수량</label>
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
