import { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, remove, serverTimestamp, get } from 'firebase/database';
import { rtdb, auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { notifyProcessChange } from '../utils/notifications';

export function useJobs() {
    const [jobs, setJobs] = useState([]);
    const [deletedJobs, setDeletedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();

    // Read jobs from Firebase (Only when authenticated)
    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            setJobs([]);
            setDeletedJobs([]);
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
                    }).sort((a, b) => {
                        const timeA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt).getTime() || 0);
                        const timeB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt).getTime() || 0);
                        return timeB - timeA;
                    });
                    setJobs(jobsList);
                } else {
                    setJobs([]);
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

                // 공정 변경 알림 표시
                const job = jobs.find(j => j.id === id);
                if (job && job.stage !== newStage) {
                    notifyProcessChange(
                        job.product || '제품',
                        job.stage,
                        newStage,
                        auth.currentUser?.displayName || auth.currentUser?.email || '담당자'
                    );
                }

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
