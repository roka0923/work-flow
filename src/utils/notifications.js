// 브라우저 알림 권한 요청
export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
        console.log("이 브라우저는 알림을 지원하지 않습니다.");
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
        const notification = new Notification(title, {
            icon: "/daehansa logo workflow.png",
            badge: "/daehansa logo workflow.png",
            vibrate: [200, 100, 200],
            ...options,
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        return notification;
    }
};

// 공정 변경 알림
export const notifyProcessChange = (product, fromStage, toStage, worker) => {
    const stages = {
        disassembly: "분해",
        plating: "도금",
        assembly: "조립",
        inspection: "검사",
        shipping: "출고",
    };

    showNotification("🔔 공정 변경 알림", {
        body: `${product}\n${stages[fromStage]} → ${stages[toStage]}\n담당: ${worker}`,
        tag: "process-change",
        requireInteraction: false,
    });
};
