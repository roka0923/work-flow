import React, { useState } from 'react';
import { X } from 'lucide-react';
import JobCard from './process/JobCard';
import BatchActionBar from './process/BatchActionBar';
import ProcessModals from './process/ProcessModals';
import { statusKeys as STACK_STATUS_KEYS, STAGES, getJobStage } from '../utils/statusUtils';

const statusKeys = STACK_STATUS_KEYS;

export default function ProcessList({ jobs, staffNames, onUpdateStatus, onDeleteJob, onEditJob, onAddJob, onPrefillRequest, filter, onClearFilter }) {
    const [selectedJob, setSelectedJob] = useState(null);
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [selectedGroups, setSelectedGroups] = useState(new Set());
    const [batchConfirmTarget, setBatchConfirmTarget] = useState(null);

    const stages = STAGES.filter(s => s.key !== 'new_added' && s.key !== 'complete').map(s => ({
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

    const filteredJobs = jobs.filter(job => {
        const currentStage = getJobStage(job);
        if (filter === 'finished') return job.status.complete;
        if (filter === 'new_added') return currentStage === 'new_added';
        if (!filter) return !job.status.complete;
        if (filter === 'urgent') return job.urgent && !job.status.complete;

        // 대시보드 필터와 현재 단계가 일치하는 경우만 표시
        return currentStage === filter;
    });

    const getBaseModel = (model) => {
        if (!model) return '품목명 없음';
        return model.replace(/\s+(LH|RH)$/i, '').trim();
    };

    const groupMap = new Map();
    const groupedJobs = [];

    filteredJobs.forEach(job => {
        const key = job.groupId || job.id;
        const stage = getJobStage(job);


        if (!groupMap.has(key)) {
            const group = {
                key,
                base: getBaseModel(job.model),
                items: [job],
                urgent: job.urgent || false,
                requestDate: job.requestDate,
                code: job.code,
                minStage: stage,
                minStageIndex: statusKeys.indexOf(stage) === -1 ? -1 : statusKeys.indexOf(stage)
            };
            groupMap.set(key, group);
            groupedJobs.push(group);
        } else {
            const g = groupMap.get(key);
            g.items.push(job);
            if (job.urgent) g.urgent = true;
            if (job.memo) g.memo = job.memo;
            if (job.requestDate && (!g.requestDate || new Date(job.requestDate) < new Date(g.requestDate))) {
                g.requestDate = job.requestDate;
            }

            // 그룹의 단계 결정 (가장 느린 단계 기준)
            const currentStageIndex = statusKeys.indexOf(stage);
            if (currentStageIndex !== -1 && (g.minStageIndex === -1 || currentStageIndex < g.minStageIndex)) {
                g.minStageIndex = currentStageIndex;
                g.minStage = stage;
            } else if (stage === 'new_added') {
                g.minStage = 'new_added';
                g.minStageIndex = -1;
            }
        }
    });

    const jobsByStage = {};
    STAGES.forEach(stage => {
        jobsByStage[stage.key] = groupedJobs.filter(g => g.minStage === stage.key);
    });

    const stagesToShow = STAGES.filter(stage => (jobsByStage[stage.key]?.length > 0) && (filter === 'complete' || stage.key !== 'complete'));

    const handleConfirmStatus = () => {
        if (confirmTarget && selectedStaff) {
            onUpdateStatus(confirmTarget.jobIds, confirmTarget.stageKey, selectedStaff);
            setConfirmTarget(null);
            setSelectedStaff('');
        }
    };

    const handleBatchConfirmStatus = () => {
        if (batchConfirmTarget && selectedStaff) {
            batchConfirmTarget.groups.forEach(group => {
                const nextStage = getNextStage(group.items[0]);
                if (nextStage) onUpdateStatus(group.items.map(j => j.id), nextStage.key, selectedStaff);
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

    const handleStageChange = (jobId, newStageKey) => {
        console.log('=== ProcessList: 공정 변경 요청 ===');
        console.log('🎯 Job ID:', jobId, 'New Stage Key:', newStageKey);

        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            console.error('❌ 오류: job을 찾을 수 없음!', jobId);
            return;
        }

        const targetStage = stages.find(s => s.key === newStageKey);
        const stageLabel = targetStage ? targetStage.label : newStageKey;
        const question = targetStage ? targetStage.question : `${stageLabel} 상태로 변경하시겠습니까?`;

        console.log('📌 팝업 설정:', { label: stageLabel, question });

        setConfirmTarget({
            jobIds: [jobId], // 단일 ID도 배열로 전달
            stageKey: newStageKey,
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
                    if (validGroups.length > 0) setBatchConfirmTarget({ groups: validGroups, stageKey: getNextStage(validGroups[0].items[0]).key, label: getNextStage(validGroups[0].items[0]).label, count: validGroups.length });
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
