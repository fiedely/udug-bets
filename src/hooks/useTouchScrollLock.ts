import { useEffect } from 'react';
import type { RefObject } from 'react';

export const useTouchScrollLock = (containerRef: RefObject<HTMLElement | null>, isActive: boolean = true) => {
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !isActive) return;

        const touchState = {
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            isAxisLocked: false,
            lockedAxis: null as 'x' | 'y' | null,
            velocityX: 0,
            velocityY: 0,
            lastTime: 0,
            rafId: 0
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            e.stopPropagation();
            
            cancelAnimationFrame(touchState.rafId);
            
            touchState.startX = e.touches[0].clientX;
            touchState.startY = e.touches[0].clientY;
            touchState.lastX = e.touches[0].clientX;
            touchState.lastY = e.touches[0].clientY;
            touchState.isAxisLocked = false;
            touchState.lockedAxis = null;
            touchState.velocityX = 0;
            touchState.velocityY = 0;
            touchState.lastTime = Date.now();
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            e.stopPropagation();
            
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const now = Date.now();
            const dt = now - touchState.lastTime;
            
            if (!touchState.isAxisLocked) {
                const dx = Math.abs(currentX - touchState.startX);
                const dy = Math.abs(currentY - touchState.startY);
                
                if (dx > 5 || dy > 5) {
                    touchState.isAxisLocked = true;
                    touchState.lockedAxis = dx > dy ? 'x' : 'y';
                    touchState.lastX = currentX;
                    touchState.lastY = currentY;
                    touchState.lastTime = now;
                }
            } else {
                if (e.cancelable) e.preventDefault();
                
                if (touchState.lockedAxis === 'x') {
                    const dx = currentX - touchState.lastX;
                    container.scrollLeft -= dx;
                    if (dt > 0) touchState.velocityX = dx / dt;
                } else {
                    const dy = currentY - touchState.lastY;
                    container.scrollTop -= dy;
                    if (dt > 0) touchState.velocityY = dy / dt;
                }
                
                touchState.lastX = currentX;
                touchState.lastY = currentY;
                touchState.lastTime = now;
            }
        };

        const handleTouchEnd = () => {
            const now = Date.now();
            
            if (now - touchState.lastTime > 50) {
                touchState.velocityX = 0;
                touchState.velocityY = 0;
            }

            let vx = touchState.velocityX;
            let vy = touchState.velocityY;
            const friction = 0.95;

            const animate = () => {
                if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return;

                if (touchState.lockedAxis === 'x') {
                    container.scrollLeft -= vx * 16;
                    vx *= friction;
                } else if (touchState.lockedAxis === 'y') {
                    container.scrollTop -= vy * 16;
                    vy *= friction;
                }

                touchState.rafId = requestAnimationFrame(animate);
            };

            if (touchState.isAxisLocked) {
                touchState.rafId = requestAnimationFrame(animate);
            }
        };

        // passive: false allows e.preventDefault()
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            cancelAnimationFrame(touchState.rafId);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [containerRef, isActive]);
};
