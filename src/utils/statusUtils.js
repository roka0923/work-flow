export const statusKeys = ['waiting', 'disassembly', 'plating_release', 'assembly_wait', 'complete'];

export const STAGES = [
    { key: 'new_added', label: '신규추가', color: '#60a5fa' },
    { key: 'waiting', label: '분해대기', color: '#f59e0b' },
    { key: 'disassembly', label: '분해완료', color: '#10b981' },
    { key: 'plating_release', label: '도금출고', color: '#8b5cf6' },
    { key: 'assembly_wait', label: '조립대기', color: '#06b6d4' },
    { key: 'complete', label: '생산완료', color: '#22c55e' }
];

export const getJobStage = (job) => {
    // 1. 상태 객체가 없는 경우
    if (!job || !job.status) return 'new_added';

    // 2. 모든 공정이 완료된 경우
    if (job.status.complete) return 'complete';

    // 3. 첫 번째 미완료 공정 찾기 (이 공정의 '대기' 상태로 간주)
    const firstIncompleteIndex = statusKeys.findIndex(key => !job.status[key]);

    // 4. 모든 상태가 false인 경우 (새로 추가된 상태)
    if (firstIncompleteIndex === 0 && Object.values(job.status).every(v => v === false)) {
        return 'new_added';
    }

    // 5. 중간 단계가 미완료라면 해당 단계가 현재 단계
    if (firstIncompleteIndex !== -1) {
        return statusKeys[firstIncompleteIndex];
    }

    return 'complete';
};
