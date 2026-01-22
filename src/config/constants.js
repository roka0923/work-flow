export const STAGES = {
    NEW: '신규추가',
    DISASSEMBLE: '분해대기',
    PLATING: '도금완료',
    ASSEMBLY: '조립대기',
    READY: '배송준료',
    COMPLETED: '완료'
};

export const STAGE_ORDER = ['NEW', 'DISASSEMBLE', 'PLATING', 'ASSEMBLY', 'READY', 'COMPLETED'];

export const PRIORITIES = {
    URGENT: '긴급',
    STANDARD: '표준'
};

export const LOCAL_STORAGE_KEYS = {
    JOBS: 'caliper-jobs',
    DELETED_JOBS: 'caliper-deleted-jobs',
    STAFF: 'caliper-staff'
};

export const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
