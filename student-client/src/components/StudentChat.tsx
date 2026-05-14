import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, X, User, Users, Shield, Paperclip, FileText, Download, File, X as CloseIcon } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Room } from 'livekit-client';

interface Message {
  id: string;
  text: string;
  sender: string;
  role: 'teacher' | 'student';
  timestamp: number;
  isPrivate?: boolean;
  targetIdentity?: string;
  file?: {
    data: string; // base64
    name: string;
    type: string;
    size: number;
  };
}

interface StudentChatProps {
  socket: Socket | null;
  room: Room;
  isOpen: boolean;
  onClose: () => void;
  onNewPrivate: () => void;
  isChatEnabled: boolean;
}

export const StudentChat: React.FC<StudentChatProps> = ({ socket, room, isOpen, onClose, onNewPrivate, isChatEnabled }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatType, setChatType] = useState<'public' | 'private'>('public');
  const [isSending, setIsSending] = useState(false);
  const [unreadTeacherMessages, setUnreadTeacherMessages] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // DRAG & RESIZE STATE
  const [pos, setPos] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 600 });
  const [size, setSize] = useState({ w: 350, h: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:receive_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('chat:receive_private', (msg: Message) => {
      if (msg.targetIdentity === room.localParticipant.identity || msg.sender === room.localParticipant.identity) {
        setMessages(prev => [...prev, msg]);
        
        const isFromTeacher = msg.role === 'teacher';
        if (isFromTeacher) {
           if (!isOpen || chatType !== 'private') {
              setUnreadTeacherMessages(prev => prev + 1);
              onNewPrivate(); 
           }
        }
      }
    });

    socket.on('chat:file_data', ({ messageId, file }: { messageId: string, file: any }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, file } : m));
    });

    socket.on('chat:history', ({ history }: { history: Message[] }) => {
      const filtered = history.filter(msg => {
        if (!msg.isPrivate) return true;
        return msg.targetIdentity === room.localParticipant.identity || msg.sender === room.localParticipant.identity;
      });
      setMessages(filtered);
      // AUTO-FETCH REMOVED PER USER REQUEST TO ENSURE ZERO LAG
    });

    socket.on('chat:error', ({ message }: { message: string }) => {
      alert(message);
    });

    socket.emit('chat:request_history', { roomName: room.name });

    return () => {
      socket.off('chat:receive_message');
      socket.off('chat:receive_private');
      socket.off('chat:file_data');
      socket.off('chat:history');
      socket.off('chat:error');
    };
  }, [socket, room.localParticipant.identity, room.name, isOpen, onNewPrivate, chatType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, chatType]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !socket || !isChatEnabled || isSending) return;

    // Word count check
    const wordCount = inputText.trim().split(/\s+/).length;
    if (inputText.trim() && wordCount > 300) {
      alert('Message too long. Maximum 300 words allowed.');
      return;
    }

    // File size check
    if (selectedFile && selectedFile.size > 25 * 1024 * 1024) {
      alert('File too large. Maximum 25MB allowed.');
      return;
    }

    setIsSending(true);
    const sender = room.localParticipant.identity;
    
    try {
      let filePayload = null;
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        filePayload = {
          data: base64,
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size
        };
      }

      const payload = {
        roomName: room.name,
        text: inputText,
        sender: sender,
        role: 'student',
        file: filePayload
      };

      if (chatType === 'public') {
        socket.emit('chat:send_message', payload);
      } else {
        socket.emit('chat:send_private', {
          ...payload,
          targetIdentity: 'teacher'
        });
      }

      setInputText('');
      setSelectedFile(null);
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setTimeout(() => setIsSending(false), 500);
    }
  };

  const downloadFile = (messageId: string, file: any) => {
    if (!file.data) {
      socket?.emit('chat:get_file', { roomName: room.name, messageId });
      return;
    }
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // DRAGGING LOGIC
  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
      if (isResizing) {
        const dw = e.clientX - resizeStart.current.x;
        const dh = e.clientY - resizeStart.current.y;
        setSize({ 
          w: Math.max(300, resizeStart.current.w + dw), 
          h: Math.max(400, resizeStart.current.h + dh) 
        });
      }
    };
    const onUp = () => { setIsDragging(false); setIsResizing(false); };
    
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, isResizing]);

  if (!isOpen) return null;

  const filteredMessages = messages.filter(m => {
    if (chatType === 'public') return !m.isPrivate;
    return m.isPrivate;
  });

  return (
    <div style={{
      position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, width: `${size.w}px`, height: `${size.h}px`,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)', borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column',
      boxShadow: '0 30px 60px rgba(0,0,0,0.8)', zIndex: 10000, overflow: 'hidden',
      userSelect: isDragging ? 'none' : 'auto', transition: isDragging || isResizing ? 'none' : 'all 0.1s'
    }}>
      {/* HEADER */}
      <div 
        onMouseDown={startDrag}
        style={{ 
          padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'move', background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageCircle size={18} color="#6366f1" />
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: '900', letterSpacing: '1px' }}>SOVEREIGN CHAT</span>
        </div>
        <button onClick={onClose} className="no-drag" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18}/></button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '10px', padding: '15px 20px', background: 'rgba(0,0,0,0.2)' }}>
        <button 
          onClick={() => { setChatType('public'); setSelectedFile(null); }}
          style={{ 
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            background: chatType === 'public' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            color: chatType === 'public' ? '#6366f1' : '#64748b',
            fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <Users size={14} /> PUBLIC
        </button>
        <button 
          onClick={() => { setChatType('private'); setUnreadTeacherMessages(0); }}
          style={{ 
            flex: 1, padding: '8px', borderRadius: '10px', border: 'none',
            background: chatType === 'private' ? 'rgba(168, 85, 247, 0.2)' : (unreadTeacherMessages > 0 ? 'rgba(168, 85, 247, 0.1)' : 'transparent'),
            color: chatType === 'private' ? '#a855f7' : (unreadTeacherMessages > 0 ? '#a855f7' : '#64748b'),
            fontSize: '11px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            position: 'relative',
            boxShadow: unreadTeacherMessages > 0 ? '0 0 15px rgba(168, 85, 247, 0.3)' : 'none',
            transition: 'all 0.3s'
          }}
        >
          <Shield size={14} /> PRIVATE (TEACHER)
          {unreadTeacherMessages > 0 && (
            <div style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: '#ef4444', color: '#fff', fontSize: '9px', padding: '2px 6px',
              borderRadius: '10px', fontWeight: 'bold', border: '2px solid rgba(15, 23, 42, 1)'
            }}>
              {unreadTeacherMessages}
            </div>
          )}
        </button>
      </div>

      {/* MESSAGES LIST */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scrollbar">
        {filteredMessages.map(msg => {
          const isMe = msg.sender === room.localParticipant.identity;
          const isTeacher = msg.role === 'teacher';
          const hasFile = !!msg.file;
          const isImage = hasFile && msg.file?.type.startsWith('image/');
          
          return (
            <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {!isMe && (
                <span style={{ 
                  fontSize: '10px', 
                  color: isTeacher ? '#6366f1' : '#94a3b8', 
                  fontWeight: '900', 
                  marginLeft: '8px', 
                  display: 'block', 
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {isTeacher ? 'PROFESSOR' : (msg.sender.includes('_') ? msg.sender.split('_')[0] : 'STUDENT')}
                </span>
              )}
              <div style={{
                background: isMe ? '#6366f1' : (isTeacher ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.05)'),
                padding: isImage ? '8px' : '12px 16px', 
                borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                color: '#fff', fontSize: '13px', border: isTeacher ? '1px solid rgba(99, 102, 241, 0.2)' : 'none',
                boxShadow: isMe ? '0 4px 15px rgba(99, 102, 241, 0.2)' : 'none',
                overflow: 'hidden'
              }}>
                {msg.text && <div style={{ marginBottom: hasFile ? '8px' : 0 }}>{msg.text}</div>}
                {hasFile && (
                  isImage ? (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
                      {msg.file?.data ? (
                        <img 
                          src={msg.file.data} 
                          alt={msg.file.name} 
                          style={{ width: '100%', display: 'block', borderRadius: '12px', cursor: 'pointer' }}
                          onClick={() => downloadFile(msg.id, msg.file)}
                        />
                      ) : (
                        <div 
                          onClick={() => downloadFile(msg.id, msg.file)}
                          style={{ 
                            padding: '20px 10px', textAlign: 'center', cursor: 'pointer', color: '#6366f1', fontSize: '11px', fontWeight: 'bold',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <div className="animate-pulse" style={{ fontSize: '20px' }}>🖼️</div>
                          <span>Load Image ({Math.round((msg.file?.size || 0) / 1024)} KB)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      onClick={() => downloadFile(msg.id, msg.file!)}
                      style={{ 
                        background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                      }}
                    >
                      <FileText size={14} color="#6366f1" />
                      <span style={{ fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.file?.name}</span>
                      <Download size={14} color={msg.file?.data ? '#94a3b8' : '#6366f1'} />
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
        {filteredMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
            <MessageCircle size={40} />
            <p style={{ fontSize: '10px', fontWeight: '900', marginTop: '10px' }}>NO MESSAGES IN {chatType.toUpperCase()}</p>
          </div>
        )}
        {!isChatEnabled && <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '11px', fontWeight: 'bold', padding: '10px', background: 'rgba(239,68,68,0.05)', borderRadius: '10px' }}>Teacher disabled the chat.</div>}
      </div>

      {/* ATTACHMENT PREVIEW */}
      {selectedFile && (
        <div style={{ 
          background: 'rgba(99, 102, 241, 0.1)', borderTop: '1px solid rgba(99, 102, 241, 0.2)',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <File size={14} color="#6366f1" />
          <span style={{ flex: 1, fontSize: '11px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><CloseIcon size={14}/></button>
        </div>
      )}

      {/* INPUT */}
      <form onSubmit={handleSendMessage} style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        
        {chatType === 'private' && (
          <button 
            type="button"
            disabled={!isChatEnabled}
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', cursor: 'pointer'
            }}
          >
            <Paperclip size={18} />
          </button>
        )}

        <div style={{ flex: 1, position: 'relative' }}>
          <input 
            disabled={!isChatEnabled}
            type="text" placeholder={isChatEnabled ? (chatType === 'public' ? "Message class..." : "Private to Professor...") : "Chat is disabled"}
            value={inputText} onChange={(e) => setInputText(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '15px', padding: '12px 45px 12px 15px', color: '#fff', fontSize: '13px', outline: 'none'
            }}
          />
          <button type="submit" disabled={!isChatEnabled} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: isChatEnabled ? '#6366f1' : '#4b5563', cursor: 'pointer' }}>
            <Send size={18} />
          </button>
        </div>
      </form>

      {/* RESIZE HANDLE */}
      <div 
        onMouseDown={startResize}
        style={{ 
          position: 'absolute', right: 0, bottom: 0, width: '20px', height: '20px', 
          cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.1) 50%)' 
        }} 
      />
    </div>
  );
};
