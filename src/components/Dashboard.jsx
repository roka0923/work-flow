import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import StatCard from './dashboard/StatCard';
import QueueCard from './dashboard/QueueCard';
import { statusKeys, STAGES, getJobStage } from '../utils/statusUtils';

export default function Dashboard({ jobs, onStageClick }) {

    // Group jobs by groupId (falling back to id)
    const groupedJobs = [];
    const groupMap = new Map();

    jobs.forEach(job => {
        const key = job.groupId || job.id;
        const stage = getJobStage(job);

        if (!groupMap.has(key)) {
            const group = {
                key,
                items: [job],
                urgent: job.urgent || false,
                complete: job.status?.complete || false,
                minStage: stage,
                minStageIndex: statusKeys.indexOf(stage) === -1 ? -1 : statusKeys.indexOf(stage)
            };
            groupMap.set(key, group);
            groupedJobs.push(group);
        } else {
            const g = groupMap.get(key);
            g.items.push(job);
            if (job.urgent) g.urgent = true;
            if (!job.status?.complete) g.complete = false;

            // 그룹의 단계는 구성 요소 중 가장 뒤처진 단계를 따름 (예: 하나라도 분해대기면 그룹 전체가 분해대기)
            const currentStageIndex = statusKeys.indexOf(stage);
            if (currentStageIndex !== -1 && (g.minStageIndex === -1 || currentStageIndex < g.minStageIndex)) {
                g.minStageIndex = currentStageIndex;
                g.minStage = stage;
            } else if (stage === 'new_added' && g.minStage !== 'new_added') {
                // 신규추가는 statusKeys에 없으므로 별도 처리 (-1 인덱스)
                g.minStage = 'new_added';
                g.minStageIndex = -1;
            }
        }
    });

    const activeJobs = groupedJobs.filter(g => !g.complete).length;
    const completedJobs = groupedJobs.filter(g => g.complete).length;
    const urgentJobs = groupedJobs.filter(g => g.urgent && !g.complete).length;

    const stages = [
        { key: 'new_added', label: '신규추가', color: '#60a5fa' },
        { key: 'waiting', label: '분해대기', color: '#f59e0b' },
        { key: 'disassembly', label: '분해완료', color: '#10b981' },
        { key: 'plating_release', label: '도금출고', color: '#8b5cf6' },
        { key: 'assembly_wait', label: '조립대기', color: '#06b6d4' },
        { key: 'complete', label: '생산완료', color: '#22c55e' }
    ];

    const getStageStats = (stageKey) => {
        return groupedJobs.filter(g => {
            const finalStage = (g.minStage === undefined) ? 'new_added' : g.minStage;
            return finalStage === stageKey;
        }).length;
    };

    return (
        <div className="animate-fade-in">
            <h1>생산 현황판</h1>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <StatCard
                    icon={Activity}
                    label="진행 중"
                    value={activeJobs}
                    color="var(--primary)"
                />
                <StatCard
                    icon={CheckCircle2}
                    label="완료"
                    value={completedJobs}
                    color="var(--success)"
                    onClick={() => onStageClick('finished')}
                />
                <StatCard
                    icon={AlertTriangle}
                    label="긴급"
                    value={urgentJobs}
                    color="var(--danger)"
                    isUrgent={urgentJobs > 0}
                    onClick={() => onStageClick('urgent')}
                />
            </div>

            {/* Process Queue */}
            <h2 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} /> 공정별 대기 현황 (클릭하여 확인)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {STAGES.map((stage) => {
                    const count = getStageStats(stage.key);
                    const percentage = groupedJobs.length > 0 ? (count / groupedJobs.length) * 100 : 0;
                    return (
                        <QueueCard
                            key={stage.key}
                            stage={stage}
                            count={count}
                            percentage={percentage}
                            onClick={() => onStageClick(stage.key)}
                        />
                    );
                })}
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(34, 211, 238, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 211, 238, 0.1)' }}>
                <div style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '4px', fontWeight: 'bold' }}>TIP</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    상세 확인을 원하는 공정 카드를 클릭하면 해당 단계의 품목들을 모아서 보실 수 있습니다.
                </div>
            </div>
        </div>
    );
}
