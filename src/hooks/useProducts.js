import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // 인증 상태 감시 (보안 규칙 대응)
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setIsAuthReady(!!user);
            if (!user) {
                setProducts([]);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!isAuthReady) return;

        setLoading(true);
        // Load only domestic products from Firestore
        const q = query(
            collection(db, 'products'),
            where('origin', '==', '국산')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const productsArray = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        // 기존 앱과의 호환성을 위해 필드명 매핑 (한글 -> 영어)
                        code: data.code || data['코드'] || data['품목코드'] || doc.id,
                        model: data.model || data['모델명'] || data['품목명'] || ''
                    };
                });
                setProducts(productsArray);
                setLoading(false);
                setError(null);
            } catch (err) {
                console.error("Firestore Products Read Error:", err);
                setError("품목 정보를 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
            }
        }, (err) => {
            console.error("Firestore Products Subscription Error:", err);
            // 인증이 풀린 상태라면 에러 표시 지양
            if (auth.currentUser) {
                setError(err.message);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady]);

    const searchProducts = (query) => {
        if (!query || query.trim() === '') return [];
        const lowerQuery = query.toLowerCase();

        // Fast filtering from local cache
        return products.filter(p =>
            p.model?.toLowerCase().includes(lowerQuery) ||
            p.code?.includes(lowerQuery)
        ).slice(0, 50); // Limit to 50 results for UI performance
    };

    return { products, loading, error, searchProducts };
};
