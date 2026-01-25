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

    // 2. 모든 공정이 완료된 경우 (별도 플래그 확인)
    if (job.status.complete) return 'complete';

    // 3. 역순으로 확인하여 가장 먼저 'true'인 상태를 반환 (현재 도달한 단계)
    const processKeys = ['waiting', 'disassembly', 'plating_release', 'assembly_wait'];

    // 배열 뒤에서부터 확인
    for (let i = processKeys.length - 1; i >= 0; i--) {
        const key = processKeys[i];
        if (job.status[key]) {
            return key;
        }
    }

    // 4. 아무것도 true가 아니면 신규추가
    return 'new_added';
};

/**
 * 작업을 그룹화하고 그룹의 현재 단계를 결정합니다.
 * 세트 제품(LH+RH)은 더 느린 공정 단계를 기준으로 그룹의 단계가 결정됩니다.
 */
export const groupJobs = (jobs) => {
    const groupMap = new Map();
    const groupedJobs = [];

    jobs.forEach(job => {
        const key = job.groupId || job.id;
        const stage = getJobStage(job);

        if (!groupMap.has(key)) {
            const group = {
                key,
                id: job.id, // 대표 ID
                code: job.code,
                model: job.model,
                base: job.model.replace(/\s+(LH|RH)$/i, '').trim(),
                items: [job],
                urgent: job.urgent || false,
                complete: job.status?.complete || false,
                requestDate: job.requestDate,
                memo: job.memo || '',
                currentStage: stage,
                stageIndex: stage === 'new_added' ? -1 : (stage === 'complete' ? 99 : statusKeys.indexOf(stage))
            };
            groupMap.set(key, group);
            groupedJobs.push(group);
        } else {
            const g = groupMap.get(key);
            g.items.push(job);
            if (job.urgent) g.urgent = true;
            if (!job.status?.complete) g.complete = false;
            if (job.requestDate && (!g.requestDate || new Date(job.requestDate) < new Date(g.requestDate))) {
                g.requestDate = job.requestDate;
            }
            if (job.memo && !g.memo.includes(job.memo)) {
                g.memo = g.memo ? `${g.memo}\n${job.memo}` : job.memo;
            }

            // 그룹의 단계 결정 (가장 느린 단계 기준)
            const stageIndex = stage === 'new_added' ? -1 : (stage === 'complete' ? 99 : statusKeys.indexOf(stage));
            if (stageIndex < g.stageIndex) {
                g.stageIndex = stageIndex;
                g.currentStage = stage;
            }
        }
    });

    return groupedJobs;
};
