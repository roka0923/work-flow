import { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, remove, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';

export function useJobs() {
    const [jobs, setJobs] = useState([]);
    const [deletedJobs, setDeletedJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Read jobs from Firebase
    useEffect(() => {
        const jobsRef = ref(rtdb, 'processes');
        const unsubscribe = onValue(jobsRef, (snapshot) => {
            try {
                const data = snapshot.val();
                if (data) {
                    const jobsList = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    setJobs(jobsList);
                } else {
                    setJobs([]);
                }
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

        // Read deleted jobs
        const deletedJobsRef = ref(rtdb, 'deleted_processes');
        const unsubscribeDeleted = onValue(deletedJobsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const deletedList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
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
    }, []);

    const addJob = async (newJobOrJobs) => {
        try {
            const jobsArray = Array.isArray(newJobOrJobs) ? newJobOrJobs : [newJobOrJobs];
            const jobsRef = ref(rtdb, 'processes');

            for (const job of jobsArray) {
                const newJobRef = push(jobsRef);
                await set(newJobRef, {
                    ...job,
                    stage: job.stage || "신규추가",
                    status: job.status || "진행중",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
        } catch (err) {
            console.error("Firebase Add Error:", err);
            setError("데이터 추가 중 오류가 발생했습니다.");
        }
    };

    const editJob = async (jobId, updatedData) => {
        try {
            const jobRef = ref(rtdb, `processes/${jobId}`);
            await update(jobRef, {
                ...updatedData,
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
                    await set(deletedRef, {
                        ...jobToDelete,
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
                const { deletedAt, ...restoredJob } = jobToRestore;
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

    const updateJobStatus = async (targetIds, stage, staffName) => {
        try {
            const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
            for (const id of ids) {
                const job = jobs.find(j => j.id === id);
                if (job) {
                    const isCompleting = !job.status[stage];
                    const jobRef = ref(rtdb, `processes/${id}`);

                    const updates = {};
                    updates[`status/${stage}`] = isCompleting;
                    updates['updatedAt'] = serverTimestamp();

                    if (isCompleting) {
                        const newHistory = [...(job.history || []), {
                            stage,
                            staffName,
                            timestamp: new Date().toISOString()
                        }];
                        updates['history'] = newHistory;
                        // 만약 요청하신 stage 데이터 구조를 명시적으로 쓰고 싶다면 여기서 stage 업데이트 가능
                        updates['stage'] = stage;
                    }

                    await update(jobRef, updates);
                }
            }
        } catch (err) {
            setError("상태 업데이트 중 오류가 발생했습니다.");
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
