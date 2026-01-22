import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import StatCard from './dashboard/StatCard';
import QueueCard from './dashboard/QueueCard';

export default function Dashboard({ jobs, onStageClick }) {
    const statusKeys = ['waiting', 'disassembly', 'plating_release', 'assembly_wait', 'complete'];

    const getJobStage = (job) => {
        if (statusKeys.every(key => !job.status[key])) return 'new_added';
        const lastCheckedIndex = statusKeys.map(k => job.status[k]).lastIndexOf(true);
        return statusKeys[lastCheckedIndex] || 'new_added';
    };

    // Group jobs by groupId (falling back to id)
    const groupedJobs = [];
    const groupMap = new Map();

    jobs.forEach(job => {
        const key = job.groupId || job.id;
        if (!groupMap.has(key)) {
            const group = {
                key,
                items: [],
                urgent: false,
                complete: job.status.complete,
                stage: getJobStage(job)
            };
            groupMap.set(key, group);
            groupedJobs.push(group);
        }
        const g = groupMap.get(key);
        g.items.push(job);
        if (job.urgent) g.urgent = true;
        // If any item in group is not complete, the group is not complete
        if (!job.status.complete) g.complete = false;
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
        return groupedJobs.filter(g => g.stage === stageKey).length;
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
                {stages.map((stage) => {
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
