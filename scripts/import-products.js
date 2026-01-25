import admin from 'firebase-admin';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

// 1. Firebase Admin 초기화
const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. 설정
const IMPORT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlTF7DfsEa4BDoP9jHOKUEfS6SZjg9UTil4ExsThrohjkgLXgjBAMrRpkdtPfQQRMazQJrm4tjlbW/pub?output=csv';
const DOMESTIC_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlTF7DfsEa4BDoP9jHOKUEfS6SZjg9UTil4ExsThrohjkgLXgjBAMrRpkdtPfQQRMazQJrm4tjlbW/pub?gid=37719916&output=csv';

async function cleanupDomesticProducts() {
    console.log('🧹 기존 국산 제품 데이터를 삭제합니다...');
    const collectionRef = db.collection('products');
    const snapshot = await collectionRef.where('origin', '==', '국산').get();

    if (snapshot.empty) {
        console.log('삭제할 국산 데이터가 없습니다.');
        return;
    }

    const batchSize = 500;
    let totalDeleted = 0;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += chunk.length;
        console.log(`삭제 진행률: ${totalDeleted}/${docs.length} 삭제 완료`);
    }
    console.log('✅ 기존 국산 데이터 삭제 완료');
}

async function fetchAndParseCSV(url, origin) {
    console.log(`[${origin}] 데이터 다운로드 중...`);
    const response = await axios.get(url);
    const csvData = response.data;

    console.log(`[${origin}] 데이터 파싱 중...`);
    const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    return records.map(record => ({
        ...record,
        origin: origin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));
}

async function uploadToFirestore(products) {
    const collectionRef = db.collection('products');
    const batchSize = 500;
    let totalUploaded = 0;

    for (let i = 0; i < products.length; i += batchSize) {
        const batch = db.batch();
        const chunk = products.slice(i, i + batchSize);

        chunk.forEach(product => {
            // 원산지에 따라 다른 ID 필드 사용
            let docId;
            if (product.origin === '수입') {
                docId = product['품목코드'];
            } else {
                docId = product['코드']; // 국산 시트는 '코드'가 A열
            }

            if (!docId) {
                docId = `PROD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                console.warn(`[경고] ID 필드가 없어 임시 ID를 생성했습니다: ${docId}`, product);
            }

            const docRef = collectionRef.doc(docId);
            batch.set(docRef, product);
        });

        await batch.commit();
        totalUploaded += chunk.length;
        console.log(`업로드 진행률: ${totalUploaded}/${products.length} 업로드 완료`);
    }
}

async function main() {
    try {
        console.log('🚀 작업을 시작합니다...');

        // 1. 기존 국산 데이터 삭제
        await cleanupDomesticProducts();

        // 2. 새로운 데이터 로드
        const importData = await fetchAndParseCSV(IMPORT_URL, '수입');
        const domesticData = await fetchAndParseCSV(DOMESTIC_URL, '국산');

        // 3. 수입 데이터는 업데이트(덮어쓰기), 국산 데이터는 재삽입
        console.log(`수입 데이터: ${importData.length}개 처리 준비`);
        console.log(`국산 데이터: ${domesticData.length}개 처리 준비`);

        await uploadToFirestore([...importData, ...domesticData]);

        console.log('✅ 모든 작업이 성공적으로 완료되었습니다!');
        process.exit(0);
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

main();
