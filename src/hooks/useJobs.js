import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, push, update, remove, serverTimestamp, get } from 'firebase/database';
import { rtdb, auth, db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
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
            // Initial History Entry
            const initialHistory = [{
                stage: 'new_added',
                staffName: jobData.author || '시스템',
                timestamp: Date.now(),
                note: jobData.memo || '작업 요청 등록'
            }];

            // LH+RH 세트인 경우 (요청 사항 반영)
            if (jobData.addBothSides) {
                const groupId = `group_${Date.now()}`;
                const { addBothSides: _, quantityL, quantityR, ...pureData } = jobData;

                // LH 추가
                const lhRef = push(ref(rtdb, 'processes'));
                await set(lhRef, {
                    ...pureData,
                    quantity: quantityL || pureData.quantity || 1,
                    id: lhRef.key,
                    groupId: groupId,
                    side: 'LH',
                    history: initialHistory,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                // RH 추가
                const rhRef = push(ref(rtdb, 'processes'));
                await set(rhRef, {
                    ...pureData,
                    quantity: quantityR || pureData.quantity || 1,
                    id: rhRef.key,
                    groupId: groupId,
                    side: 'RH',
                    history: initialHistory,
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
                        history: initialHistory,
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
                    history: initialHistory,
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

    const deleteJob = async (targetIds, staffName = '시스템') => {
        try {
            const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
            const deletedItems = [];

            for (const id of ids) {
                const jobToDelete = jobs.find(j => j.id === id);
                if (jobToDelete) {
                    // Move to deleted_processes
                    const deletedRef = ref(rtdb, `deleted_processes/${id}`);
                    const { id: _, ...dataToSave } = jobToDelete;
                    const deletedAt = new Date().toISOString();

                    await set(deletedRef, {
                        ...dataToSave,
                        deletedAt: deletedAt,
                        deletedBy: staffName
                    });

                    // Remove from processes
                    await remove(ref(rtdb, `processes/${id}`));

                    deletedItems.push({ ...jobToDelete, deletedAt, deletedBy: staffName });
                }
            }

            // Email Notification Logic (Firebase Extension Pattern)
            if (deletedItems.length > 0) {
                try {
                    // 1. Fetch Admin Emails
                    const q = query(collection(db, "users"), where("role", "==", "admin"));
                    const querySnapshot = await getDocs(q);
                    const adminEmails = querySnapshot.docs.map(doc => doc.data().email).filter(email => email);

                    if (adminEmails.length > 0) {
                        // 2. Create Email Content
                        const emailBody = deletedItems.map(item => `
                            <li>
                                <strong>모델:</strong> ${item.model} (${item.code})<br/>
                                <strong>수량:</strong> ${item.quantity}<br/>
                                <strong>삭제자:</strong> ${staffName}<br/>
                                <strong>삭제일시:</strong> ${new Date().toLocaleString()}
                            </li>
                        `).join('');

                        // 3. Write to 'mail' collection (Trigger Email Extension)
                        await addDoc(collection(db, "mail"), {
                            to: adminEmails,
                            message: {
                                subject: `[작업삭제알림] ${deletedItems.length}건의 작업이 삭제되었습니다.`,
                                html: `
                                    <h2>작업 삭제 알림</h2>
                                    <p>다음 작업이 삭제되었습니다:</p>
                                    <ul>${emailBody}</ul>
                                    <p>시스템에 의해 자동 발송된 메일입니다.</p>
                                `
                            }
                        });
                        // console.log(`📧 Email trigger created for admins: ${adminEmails.join(', ')}`);
                    } else {
                        // console.warn("⚠️ No admin emails found. Email notification skipped.");
                    }
                } catch (emailErr) {
                    console.error("Failed to send email notification:", emailErr);
                    // Do not block delete operation on email failure
                }
            }

        } catch (err) {
            setError("데이터 삭제 중 오류가 발생했습니다.");
            console.error(err);
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

    const updateJobStatus = async (targetIds, newStage, staffName = '시스템', updatesMap = {}) => {
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

            // 개별 업데이트 데이터 병합 (수량 변경 등)
            const specificUpdate = updatesMap[id] || {};

            const updateData = {
                ...metaData,
                ...specificUpdate, // 여기서 덮어쓰기 (예: quantity)
                stage: newStage,
                status: updatedStatus,
                updatedAt: Date.now(),
                history: updatedHistory
            };

            console.log(`[updateJobStatus] Updating ${id} to ${newStage}`, updateData);

            try {
                // 실제 Firebase 업데이트
                await update(ref(rtdb, `processes/${id}`), updateData);

                // 그룹 업데이트 (한 번만 호출될 때 자동 연동)
                // 주의: updatesMap에 있는 수량 변경은 해당 ID에만 적용되어야 하므로 그룹 전파 시에는 제외하거나, 
                // 해당 그룹 멤버의 ID로 updatesMap에 정의되어 있어야 함.
                // 여기서는 그룹 멤버 자동 업데이트 로직이 "같은 그룹의 다른 멤버도 동일 단계로 이동"시키는 편의 기능임.
                // 만약 수량 변경이 필요한 경우라면, caller(ProcessList)에서 targetIds에 그룹원을 모두 포함시켜서 호출하는 것이 안전함.
                // 따라서 targetIds에 포함되지 않은 그룹 멤버는 "상태만" 동기화됨.

                if (groupId && !Array.isArray(targetIds)) { // targetIds가 단일일 때만 자동 그룹 연동 (기존 로직 유지)
                    // 하지만 이번 기능(수량 변경)은 명시적으로 targetIds를 다 넘길 예정이므로 이 블록은 "수량 변경 없는 단순 이동"에만 주로 작동할 것임.
                    const groupJobs = jobs.filter(j => j.groupId === groupId && j.id !== id);
                    for (const gJob of groupJobs) {
                        const { id: gId, ...gMeta } = gJob;

                        // 이미 메인 루프에서 처리될 예정인 ID라면 건너뛰기
                        if (ids.includes(gId)) continue;

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

    /**
     * 작업을 분할하여 다음 공정으로 이동
     * @param {string|string[]} targetIds - 대상 Job ID (단일 또는 배열)
     * @param {number} splitQuantity - 이동할 수량
     * @param {string} nextStage - 이동할 다음 단계 Key
     * @param {string} staffName - 담당자
     */
    const splitAndMoveJob = async (targetIds, splitQuantity, nextStage, staffName = '시스템') => {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        const groupId = `group_${Date.now()}_split`; // 분할된 항목끼리 묶기 위한 새 그룹 ID
        const isQtyMap = typeof splitQuantity === 'object';

        for (const id of ids) {
            const originalJob = jobs.find(j => j.id === id);
            if (!originalJob) continue;

            const qtyToMove = isQtyMap ? (splitQuantity[id] || 0) : splitQuantity;
            if (qtyToMove <= 0) continue;

            try {
                // 1. 원본 수량 업데이트 (차감)
                const newOriginalQty = (originalJob.quantity || 1) - qtyToMove;
                if (newOriginalQty <= 0) {
                    // 수량이 0 이하라면 분할이 아닌 전체 이동으로 처리
                    await updateJobStatus([id], nextStage, staffName);
                    continue;
                }

                await update(ref(rtdb, `processes/${id}`), {
                    quantity: newOriginalQty,
                    updatedAt: serverTimestamp()
                });

                // 2. 새 작업 생성 (분할된 수량만큼)
                const { id: _, groupId: oldGroupId, ...jobData } = originalJob;

                // 새 히스토리 레코드
                const historyItem = {
                    stage: nextStage,
                    staffName: staffName,
                    timestamp: Date.now(),
                    note: `분할됨 (원본에서 ${qtyToMove}개 이동)`
                };

                // 기존 히스토리 복사 + 새 히스토리 추가
                const newHistory = Array.isArray(originalJob.history)
                    ? [...originalJob.history, historyItem]
                    : [historyItem];

                // 새 상태 객체 생성 (다음 단계 적용)
                const statusOrder = ['waiting', 'disassembly', 'plating_release', 'assembly_wait', 'complete'];
                const newStageIndex = statusOrder.indexOf(nextStage);
                const newStatus = { ...originalJob.status };

                if (nextStage === 'complete') {
                    statusOrder.forEach(key => newStatus[key] = true);
                    newStatus.complete = true;
                } else if (newStageIndex !== -1) {
                    for (let i = 0; i <= newStageIndex; i++) {
                        newStatus[statusOrder[i]] = true;
                    }
                } else {
                    newStatus[nextStage] = true;
                }
                newStatus.lastUpdated = new Date().toISOString();

                // 새 ID로 저장
                const newJobRef = push(ref(rtdb, 'processes'));
                await set(newJobRef, {
                    ...jobData,
                    id: newJobRef.key,
                    quantity: qtyToMove,
                    stage: nextStage,
                    status: newStatus,
                    groupId: groupId, // 분할된 것들끼리 새 그룹 형성 (LH/RH 세트 유지를 위해)
                    history: newHistory,
                    createdAt: originalJob.createdAt, // 생성일은 원본 유지
                    updatedAt: serverTimestamp(),
                    parentJobId: id // 원본 추적용
                });

            } catch (err) {
                console.error(`Split Failed for ${id}:`, err);
                setError("작업 분할 중 오류가 발생했습니다.");
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
        resetJobs,
        updateJobStatus,
        splitAndMoveJob
    };
}
