import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import JobCard from './process/JobCard';
import BatchActionBar from './process/BatchActionBar';
import ProcessModals from './process/ProcessModals';
import { useAuth } from '../contexts/AuthContext';
import { statusKeys as STACK_STATUS_KEYS, STAGES, getJobStage, groupJobs } from '../utils/statusUtils';

const statusKeys = STACK_STATUS_KEYS;

export default function ProcessList({ jobs, staffNames, onUpdateStatus, onDeleteJob, onEditJob, onAddJob, onPrefillRequest, onSplitJob, filter, onClearFilter }) {
    const { currentUser, userRole } = useAuth();
    const isReadOnly = userRole === 'viewer';

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

        // Complete 상태에서도 다음 단계(휴지통) 반환
        if (currentStage === 'complete') {
            return { key: 'trash', label: '휴지통', question: '작업을 삭제(휴지통으로 이동)하시겠습니까?' };
        }

        const currentIndex = statusKeys.indexOf(currentStage);
        if (currentIndex < statusKeys.length - 1) return stages[currentIndex + 1];
        return null;
    };

    const [searchTerm, setSearchTerm] = useState('');

    const groupedJobs = groupJobs(jobs);

    const filteredGroups = groupedJobs.filter(group => {
        // 검색어 필터링
        if (searchTerm) {
            const query = searchTerm.toLowerCase();
            const searchTarget = `${group.model} ${group.code} ${group.base}`.toLowerCase();
            if (!searchTarget.includes(query)) return false;
        }

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
        console.log('handleConfirmStatus called', { confirmTarget, selectedStaff });
        if (confirmTarget && selectedStaff) {
            if (confirmTarget.stageKey === 'trash') {
                onDeleteJob(confirmTarget.jobIds, selectedStaff);
            } else {
                console.log('Calling onUpdateStatus with:', confirmTarget.jobIds, confirmTarget.stageKey, selectedStaff);
                onUpdateStatus(confirmTarget.jobIds, confirmTarget.stageKey, selectedStaff);
            }
            setConfirmTarget(null);
            setSelectedStaff('');
        }
    };

    const [collapsedStages, setCollapsedStages] = useState(new Set());

    const toggleCollapse = (stageKey) => {
        const newCollapsed = new Set(collapsedStages);
        if (newCollapsed.has(stageKey)) newCollapsed.delete(stageKey);
        else newCollapsed.add(stageKey);
        setCollapsedStages(newCollapsed);
    };

    const toggleCollapseAll = () => {
        if (collapsedStages.size === stagesToShow.length) {
            setCollapsedStages(new Set()); // Expand All
        } else {
            setCollapsedStages(new Set(stagesToShow.map(s => s.key))); // Collapse All
        }
    };

    const handleBatchConfirmStatus = () => {
        if (batchConfirmTarget && selectedStaff) {
            // 휴지통 이동인 경우
            if (batchConfirmTarget.stageKey === 'trash') {
                const allJobIds = [];
                batchConfirmTarget.groups.forEach(group => {
                    // 그룹 내 모든 아이템 ID 수집
                    if (group.items) {
                        group.items.forEach(item => allJobIds.push(item.id));
                    } else {
                        allJobIds.push(group.id);
                    }
                });
                onDeleteJob(allJobIds, selectedStaff);
            } else {
                // 일반 공정 이동 logic
                batchConfirmTarget.groups.forEach(group => {
                    // Fix: Batch update should also check effective group stage, not just first item
                    let currentEffectiveStage = getJobStage(group.items[0]);

                    // Logic from handleStageChange to find slowest item
                    if (group.items.length > 0) {
                        let minIndex = 999;
                        let minStage = currentEffectiveStage;
                        group.items.forEach(item => {
                            const stage = getJobStage(item);
                            if (stage === 'complete') return;
                            const idx = statusKeys.indexOf(stage);
                            if (idx === -1) {
                                if (minIndex > -1) { minIndex = -1; minStage = 'new_added'; }
                            } else if (idx < minIndex) {
                                minIndex = idx;
                                minStage = stage;
                            }
                        });
                        if (minIndex === 999) {
                            const allComplete = group.items.every(j => getJobStage(j) === 'complete');
                            if (allComplete) minStage = 'complete';
                        }
                        currentEffectiveStage = minStage;
                    }

                    const mockJob = { status: { [currentEffectiveStage]: true } };
                    if (currentEffectiveStage === 'complete') mockJob.status.complete = true;
                    if (currentEffectiveStage === 'new_added') mockJob.status = {};

                    const nextStage = getNextStage(mockJob);
                    if (nextStage) {
                        onUpdateStatus(group.items.map(j => j.id), nextStage.key, selectedStaff);
                    }
                });
            }

            setBatchConfirmTarget(null);
            setSelectedStaff('');
            setSelectedGroups(new Set());
        }
    };

    const handleDirectComplete = (job) => {
        // use fresh data from jobs prop
        const freshJob = jobs.find(j => j.id === job.id);
        if (!freshJob) return;

        let jobIds = [freshJob.id];
        if (freshJob.groupId) {
            const groupItems = jobs.filter(j => j.groupId === freshJob.groupId);
            jobIds = groupItems.map(j => j.id);
        }

        setConfirmTarget({
            label: '바로 완료',
            question: '모든 중간 단계를 건너뛰고 바로 생산 완료 처리하시겠습니까?',
            jobIds: jobIds,
            stageKey: 'complete'
        });
    };

    const handleSendToAssemblyWait = (job) => {
        console.log('handleSendToAssemblyWait called with:', job);
        const freshJob = jobs.find(j => j.id === job.id);
        if (!freshJob) {
            console.error('Job not found in current jobs list');
            return;
        }

        let jobIds = [freshJob.id];
        if (freshJob.groupId) {
            const groupItems = jobs.filter(j => j.groupId === freshJob.groupId);
            jobIds = groupItems.map(j => j.id);
        }

        console.log('Setting confirmTarget for assembly_wait', { jobIds, stageKey: 'assembly_wait' });

        setConfirmTarget({
            label: '조립대기로',
            question: '중간 단계를 건너뛰고 바로 조립대기 단계로 이동하시겠습니까?',
            jobIds: jobIds,
            stageKey: 'assembly_wait'
        });
    };

    const handleDelete = () => {
        if (deleteTarget) {
            // 일반 삭제 시에는 로그인한 사용자 이름 사용
            onDeleteJob(deleteTarget.ids, userName || '사용자');
            setDeleteTarget(null);
        }
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
        const job = jobs.find(j => j.id === jobId);

        if (!job) {
            console.error('❌ 오류: job을 찾을 수 없음!', jobId);
            return;
        }

        // 그룹(세트) 처리 로직
        let targetJobs = [job];
        let currentEffectiveStage = getJobStage(job);

        // 그룹ID가 있다면 그룹 전체를 찾아서 "가장 느린 단계"를 기준으로 다음 단계 결정
        if (job.groupId) {
            const groupItems = jobs.filter(j => j.groupId === job.groupId);
            if (groupItems.length > 0) {
                targetJobs = groupItems;

                // 그룹 내에서 가장 느린(인덱스가 낮은) 단계 찾기
                let minIndex = 999;
                let minStage = currentEffectiveStage;

                groupItems.forEach(item => {
                    const stage = getJobStage(item);
                    // 완료된 상태는 인덱스 고려 제외 (이미 끝난 건 무시하고 진행 중인 것 기준)
                    // 단, 모든 아이템이 완료된 경우면 complete가 됨
                    if (stage === 'complete') return;

                    const idx = statusKeys.indexOf(stage);
                    // new_added(-1)인 경우 가장 우선순위 높음
                    if (idx === -1) {
                        if (minIndex > -1) { minIndex = -1; minStage = 'new_added'; }
                    } else if (idx < minIndex) {
                        minIndex = idx;
                        minStage = stage;
                    }
                });

                // 모든 아이템이 complete라서 loop에서 걸러졌다면?
                // minIndex가 여전히 999. 그렇다면 'complete' 상태임.
                if (minIndex === 999) {
                    // 모든 아이템이 완료 상태인지 확인
                    const allComplete = groupItems.every(j => getJobStage(j) === 'complete');
                    if (allComplete) minStage = 'complete';
                    else {
                        // 섞여있는데 complete가 아닌 녀석이 new_added일 수도 있음.
                        // 상기 로직에서 new_added는 idx=-1로 잡힘.
                        // 즉 여기 도달하면 뭔가 이상하지만, 안전하게 첫번째 아이템 기준 fallback
                        minStage = getJobStage(job);
                    }
                }

                currentEffectiveStage = minStage;
            }
        }

        console.log('🎯 Target Jobs:', targetJobs.length, 'Effective Current Stage:', currentEffectiveStage);

        // 다음 단계 계산 (현재 유효 단계 기준)
        // getNextStage 함수를 재사용하되, 가상의 job 객체를 주입하여 계산
        const mockJobForCalc = { status: { [currentEffectiveStage]: true } };
        if (currentEffectiveStage === 'complete') mockJobForCalc.status.complete = true;
        if (currentEffectiveStage === 'new_added') mockJobForCalc.status = {};

        const nextStage = getNextStage(mockJobForCalc);

        if (!nextStage) {
            console.warn('⚠️ 더 이상 이동할 수 있는 공정이 없습니다.');
            return;
        }

        // 사용자가 클릭한 단계가 다음 단계와 다르더라도, 다음 단계로 안내 (또는 무시하고 다음 단계 진행)
        const targetStage = nextStage;
        const stageLabel = targetStage.label;
        const question = targetStage.question;

        console.log('📌 강제 다음 단계 설정:', { label: stageLabel, question });

        setConfirmTarget({
            jobIds: targetJobs.map(j => j.id), // 그룹 전체 ID 포함
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <h1 style={{ margin: 0, whiteSpace: 'nowrap' }}>공정 관리</h1>
                        {/* 검색창 추가 */}
                        <div style={{ position: 'relative', maxWidth: '200px', width: '100%' }}>
                            <input
                                type="text"
                                placeholder="품목 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 32px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'white',
                                    fontSize: '14px'
                                }}
                            />
                            <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </div>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={toggleCollapseAll} className="btn-secondary">
                            {collapsedStages.size === stagesToShow.length ? '모두 펼치기' : '모두 접기'}
                        </button>
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
                                <div className="section-header" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }} onClick={() => toggleCollapse(stage.key)}>
                                        <span style={{ marginRight: '8px', transform: collapsedStages.has(stage.key) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
                                        <span>{stage.label}</span>
                                        <span className="badge" style={{ marginLeft: '8px' }}>{jobsByStage[stage.key].length}건</span>
                                    </div>
                                    {!isReadOnly && (
                                        <input
                                            type="checkbox"
                                            checked={jobsByStage[stage.key].every(g => selectedGroups.has(g.key))}
                                            onChange={() => handleToggleStage(stage.key)}
                                            className="stage-checkbox"
                                            style={{ marginLeft: 'auto' }}
                                        />
                                    )}
                                </div>
                                {!collapsedStages.has(stage.key) && (
                                    <div className="card-list">
                                        {jobsByStage[stage.key].map(group => (
                                            <JobCard
                                                key={group.key} group={group} isSelected={selectedGroups.has(group.key)}
                                                onToggleSelection={(key) => { const n = new Set(selectedGroups); if (n.has(key)) n.delete(key); else n.add(key); setSelectedGroups(n); }}
                                                onDelete={setDeleteTarget} onDetailClick={setSelectedJob} onStageClick={handleStageChange} stages={stages}
                                                isReadOnly={isReadOnly}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {!isReadOnly && (
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
                )}

                <ProcessModals
                    selectedJob={selectedJob} setSelectedJob={setSelectedJob} isEditing={isEditing} setIsEditing={setIsEditing} editData={editData} setEditData={setEditData} saveEdit={saveEdit} startEdit={startEdit}
                    confirmTarget={confirmTarget} setConfirmTarget={setConfirmTarget} selectedStaff={selectedStaff} setSelectedStaff={setSelectedStaff} handleConfirmStatus={handleConfirmStatus} staffNames={staffNames}
                    batchConfirmTarget={batchConfirmTarget} setBatchConfirmTarget={setBatchConfirmTarget} handleBatchConfirmStatus={handleBatchConfirmStatus}
                    deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget} handleDelete={handleDelete} stages={stages}
                    onDirectComplete={handleDirectComplete}
                    onSendToAssemblyWait={handleSendToAssemblyWait}
                    onSplitJob={onSplitJob}
                    getNextStage={getNextStage}
                    isReadOnly={isReadOnly}
                    jobs={jobs}
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
