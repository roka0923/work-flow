// 브라우저 알림 권한 요청
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        console.log("브라우저가 알림을 지원하지 않습니다");
        return false;
    }

    if (Notification.permission === "granted") {
        return true;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        return permission === "granted";
    }

    return false;
};

// 알림 표시 함수
export const showNotification = (title, options = {}) => {
    if (Notification.permission === "granted") {
        const config = {
            icon: "/daehansa logo workflow.png",
            badge: "/daehansa logo workflow.png",
            vibrate: [200, 100, 200],
            ...options,
        };

        // 모바일(Android) 등에서는 ServiceWorker를 통한 알림만 허용되는 경우가 있음
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, config);
            }).catch(err => {
                console.warn('SW Notification failed, trying fallback:', err);
                try {
                    // PC 등 SW 실패 시 일반 Notification 시도
                    const notification = new Notification(title, config);
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                } catch (e) {
                    console.error('Notification constructor failed:', e);
                }
            });
        } else {
            // ServiceWorker가 없는 환경
            try {
                const notification = new Notification(title, config);
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
            } catch (e) {
                console.error('Notification constructor failed:', e);
            }
        }
    }
};

// 공정 변경 알림
export const notifyProcessChange = (modelName, fromStage, toStage, assignee) => {
    showNotification("🔔 공정 변경 알림", {
        body: `${modelName}\n${fromStage} → ${toStage}\n담당: ${assignee}`,
        tag: "process-change",
        requireInteraction: false,
    });
};
