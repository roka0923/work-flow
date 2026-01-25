import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import JobCard from './process/JobCard';
import BatchActionBar from './process/BatchActionBar';
import ProcessModals from './process/ProcessModals';
import { useAuth } from '../contexts/AuthContext';
import { statusKeys as STACK_STATUS_KEYS, STAGES, getJobStage, groupJobs } from '../utils/statusUtils';

const statusKeys = STACK_STATUS_KEYS;

export default function ProcessList({ jobs, staffNames, onUpdateStatus, onDeleteJob, onEditJob, onAddJob, onPrefillRequest, filter, onClearFilter }) {
    const { currentUser } = useAuth();
    const [selectedJob, setSelectedJob] = useState(null);
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [selectedGroups, setSelectedGroups] = useState(new Set());
    const [batchConfirmTarget, setBatchConfirmTarget] = useState(null);

    // 로그인한 사용자의 이름을 기본값으로 설정하는 로직
    const userName = currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0] || '') : '';

    useEffect(() => {
        // 모달(단일 또는 일괄)이 열릴 때 담당자가 비어있으면 로그인 사용자 이름으로 자동 설정
        if ((confirmTarget || batchConfirmTarget) && !selectedStaff) {
            if (staffNames.includes(userName)) {
                setSelectedStaff(userName);
            }
        }
    }, [confirmTarget, batchConfirmTarget, selectedStaff, staffNames, userName]);

    const stages = STAGES.filter(s => s.key !== 'new_added').map(s => ({
        ...s,
        question: s.key === 'waiting' ? '분해 할 품목이 공장에 입고되었나요?' :
            s.key === 'disassembly' ? '분해가 완료되었나요?' :
                s.key === 'plating_release' ? '도금외주 반출되었나요?' :
                    s.key === 'assembly_wait' ? '도금품 입고 및 분류되었나요?' :
                        '공정이 완료되었나요?'
    }));

    const getNextStage = (job) => {
        const currentStage = getJobStage(job);
        if (currentStage === 'new_added') return stages[0];
        const currentIndex = statusKeys.indexOf(currentStage);
        if (currentIndex < statusKeys.length - 1) return stages[currentIndex + 1];
        return null;
    };

    const groupedJobs = groupJobs(jobs);

    const filteredGroups = groupedJobs.filter(group => {
        if (filter === 'finished' || filter === 'complete') return group.complete;
        if (filter === 'urgent') return group.urgent && !group.complete;
        if (filter === 'new_added') return group.currentStage === 'new_added';
        if (!filter) return true; // 필터가 없을 때는 모든 공정(완료 포함)을 보여줌

        // 대시보드에서 넘어온 특정 공정 필터 (신규추가 제외 일반 공정들)
        return !group.complete && group.currentStage === filter;
    });

    const jobsByStage = {};
    STAGES.forEach(stage => {
        jobsByStage[stage.key] = filteredGroups.filter(g => g.currentStage === stage.key);
    });

    const stagesToShow = STAGES.filter(stage =>
        jobsByStage[stage.key]?.length > 0
    );

    const handleConfirmStatus = () => {
        if (confirmTarget && selectedStaff) {
            onUpdateStatus(confirmTarget.jobIds, confirmTarget.stageKey, selectedStaff);
            setConfirmTarget(null);
            setSelectedStaff('');
        }
    };

    const handleBatchConfirmStatus = () => {
        if (batchConfirmTarget && selectedStaff) {
            // 일괄 처리 시에도 각 그룹별로 정확한 다음 단계를 계산하여 업데이트
            // batchConfirmTarget.groups에는 이미 "다음 단계가 있는" 유효한 그룹들만 필터링되어 있음.
            // 하지만 안전을 위해 다시 한번 각 그룹의 items에 대해 다음 단계를 계산.

            // 동일한 다음 단계를 가진 그룹끼리 묶어서 처리하거나, 개별 loop 처리
            // 여기서는 단순화를 위해 모아서 처리하지만, 만약 그룹마다 "다음 단계"가 다르면(그럴 일은 드물겠지만) 로직이 복잡해짐.
            // batch action bar에서 이미 "같은 다음 단계"를 가진 것들만 묶었는지 확인 필요.
            // 현재 BatchActionBar 로직: const validGroups = groups.filter(g => getNextStage(g.items[0]));
            // 그리고 setBatchConfirmTarget에 stageKey를 하나만 넣고 있음. 
            // 이는 "선택된 모든 항목이 같은 다음 단계일 때"만 유효하거나, 아니면 "각자 갈 길을 가게" 해야 함.

            // 개선: 각 아이템별로 자신의 nextStage로 업데이트하도록 변경
            batchConfirmTarget.groups.forEach(group => {
                const nextStage = getNextStage(group.items[0]);
                if (nextStage) {
                    onUpdateStatus(group.items.map(j => j.id), nextStage.key, selectedStaff);
                }
            });

            setBatchConfirmTarget(null);
            setSelectedStaff('');
            setSelectedGroups(new Set());
        }
    };

    const handleDelete = () => {
        if (deleteTarget) { onDeleteJob(deleteTarget.ids); setDeleteTarget(null); }
    };


    const startEdit = (job) => {
        setEditData({ model: job.model, code: job.code, memo: job.memo || '', quantity: job.quantity || 1, urgent: job.urgent || false });
        setIsEditing(true);
    };

    const saveEdit = () => {
        onEditJob(selectedJob.id, editData);
        setSelectedJob({ ...selectedJob, ...editData });
        setIsEditing(false);
    };

    const handleStageChange = (jobId, requestedStageKey) => {
        console.log('=== ProcessList: 공정 변경 요청 ===');
        console.log('🎯 Job ID:', jobId, 'Requested Key:', requestedStageKey);

        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            console.error('❌ 오류: job을 찾을 수 없음!', jobId);
            return;
        }

        // 클릭한 단계와 상관없이, 현재 상태의 "다음 단계"를 계산하여 강제 이동
        const nextStage = getNextStage(job);

        if (!nextStage) {
            console.warn('⚠️ 더 이상 이동할 수 있는 공정이 없습니다.');
            return;
        }

        // 사용자가 클릭한 단계가 다음 단계와 다르더라도, 다음 단계로 안내 (또는 무시하고 다음 단계 진행)
        // 여기서는 "다음 단계"로 컨펌 팝업을 띄웁니다.
        const targetStage = nextStage;
        const stageLabel = targetStage.label;
        const question = targetStage.question;

        console.log('📌 강제 다음 단계 설정:', { label: stageLabel, question });

        setConfirmTarget({
            jobIds: [jobId],
            stageKey: targetStage.key,
            label: stageLabel,
            question: question
        });
    };

    const handleToggleStage = (stageKey) => {
        const stageGroups = jobsByStage[stageKey];
        const allKeys = stageGroups.map(g => g.key);
        const allSelected = allKeys.every(k => selectedGroups.has(k));

        const newSelected = new Set(selectedGroups);
        if (allSelected) {
            allKeys.forEach(k => newSelected.delete(k));
        } else {
            allKeys.forEach(k => newSelected.add(k));
        }
        setSelectedGroups(newSelected);
    };

    try {
        return (
            <div className="animate-fade-in" style={{ paddingBottom: selectedGroups.size > 0 ? '100px' : '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h1>공정 관리</h1>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {selectedGroups.size > 0 && <button onClick={() => setSelectedGroups(new Set())} className="btn-secondary">선택 해제</button>}
                        {filter && <button onClick={onClearFilter} className="btn-secondary">필터 해제 <X size={14} /></button>}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {stagesToShow.length === 0 ? (
                        <div className="card text-center text-muted p-40">{filter ? '대기 중인 작업이 없습니다.' : '등록된 작업이 없습니다.'}</div>
                    ) : (
                        stagesToShow.map(stage => (
                            <div key={stage.key}>
                                <div className="section-header" onClick={() => handleToggleStage(stage.key)} style={{ cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={jobsByStage[stage.key].every(g => selectedGroups.has(g.key))}
                                        readOnly
                                        className="stage-checkbox"
                                    />
                                    <span>{stage.label}</span>
                                    <span className="badge">{jobsByStage[stage.key].length}건</span>
                                </div>
                                <div className="card-list">
                                    {jobsByStage[stage.key].map(group => (
                                        <JobCard
                                            key={group.key} group={group} isSelected={selectedGroups.has(group.key)}
                                            onToggleSelection={(key) => { const n = new Set(selectedGroups); if (n.has(key)) n.delete(key); else n.add(key); setSelectedGroups(n); }}
                                            onDelete={setDeleteTarget} onDetailClick={setSelectedJob} onStageClick={handleStageChange} stages={stages}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <BatchActionBar selectedCount={selectedGroups.size} onAction={() => {
                    const groups = groupedJobs.filter(g => selectedGroups.has(g.key));
                    const validGroups = groups.filter(g => getNextStage(g.items[0]));
                    if (validGroups.length > 0) {
                        const nextStage = getNextStage(validGroups[0].items[0]);
                        setBatchConfirmTarget({
                            groups: validGroups,
                            stageKey: nextStage.key,
                            label: nextStage.label,
                            question: nextStage.question,
                            count: validGroups.length
                        });
                    }
                }} />

                <ProcessModals
                    selectedJob={selectedJob} setSelectedJob={setSelectedJob} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} saveEdit={saveEdit} startEdit={startEdit}
                    confirmTarget={confirmTarget} setConfirmTarget={setConfirmTarget} selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} handleConfirmStatus={handleConfirmStatus} staffNames={staffNames}
                    batchConfirmTarget={batchConfirmTarget} setBatchConfirmTarget={setBatchConfirmTarget} handleBatchConfirmStatus={handleBatchConfirmStatus}
                    deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget} handleDelete={handleDelete} stages={stages}
                />
            </div>
        );
    } catch (err) {
        console.error("ProcessList Render Error:", err);
        return (
            <div className="card" style={{ margin: '20px', padding: '20px', border: '1px solid var(--danger)' }}>
                <h3 style={{ color: 'var(--danger)' }}>공정 목록을 표시하는 중 오류가 발생했습니다.</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{err.message}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '10px' }}>새로고침</button>
            </div>
        );
    }
}
