import React, { useState } from 'react';
import { X } from 'lucide-react';
import JobCard from './process/JobCard';
import BatchActionBar from './process/BatchActionBar';
import ProcessModals from './process/ProcessModals';

export default function ProcessList({ jobs, staffNames, onUpdateStatus, onDeleteJob, onEditJob, onAddJob, onPrefillRequest, filter, onClearFilter }) {
    const [selectedJob, setSelectedJob] = useState(null);
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [selectedGroups, setSelectedGroups] = useState(new Set());
    const [batchConfirmTarget, setBatchConfirmTarget] = useState(null);

    const stages = [
        { key: 'waiting', label: '분해대기', question: '분해 할 품목이 공장에 입고되었나요?' },
        { key: 'disassembly', label: '분해완료', question: '분해가 완료되었나요?' },
        { key: 'plating_release', label: '도금출고', question: '도금외주 반출되었나요?' },
        { key: 'assembly_wait', label: '조립대기', question: '도금품 입고 및 분류되었나요?' },
        { key: 'complete', label: '생산완료', question: '생산이 포장단계까지 완료되었나요?' }
    ];

    const allStages = [{ key: 'new_added', label: '신규추가' }, ...stages];
    const statusKeys = ['waiting', 'disassembly', 'plating_release', 'assembly_wait', 'complete'];

    const getJobStage = (job) => {
        if (statusKeys.every(key => !job.status[key])) return 'new_added';
        const lastCheckedIndex = statusKeys.map(k => job.status[k]).lastIndexOf(true);
        return statusKeys[lastCheckedIndex] || 'new_added';
    };

    const getNextStage = (job) => {
        const currentStage = getJobStage(job);
        if (currentStage === 'new_added') return stages[0];
        const currentIndex = statusKeys.indexOf(currentStage);
        if (currentIndex < statusKeys.length - 1) return stages[currentIndex + 1];
        return null;
    };

    const filteredJobs = jobs.filter(job => {
        if (filter === 'finished') return job.status.complete;
        if (filter === 'new_added') return statusKeys.every(key => !job.status[key]);
        if (!filter) return !job.status.complete;
        if (filter === 'urgent') return job.urgent && !job.status.complete;
        const lastCheckedIndex = statusKeys.map(k => job.status[k]).lastIndexOf(true);
        return statusKeys[lastCheckedIndex] === filter;
    });

    const getBaseModel = (model) => model.replace(/\s+(LH|RH)$/i, '').trim();

    const groupMap = new Map();
    const groupedJobs = [];

    filteredJobs.forEach(job => {
        const key = job.groupId || job.id;
        if (!groupMap.has(key)) {
            const group = { key, base: getBaseModel(job.model), items: [], urgent: false, requestDate: job.requestDate, code: job.code, stage: getJobStage(job) };
            groupMap.set(key, group);
            groupedJobs.push(group);
        }
        const g = groupMap.get(key);
        g.items.push(job);
        if (job.urgent) g.urgent = true;
        if (job.memo) g.memo = job.memo; // Update group memo if item has one
        if (new Date(job.requestDate) < new Date(g.requestDate)) g.requestDate = job.requestDate;
    });

    const jobsByStage = {};
    allStages.forEach(stage => { jobsByStage[stage.key] = groupedJobs.filter(g => g.stage === stage.key); });

    const stagesToShow = allStages.filter(stage => (jobsByStage[stage.key]?.length > 0) && (filter === 'complete' || stage.key !== 'complete'));

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

    const handleStageClick = (jobIds, stage, isDone, canCheck) => {
        if (canCheck && !isDone) setConfirmTarget({ jobIds, stageKey: stage.key, label: stage.label, question: stage.question });
        else if (canCheck && isDone) onUpdateStatus(jobIds, stage.key);
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
                                        onDelete={setDeleteTarget} onDetailClick={setSelectedJob} onStageClick={handleStageClick} stages={stages}
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
}
