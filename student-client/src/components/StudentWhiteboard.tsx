import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Maximize2, Minimize2 } from 'lucide-react';

interface StudentWhiteboardProps {
  socket: Socket | null;
  roomName: string;
  isInline?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
}

interface WhiteboardAction {
  type: 'stroke' | 'background' | 'stroke_update' | 'stroke_full';
  stroke?: Stroke;
  imageUrl?: string;
}

export const StudentWhiteboard: React.FC<StudentWhiteboardProps> = ({ socket, roomName, isInline = false, onVisibilityChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Stroke Management
  const historyRef = useRef<WhiteboardAction[]>([]);
  const activeStrokesRef = useRef<Map<string, Stroke>>(new Map());
  const bgImageCache = useRef<{ url: string, img: HTMLImageElement } | null>(null);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  // 1. DRAW A SINGLE STROKE
  const drawStroke = useCallback((stroke: Stroke) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startX = stroke.points[0].x * canvas.offsetWidth;
    const startY = stroke.points[0].y * canvas.offsetHeight;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < stroke.points.length; i++) {
      const x = stroke.points[i].x * canvas.offsetWidth;
      const y = stroke.points[i].y * canvas.offsetHeight;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.closePath();
  }, []);

  // 2. FULL REDRAW
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const history = historyRef.current;
    const lastBgAction = [...history].reverse().find(a => a.type === 'background');

    const drawContent = (img?: HTMLImageElement) => {
      if (img) {
        const canvasW = canvas.offsetWidth;
        const canvasH = canvas.offsetHeight;
        const ratio = Math.min(canvasW / img.width, canvasH / img.height);
        const newW = img.width * ratio;
        const newH = img.height * ratio;
        const x = (canvasW - newW) / 2;
        const y = (canvasH - newH) / 2;
        ctx.drawImage(img, x, y, newW, newH);
      }
      history.forEach(action => {
        if (action.type === 'stroke' && action.stroke) drawStroke(action.stroke);
      });
      activeStrokesRef.current.forEach(stroke => drawStroke(stroke));
    };

    if (lastBgAction?.imageUrl) {
      if (bgImageCache.current?.url === lastBgAction.imageUrl) {
        drawContent(bgImageCache.current.img);
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = lastBgAction.imageUrl;
        img.onload = () => {
          bgImageCache.current = { url: lastBgAction.imageUrl!, img };
          redrawCanvas();
        };
      }
      return;
    }

    drawContent();
  }, [drawStroke]);

  // 3. RESIZE
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      contextRef.current = context;
      redrawCanvas();
    }
  }, [redrawCanvas]);

  // 4. SOCKETS
  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard:open', () => setIsVisible(true));

    socket.on('whiteboard:draw', (data: WhiteboardAction) => {
      if (!isVisible) setIsVisible(true);
      
      if (data.type === 'stroke_update' && data.stroke) {
        activeStrokesRef.current.set(data.stroke.id, data.stroke);
        redrawCanvas();
      } else if (data.type === 'stroke_full' && data.stroke) {
        activeStrokesRef.current.delete(data.stroke.id);
        historyRef.current.push({ type: 'stroke', stroke: data.stroke });
        redrawCanvas();
      }
    });

    socket.on('whiteboard:delete_stroke', ({ strokeId }: { strokeId: string }) => {
      historyRef.current = historyRef.current.filter(a => a.stroke?.id !== strokeId);
      activeStrokesRef.current.delete(strokeId);
      redrawCanvas();
    });

    socket.on('whiteboard:close', () => {
      setIsVisible(false);
    });

    socket.on('whiteboard:clear', () => {
      historyRef.current = [];
      activeStrokesRef.current.clear();
      bgImageCache.current = null;
      if (contextRef.current && canvasRef.current) {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    socket.on('whiteboard:set_background', ({ imageUrl }: { imageUrl: string }) => {
      setIsVisible(true);
      historyRef.current.push({ type: 'background', imageUrl });
      redrawCanvas();
    });

    socket.on('whiteboard:history', ({ history }: { history: WhiteboardAction[] }) => {
       if (history.length > 0) {
         setIsVisible(true);
         historyRef.current = history;
         setTimeout(redrawCanvas, 100);
       }
    });

    socket.emit('whiteboard:request_history', { roomName });

    return () => {
      socket.off('whiteboard:open');
      socket.off('whiteboard:draw');
      socket.off('whiteboard:delete_stroke');
      socket.off('whiteboard:clear');
      socket.off('whiteboard:set_background');
      socket.off('whiteboard:history');
    };
  }, [socket, roomName, isVisible, redrawCanvas]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, handleResize]);

  if (!isVisible) return null;

  if (isInline) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
        <canvas ref={canvasRef} data-whiteboard="true" style={{ flex: 1, width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: isMinimized ? '20px' : '100px', right: '20px',
      width: isMinimized ? '200px' : '40%', height: isMinimized ? '150px' : '40%',
      background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(20px)',
      borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 8000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 30px 60px rgba(0,0,0,0.5)', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    }}>
      <div style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontSize: '11px', fontWeight: '900', letterSpacing: '1px' }}>SOVEREIGN BOARD</span>
        <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
          {isMinimized ? <Maximize2 size={14}/> : <Minimize2 size={14}/>}
        </button>
      </div>
      <canvas ref={canvasRef} data-whiteboard="true" style={{ flex: 1, width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
};
