import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, push, update, remove, serverTimestamp, get } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { notifyProcessChange } from '../utils/notifications';
import { STAGES } from '../utils/statusUtils';

export function useJobs() {
    const [jobs, setJobs] = useState([]);
    const [deletedJobs, setDeletedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();

    // 이전 작업 상태 추적을 위한 Ref (알림 발생용)
    const previousJobsRef = useRef({});

    // Read jobs from Firebase (Only when authenticated)
    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            setJobs([]);
            setDeletedJobs([]);
            previousJobsRef.current = {};
            return;
        }

        setError(null);
        setLoading(true);

        const jobsRef = ref(rtdb, 'processes');
        const unsubscribe = onValue(jobsRef, (snapshot) => {
            try {
                const data = snapshot.val();
                if (data) {
                    const jobsList = Object.keys(data).map(key => {
                        const val = data[key];
                        return {
                            ...val,
                            id: key
                        };
                    });

                    // 알림 로직: 변경 사항 감지
                    // 최초 로드 시에는 previousJobsRef가 비어있으므로 알림이 발생하지 않음 (의도된 동작)
                    jobsList.forEach(job => {
                        const prevJob = previousJobsRef.current[job.id];

                        // 이전 상태가 있고, 단계(stage)가 변경되었을 때만 알림
                        if (prevJob && prevJob.stage !== job.stage) {
                            if (Notification.permission === "granted") {
                                // 단계 라벨 찾기 (예: waiting -> 분해대기)
                                const fromStageLabel = STAGES.find(s => s.key === prevJob.stage)?.label || prevJob.stage;
                                const toStageLabel = STAGES.find(s => s.key === job.stage)?.label || job.stage;

                                // 담당자 찾기 (History의 마지막 항목 or 없으면 '담당자')
                                const lastHistory = Array.isArray(job.history) && job.history.length > 0
                                    ? job.history[job.history.length - 1]
                                    : null;
                                const assigneeName = lastHistory?.staffName || "담당자";

                                notifyProcessChange(
                                    job.model || job.code || "제품",
                                    fromStageLabel,
                                    toStageLabel,
                                    assigneeName
                                );
                            }
                        }
                    });

                    // 현재 상태를 스냅샷으로 저장
                    const currentSnapshot = {};
                    jobsList.forEach(job => {
                        currentSnapshot[job.id] = { stage: job.stage };
                    });
                    previousJobsRef.current = currentSnapshot;

                    // 정렬 및 상태 업데이트
                    const sortedList = jobsList.sort((a, b) => {
                        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt).getTime() || 0);
                        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt).getTime() || 0);
                        return timeB - timeA;
                    });
                    setJobs(sortedList);

                } else {
                    setJobs([]);
                    previousJobsRef.current = {};
                }
                setError(null);
            } catch (err) {
                console.error("Firebase Read Error:", err);
                setError("데이터를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        }, (err) => {
            console.error("Firebase Auth/Permission Error:", err);
            setError("데이터 접근 권한이 없거나 설정이 올바르지 않습니다.");
            setLoading(false);
        });

        const deletedJobsRef = ref(rtdb, 'deleted_processes');
        const unsubscribeDeleted = onValue(deletedJobsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const deletedList = Object.keys(data).map(key => ({
                    ...data[key],
                    id: key
                }));
                setDeletedJobs(deletedList);
            } else {
                setDeletedJobs([]);
            }
        });

        return () => {
            unsubscribe();
            unsubscribeDeleted();
            // 언마운트 시 previousJobsRef는 유지되지만 (Ref 특성), useEffect가 다시 실행되면 초기화됨 (위쪽 if(!currentUser) 블록 참조)
            // 하지만 currentUser가 있는 상태에서 언마운트->마운트 시에는 초기화가 필요할 수도 있음.
            // 여기서는 Ref라 컴포넌트 생명주기 따름.
        };
    }, [currentUser]);

    const addJob = async (jobData) => {
        try {
            // LH+RH 세트인 경우 (요청 사항 반영)
            if (jobData.addBothSides) {
                const groupId = `group_${Date.now()}`;

                // LH 추가
                const lhRef = push(ref(rtdb, 'processes'));
                const { addBothSides: _, ...pureData } = jobData;
                await set(lhRef, {
                    ...pureData,
                    id: lhRef.key,
                    groupId: groupId,
                    side: 'LH',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // RH 추가
                const rhRef = push(ref(rtdb, 'processes'));
                await set(rhRef, {
                    ...pureData,
                    id: rhRef.key,
                    groupId: groupId,
                    side: 'RH',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

            } else if (Array.isArray(jobData)) {
                // 이전 배열 처리 로직 유지 (호환성)
                for (const job of jobData) {
                    const newJobRef = push(ref(rtdb, 'processes'));
                    const { id: _, ...jobToSave } = job;
                    await set(newJobRef, {
                        ...jobToSave,
                        id: newJobRef.key,
                        stage: job.stage || "신규추가",
                        status: job.status || "진행중",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            } else {
                // 단일 작업
                const newJobRef = push(ref(rtdb, 'processes'));
                const { id: _, ...jobToSave } = jobData;
                await set(newJobRef, {
                    ...jobToSave,
                    id: newJobRef.key,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('작업 추가 실패:', error);
            setError("작업 추가 중 오류가 발생했습니다.");
            throw error;
        }
    };

    const editJob = async (jobId, updatedData) => {
        try {
            const jobRef = ref(rtdb, `processes/${jobId}`);
            const { id: _, ...dataToUpdate } = updatedData;
            await update(jobRef, {
                ...dataToUpdate,
                updatedAt: serverTimestamp()
            });
        } catch (err) {
            setError("데이터 수정 중 오류가 발생했습니다.");
        }
    };

    const deleteJob = async (targetIds) => {
        try {
            const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
            for (const id of ids) {
                const jobToDelete = jobs.find(j => j.id === id);
                if (jobToDelete) {
                    // Move to deleted_processes
                    const deletedRef = ref(rtdb, `deleted_processes/${id}`);
                    const { id: _, ...dataToSave } = jobToDelete;
                    await set(deletedRef, {
                        ...dataToSave,
                        deletedAt: new Date().toISOString()
                    });
                    // Remove from processes
                    await remove(ref(rtdb, `processes/${id}`));
                }
            }
        } catch (err) {
            setError("데이터 삭제 중 오류가 발생했습니다.");
        }
    };

    const restoreJob = async (jobId) => {
        try {
            const jobToRestore = deletedJobs.find(j => j.id === jobId);
            if (jobToRestore) {
                const { deletedAt, id: _, ...restoredJob } = jobToRestore;
                const jobRef = ref(rtdb, `processes/${jobId}`);
                await set(jobRef, {
                    ...restoredJob,
                    updatedAt: serverTimestamp()
                });
                await remove(ref(rtdb, `deleted_processes/${jobId}`));
            }
        } catch (err) {
            setError("데이터 복구 중 오류가 발생했습니다.");
        }
    };

    const permanentDeleteJob = async (jobId) => {
        try {
            await remove(ref(rtdb, `deleted_processes/${jobId}`));
        } catch (err) {
            setError("데이터 영구 삭제 중 오류가 발생했습니다.");
        }
    };

    const resetJobs = async () => {
        try {
            await remove(ref(rtdb, 'processes'));
        } catch (err) {
            setError("데이터 초기화 중 오류가 발생했습니다.");
        }
    };

    const clearDeletedJobs = async () => {
        try {
            await remove(ref(rtdb, 'deleted_processes'));
        } catch (err) {
            setError("휴지통 비우기 중 오류가 발생했습니다.");
        }
    };

    const updateJobStatus = async (targetIds, newStage, staffName = '시스템') => {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];

        for (const id of ids) {
            if (!id || id === 'undefined') continue;

            const targetJob = jobs.find(j => j.id === id);
            if (!targetJob) continue;

            const groupId = targetJob.groupId;
            const { id: _, ...metaData } = targetJob;

            const historyItem = {
                stage: newStage,
                staffName: staffName,
                timestamp: Date.now()
            };

            const updatedHistory = Array.isArray(targetJob.history)
                ? [...targetJob.history, historyItem]
                : [historyItem];

            const currentStatus = (typeof targetJob.status === 'object' && targetJob.status !== null)
                ? targetJob.status
                : { waiting: false, disassembly: false, plating_release: false, assembly_wait: false, complete: false };

            const statusOrder = ['waiting', 'disassembly', 'plating_release', 'assembly_wait', 'complete'];
            const newStageIndex = statusOrder.indexOf(newStage);
            const updatedStatus = { ...currentStatus };

            if (newStage === 'complete' || newStage === '생산완료') {
                statusOrder.forEach(key => updatedStatus[key] = true);
                updatedStatus.complete = true;
                updatedStatus.생산완료 = true;
            } else if (newStageIndex !== -1) {
                for (let i = 0; i <= newStageIndex; i++) {
                    updatedStatus[statusOrder[i]] = true;
                }
            } else {
                updatedStatus[newStage] = true;
            }

            updatedStatus.lastUpdated = new Date().toISOString();

            const updateData = {
                ...metaData,
                stage: newStage,
                status: updatedStatus,
                updatedAt: Date.now(),
                history: updatedHistory
            };

            try {
                // 실제 Firebase 업데이트
                await update(ref(rtdb, `processes/${id}`), updateData);

                // [변경된 로직]
                // 기존의 notifyProcessChange 직접 호출을 제거했습니다.
                // 이제 onValue 리스너가 DB 변경을 감지하여 자동으로 알림을 보냅니다.
                // 이를 통해 다른 클라이언트(다른 사용자)에게도 브로드캐스트가 가능해집니다.

                // 그룹 업데이트 (한 번만 호출될 때 자동 연동)
                if (groupId && !Array.isArray(targetIds)) {
                    const groupJobs = jobs.filter(j => j.groupId === groupId && j.id !== id);
                    for (const gJob of groupJobs) {
                        const { id: gId, ...gMeta } = gJob;
                        const gHistory = Array.isArray(gJob.history)
                            ? [...gJob.history, historyItem]
                            : [historyItem];

                        const gCurrentStatus = (typeof gJob.status === 'object' && gJob.status !== null)
                            ? gJob.status
                            : { waiting: false, disassembly: false, plating_release: false, assembly_wait: false, complete: false };

                        const gUpdatedStatus = { ...gCurrentStatus };

                        if (newStage === 'complete' || newStage === '생산완료') {
                            statusOrder.forEach(key => gUpdatedStatus[key] = true);
                            gUpdatedStatus.complete = true;
                            gUpdatedStatus.생산완료 = true;
                        } else if (newStageIndex !== -1) {
                            for (let i = 0; i <= newStageIndex; i++) {
                                gUpdatedStatus[statusOrder[i]] = true;
                            }
                        } else {
                            gUpdatedStatus[newStage] = true;
                        }

                        const gUpdateData = {
                            ...gMeta,
                            stage: newStage,
                            status: gUpdatedStatus,
                            updatedAt: Date.now(),
                            history: gHistory
                        };
                        await update(ref(rtdb, `processes/${gId}`), gUpdateData);
                    }
                }
            } catch (error) {
                console.error(`❌ Update Failed for ${id}:`, error);
                setError("상태 업데이트 실패: " + error.message);
            }
        }
    };

    return {
        jobs,
        deletedJobs,
        loading,
        error,
        addJob,
        editJob,
        deleteJob,
        restoreJob,
        permanentDeleteJob,
        clearDeletedJobs,
        resetJobs,
        updateJobStatus
    };
}
