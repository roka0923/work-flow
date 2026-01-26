import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import StatCard from './dashboard/StatCard';
import QueueCard from './dashboard/QueueCard';
import { statusKeys, STAGES, getJobStage, groupJobs } from '../utils/statusUtils';
import versionInfo from '../config/version.json';

export default function Dashboard({ jobs, onStageClick }) {

    const groupedJobs = groupJobs(jobs);

    const activeJobs = groupedJobs.filter(g => !g.complete).length;
    const completedJobs = groupedJobs.filter(g => g.complete).length;
    const urgentJobs = groupedJobs.filter(g => g.urgent && !g.complete).length;

    const getStageStats = (stageKey) => {
        return groupedJobs.filter(g => {
            if (stageKey === 'complete') return g.complete;
            return !g.complete && g.currentStage === stageKey;
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

            <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '11px', opacity: 0.7 }}>
                v{versionInfo.version} ({versionInfo.lastUpdated})
            </div>
        </div>
    );
}
