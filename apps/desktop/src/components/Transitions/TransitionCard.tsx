/**
 * TransitionCard — 单个转场效果预览卡片。
 * 支持悬停预览动画（WebGL shader 加速，canvas 2D fallback）、收藏、拖拽到时间线。
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TransitionDefinition } from '@open-factory/editor-core';
import { createWebGLTransitionRenderer, type WebGLTransitionRenderer } from './webgl-transition-renderer';

interface TransitionCardProps {
  definition: TransitionDefinition;
  isFavorite: boolean;
  isHovered: boolean;
  onHover: (type: string | null) => void;
  onToggleFavorite: (type: string) => void;
  onSelect: (type: string) => void;
  onDragStart?: (type: string, e: React.DragEvent) => void;
}

/** 在 canvas 上绘制转场预览动画帧 */
function drawTransitionFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  type: string,
) {
  ctx.clearRect(0, 0, width, height);

  // 背景色 A（暖色）
  const gradientA = ctx.createLinearGradient(0, 0, width, height);
  gradientA.addColorStop(0, '#3b82f6');
  gradientA.addColorStop(1, '#8b5cf6');

  // 背景色 B（冷色）
  const gradientB = ctx.createLinearGradient(0, 0, width, height);
  gradientB.addColorStop(0, '#f97316');
  gradientB.addColorStop(1, '#ef4444');

  const p = Math.max(0, Math.min(1, progress));

  if (type.includes('wipe') || type.includes('push')) {
    const dir = type.includes('left') ? 'left' : type.includes('right') ? 'right' : type.includes('up') ? 'up' : 'down';
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradientB;
    if (dir === 'left') ctx.fillRect(width * (1 - p), 0, width * p, height);
    else if (dir === 'right') ctx.fillRect(0, 0, width * p, height);
    else if (dir === 'up') ctx.fillRect(0, height * (1 - p), width, height * p);
    else ctx.fillRect(0, 0, width, height * p);
  } else if (type.includes('dissolve') || type === 'fade-black' || type.includes('flash')) {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = p;
    ctx.fillStyle = gradientB;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  } else if (type.includes('zoom')) {
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradientB;
    const r = p * Math.max(width, height);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (type.includes('rotate') || type.includes('flip') || type.includes('cube')) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(p * Math.PI * 0.5);
    ctx.scale(1 - p * 0.3, 1 - p * 0.3);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = gradientA;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
    ctx.globalAlpha = p;
    ctx.fillStyle = gradientB;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  } else if (type.includes('glitch') || type.includes('block')) {
    // 像素化效果
    const blockSize = Math.max(4, Math.floor(16 * (1 - p)));
    for (let x = 0; x < width; x += blockSize) {
      for (let y = 0; y < height; y += blockSize) {
        const useA = Math.random() > p;
        ctx.fillStyle = useA ? '#3b82f6' : '#f97316';
        ctx.fillRect(x, y, blockSize, blockSize);
      }
    }
  } else if (type.includes('light-leak')) {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = p;
    ctx.fillStyle = gradientB;
    ctx.fillRect(0, 0, width, height);
    // 光晕
    const glow = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, width * 0.6);
    glow.addColorStop(0, `rgba(255, 255, 200, ${0.6 * Math.sin(p * Math.PI)})`);
    glow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  } else if (type.includes('shape')) {
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = gradientB;
    ctx.save();
    ctx.beginPath();
    if (type.includes('heart')) {
      const cx = width / 2;
      const cy = height / 2;
      const s = p * Math.min(width, height) * 0.5;
      ctx.moveTo(cx, cy + s * 0.7);
      ctx.bezierCurveTo(cx - s, cy - s * 0.3, cx - s * 0.5, cy - s, cx, cy - s * 0.4);
      ctx.bezierCurveTo(cx + s * 0.5, cy - s, cx + s, cy - s * 0.3, cx, cy + s * 0.7);
    } else {
      // star
      const cx = width / 2;
      const cy = height / 2;
      const r = p * Math.min(width, height) * 0.45;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  } else if (type === 'portal') {
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    const r = p * Math.min(width, height) * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = gradientB;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else {
    // 默认 dissolve
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = gradientA;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = p;
    ctx.fillStyle = gradientB;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}

export function TransitionCard({
  definition,
  isFavorite,
  isHovered,
  onHover,
  onToggleFavorite,
  onSelect,
  onDragStart,
}: TransitionCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rendererRef = useRef<WebGLTransitionRenderer | null>(null);
  const [useWebGL, setUseWebGL] = useState(false);

  // 尝试初始化 WebGL 渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createWebGLTransitionRenderer(canvas, definition.type);
    if (renderer) {
      rendererRef.current = renderer;
      setUseWebGL(true);
      // 渲染静态帧
      renderer.render(0.3);
    }
    return () => {
      renderer?.destroy();
      rendererRef.current = null;
    };
  }, [definition.type]);

  // 悬停动画
  useEffect(() => {
    if (!isHovered || !canvasRef.current) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const renderer = rendererRef.current;

    if (renderer) {
      // WebGL 路径
      const startTime = performance.now();
      const duration = 1200;
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = (elapsed % duration) / duration;
        renderer.render(progress);
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    } else {
      // Canvas 2D fallback
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const startTime = performance.now();
      const duration = 1200;
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = (elapsed % duration) / duration;
        drawTransitionFrame(ctx, canvas.width, canvas.height, progress, definition.type);
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animRef.current);
  }, [isHovered, definition.type, useWebGL]);

  // 静态帧（非悬停时）
  useEffect(() => {
    if (isHovered) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rendererRef.current) {
      rendererRef.current.render(0.3);
    } else {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawTransitionFrame(ctx, canvas.width, canvas.height, 0.3, definition.type);
    }
  }, [isHovered, definition.type, useWebGL]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-transition-type', definition.type);
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart?.(definition.type, e);
    },
    [definition.type, onDragStart],
  );

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border/50 bg-card p-2 cursor-pointer',
        'hover:border-primary/50 hover:shadow-md transition-all duration-200',
      )}
      onMouseEnter={() => onHover(definition.type)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(definition.type)}
      draggable
      onDragStart={handleDragStart}
    >
      <canvas ref={canvasRef} width={120} height={68} className="w-full h-auto rounded aspect-video bg-muted" />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-medium truncate">{definition.label}</span>
        <button
          className={cn(
            'p-0.5 rounded hover:bg-accent transition-colors',
            isFavorite ? 'text-yellow-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(definition.type);
          }}
        >
          <Star className="h-3 w-3" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
