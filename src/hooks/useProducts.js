import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Load only domestic products from Firestore
        const q = query(
            collection(db, 'products'),
            where('origin', '==', '국산')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const productsArray = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setProducts(productsArray);
                setLoading(false);
            } catch (err) {
                console.error("Firestore Products Read Error:", err);
                setError("품목 정보를 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
            }
        }, (err) => {
            console.error("Firestore Products Subscription Error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
