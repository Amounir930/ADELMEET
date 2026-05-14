import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pencil, Eraser, Trash2, X, Minus, Plus, Download, Image as ImageIcon } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface WhiteboardProps {
  roomName: string;
  socket: Socket | null;
  isOpen: boolean;
  onClose: () => void;
  onStreamReady?: (stream: MediaStream) => void;
}

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
}

interface WhiteboardAction {
  type: 'stroke' | 'background';
  stroke?: Stroke;
  imageUrl?: string;
}

export const SovereignWhiteboard: React.FC<WhiteboardProps> = ({ roomName, socket, isOpen, onClose, onStreamReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366f1');
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  
  // Stroke Management
  const historyRef = useRef<WhiteboardAction[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastEmitTime = useRef<number>(0);
  const bgImageCache = useRef<{ url: string, img: HTMLImageElement } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const lastBgAction = [...historyRef.current].reverse().find(a => a.type === 'background');
    
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
      historyRef.current.forEach(action => {
        if (action.type === 'stroke' && action.stroke) drawStroke(action.stroke);
      });
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

  const streamInitialized = useRef(false);

  // 4. INIT & SOCKET (MISSION-12: EPHEMERAL SYNC)
  useEffect(() => {
    if (!isOpen || !canvasRef.current) {
      streamInitialized.current = false;
      return;
    }
    
    // Initial setup (only once per mount)
    handleResize();
    window.addEventListener('resize', handleResize);

    if (socket) {
      socket.emit('whiteboard:open', { roomName });
      socket.emit('whiteboard:request_history', { roomName });
      
      const handleHistory = ({ history }: { history: WhiteboardAction[] }) => {
        historyRef.current = history;
        redrawCanvas();
      };

      const handleDelete = ({ strokeId }: { strokeId: string }) => {
        historyRef.current = historyRef.current.filter(a => a.stroke?.id !== strokeId);
        redrawCanvas();
      };
      
      socket.on('whiteboard:history', handleHistory);
      socket.on('whiteboard:delete_stroke', handleDelete);
      return () => {
        socket.off('whiteboard:history', handleHistory);
        socket.off('whiteboard:delete_stroke', handleDelete);
        window.removeEventListener('resize', handleResize);
      };
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, socket, roomName, redrawCanvas]); // Removed onStreamReady to prevent loop

  // 5. STREAM CAPTURE & PULSE (MISSION-12: STABILIZATION)
  useEffect(() => {
    if (isOpen && canvasRef.current && onStreamReady && !streamInitialized.current) {
       console.log('[MISSION-12] Initializing Virtual Whiteboard Track...');
       // @ts-ignore
       const stream = (canvasRef.current as any).captureStream(30);
       onStreamReady(stream);
       streamInitialized.current = true;
       // Trigger first frame
       setTimeout(() => redrawCanvas(), 100);
    }

    // Pulse loop to keep video track alive for recorders
    let frameId: number;
    const pulse = () => {
      if (isOpen && canvasRef.current && contextRef.current) {
        // Tiny nearly-invisible draw to trigger a frame emission
        const ctx = contextRef.current;
        ctx.save();
        ctx.globalAlpha = 0.01;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      }
      frameId = requestAnimationFrame(pulse);
    };
    
    if (isOpen) {
      pulse();
    }
    
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isOpen, onStreamReady, redrawCanvas]);

  // ERASER LOGIC: Hit testing
  const findAndEraserStroke = (x: number, y: number) => {
    const threshold = 0.02;
    let foundId: string | null = null;

    for (const action of historyRef.current) {
      if (action.type === 'stroke' && action.stroke) {
        const hit = action.stroke.points.some(p => {
          const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
          return dist < threshold;
        });
        if (hit) {
          foundId = action.stroke.id;
          break;
        }
      }
    }

    if (foundId) {
      historyRef.current = historyRef.current.filter(a => a.stroke?.id !== foundId);
      socket?.emit('whiteboard:delete_stroke', { roomName, strokeId: foundId });
      redrawCanvas();
    }
  };

  // MOUSE HANDLERS
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / canvas.offsetWidth;
    const y = (clientY - rect.top) / canvas.offsetHeight;

    if (tool === 'eraser') {
      findAndEraserStroke(x, y);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    const newStroke: Stroke = {
      id: Math.random().toString(36).substr(2, 9),
      points: [{ x, y }],
      color,
      size
    };
    currentStrokeRef.current = newStroke;
    
    const ctx = contextRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x * canvas.offsetWidth, y * canvas.offsetHeight);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / canvas.offsetWidth;
    const y = (clientY - rect.top) / canvas.offsetHeight;

    if (tool === 'eraser') {
      findAndEraserStroke(x, y);
      return;
    }

    const stroke = currentStrokeRef.current;
    if (!stroke || !contextRef.current) return;

    stroke.points.push({ x, y });
    const ctx = contextRef.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineTo(x * canvas.offsetWidth, y * canvas.offsetHeight);
    ctx.stroke();

    const now = Date.now();
    if (now - lastEmitTime.current > 32) {
      socket?.emit('whiteboard:draw', { roomName, data: { type: 'stroke_update', stroke } });
      lastEmitTime.current = now;
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === 'eraser') return;
    const stroke = currentStrokeRef.current;
    if (stroke) {
      historyRef.current.push({ type: 'stroke', stroke });
      socket?.emit('whiteboard:draw', { roomName, data: { type: 'stroke_full', stroke } });
    }
    currentStrokeRef.current = null;
    contextRef.current?.closePath();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxDim = 1280;
        let w = img.width; let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w; offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d');
        offCtx?.drawImage(img, 0, 0, w, h);
        const compressedUrl = offCanvas.toDataURL('image/jpeg', 0.5);
        socket?.emit('whiteboard:set_background', { roomName, imageUrl: compressedUrl });
        historyRef.current.push({ type: 'background', imageUrl: compressedUrl });
        redrawCanvas();
      };
    };
    reader.readAsDataURL(file);
  };

  const clearCanvas = () => {
    historyRef.current = [];
    socket?.emit('whiteboard:clear', { roomName });
    redrawCanvas();
  };

  const handleClose = () => {
    socket?.emit('whiteboard:close', { roomName });
    clearCanvas();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 9000, display: 'flex', flexDirection: 'column' }}>
      <canvas
          ref={canvasRef}
          data-whiteboard="true"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: tool === 'pen' ? 'crosshair' : 'not-allowed',
            touchAction: 'none'
          }}
        />
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
      
      {/* FIXED RESPONSIVE TOOLBAR */}
      <div style={{
        position: 'absolute', right: '25px', top: '50%', transform: 'translateY(-50%)',
        background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(30px)',
        borderRadius: '32px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
        transition: 'all 0.3s ease', zIndex: 10000
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setTool('pen')} style={{ width: '48px', height: '48px', borderRadius: '16px', border: 'none', background: tool === 'pen' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}><Pencil size={22}/></button>
          <button onClick={() => setTool('eraser')} style={{ width: '48px', height: '48px', borderRadius: '16px', border: 'none', background: tool === 'eraser' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}><Eraser size={22}/></button>
          <button onClick={() => fileInputRef.current?.click()} style={{ width: '48px', height: '48px', borderRadius: '16px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' }}><ImageIcon size={22}/></button>
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#fff'].map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen'); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: color === c ? '2px solid #fff' : 'none', background: c, cursor: 'pointer', margin: '0 auto', boxShadow: color === c ? `0 0 15px ${c}` : 'none' }} />
          ))}
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
           <button onClick={() => setSize(s => Math.min(20, s + 2))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><Plus size={18}/></button>
           <span style={{ color: '#fff', fontSize: '14px', fontWeight: '900', fontFamily: 'monospace' }}>{size.toString().padStart(2, '0')}</span>
           <button onClick={() => setSize(s => Math.max(1, s - 2))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}><Minus size={18}/></button>
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => {
            const canvas = canvasRef.current; if (!canvas) return;
            const link = document.createElement('a'); link.download = `sovereign-board.png`;
            link.href = canvas.toDataURL(); link.click();
          }} style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: 'pointer' }}><Download size={22}/></button>
          <button onClick={clearCanvas} style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={22}/></button>
          <button onClick={handleClose} style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '10px' }}><X size={22}/></button>
        </div>
      </div>
    </div>
  );
};
