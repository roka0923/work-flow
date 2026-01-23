import { ref, get } from 'firebase/database';
import { rtdb } from '../firebase/config';

export const debugFirebaseStructure = async () => {
    console.log('====================================');
    console.log('=== Firebase 데이터 구조 확인 ===');
    console.log('====================================');

    try {
        const processesRef = ref(rtdb, 'processes');
        const snapshot = await get(processesRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('📊 전체 processes 데이터:', data);
            console.log('📊 processes 키 목록:', Object.keys(data));

            // 각 프로세스 상세 정보
            Object.entries(data).forEach(([key, value]) => {
                console.log(`\n📋 Process: ${key}`);
                console.log('  - productNumber:', value.productNumber);
                console.log('  - productName:', value.productName);
                console.log('  - stage:', value.stage);
                console.log('  - groupId:', value.groupId);
                console.log('  - side:', value.side);
                console.log('  - 전체 필드:', Object.keys(value));
            });

            // undefined 키 확인
            if (data['undefined']) {
                console.error('⚠️ 경고: "undefined" 키가 존재합니다!');
                console.error('⚠️ undefined 키의 데이터:', data['undefined']);
            }

        } else {
            console.log('📊 processes 데이터가 비어있습니다');
        }

    } catch (error) {
        console.error('❌ Firebase 데이터 확인 실패:', error);
    }

    console.log('====================================');
};
