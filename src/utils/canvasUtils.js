export const getPointerCoords = (event, canvas) => {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

export const distanceSq = (p1, p2) =>
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

export const getStrokeAtPoint = (point, history) => {
    for (let i = history.length - 1; i >= 0; i--) {
        const path = history[i];
        const threshold = Math.pow(path.strokeWidth / 2 + 5, 2);
        for (const p of path.points) {
            if (distanceSq(p, point) < threshold) {
                return path;
            }
        }
    }
    return null;
};

export const getGroupBoundingBox = (strokeIds, history) => {
    if (strokeIds.length === 0) return null;
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

    strokeIds.forEach((id) => {
        const path = history.find((p) => p.id === id);
        if (path && path.points.length > 0) {
            path.points.forEach((p) => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
        }
    });

    if (isFinite(minX)) {
        const padding = 10;
        return {
            minX: minX - padding,
            minY: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        };
    }
    return null;
};

export const isPointInRect = (point, rect) => {
    if (!rect) return false;
    return (
        point.x >= rect.minX &&
        point.x <= rect.minX + rect.width &&
        point.y >= rect.minY &&
        point.y <= rect.minY + rect.height
    );
};

export const isPointInPolygon = (point, polygon) => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x,
            yi = polygon[i].y;
        const xj = polygon[j].x,
            yj = polygon[j].y;
        const intersect =
            yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersect) isInside = !isInside;
    }
    return isInside;
};
