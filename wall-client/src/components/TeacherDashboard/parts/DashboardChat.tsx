import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Users, 
  User, 
  Lock, 
  Unlock, 
  MessageCircle, 
  ShieldAlert,
  Search,
  ChevronLeft,
  Paperclip,
  FileText,
  Download,
  X,
  File
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Room, RemoteParticipant } from 'livekit-client';

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

interface DashboardChatProps {
  socket: Socket | null;
  room: Room;
  isSidebarOpen: boolean;
  participants: RemoteParticipant[];
  isChatEnabled: boolean;
  onUnreadUpdate?: (total: number) => void;
  onStudentUnreadUpdate?: (identity: string, count: number) => void;
}

export const DashboardChat: React.FC<DashboardChatProps> = ({ 
  socket, 
  room, 
  isSidebarOpen,
  participants,
  isChatEnabled,
  onUnreadUpdate,
  onStudentUnreadUpdate
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatType, setChatType] = useState<'public' | 'private'>('public');
  const [selectedStudent, setSelectedStudent] = useState<RemoteParticipant | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:receive_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('chat:receive_private', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      
      if (msg.role === 'student') {
        setUnreadCounts(prev => {
          if (selectedStudent?.identity === msg.sender && isSidebarOpen && chatType === 'private') return prev;
          const count = (prev[msg.sender] || 0) + 1;
          const next = { ...prev, [msg.sender]: count };
          const total = Object.values(next).reduce((a, b) => a + b, 0);
          onUnreadUpdate?.(total);
          onStudentUnreadUpdate?.(msg.sender, count);
          return next;
        });
      }
    });

    socket.on('chat:file_data', ({ messageId, file }: { messageId: string, file: any }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, file } : m));
    });

    socket.on('chat:history', ({ history }: { history: Message[] }) => {
      setMessages(history);
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
  }, [socket, selectedStudent?.identity, room.name]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatType, selectedStudent]);

  const handleSelectStudent = (p: RemoteParticipant) => {
    setSelectedStudent(p);
    setUnreadCounts(prev => {
      const next = { ...prev, [p.identity]: 0 };
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      onUnreadUpdate?.(total);
      onStudentUnreadUpdate?.(p.identity, 0);
      return next;
    });
  };

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
    if ((!inputText.trim() && !selectedFile) || !socket || isSending) return;

    // Limit Checks
    const wordCount = inputText.trim().split(/\s+/).length;
    if (inputText.trim() && wordCount > 300) {
      alert('Message too long. Maximum 300 words allowed.');
      return;
    }

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
        sender, 
        role: 'teacher',
        file: filePayload
      };

      if (chatType === 'public') {
        socket.emit('chat:send_message', payload);
      } else if (selectedStudent) {
        socket.emit('chat:send_private', { ...payload, targetIdentity: selectedStudent.identity });
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

  const filteredMessages = messages.filter(m => {
    if (chatType === 'public') return !m.isPrivate;
    if (selectedStudent) {
      return m.isPrivate && (m.targetIdentity === selectedStudent.identity || m.sender === selectedStudent.identity);
    }
    return false;
  });

  const filteredParticipants = participants.filter(p => 
    (p.name || p.identity).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ 
      flex: 1, padding: '25px', display: 'flex', flexDirection: 'column',
      opacity: isSidebarOpen ? 1 : 0, transition: 'all 0.3s ease', minWidth: '320px',
      overflow: 'hidden', minHeight: 0, height: '100%'
    }}>
      {/* HEADER CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageCircle size={20} color="#6366f1" />
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>CHAT HUB</h2>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => { setChatType('public'); setSelectedStudent(null); }}
          style={{ 
            flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
            background: chatType === 'public' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
            color: chatType === 'public' ? '#6366f1' : '#94a3b8',
            fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3'
          }}
        >
          PUBLIC
        </button>
        <button 
          onClick={() => setChatType('private')}
          style={{ 
            flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
            background: chatType === 'private' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)',
            color: chatType === 'private' ? '#a855f7' : '#94a3b8',
            fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s'
          }}
        >
          PRIVATE
        </button>
      </div>

      {chatType === 'private' && !selectedStudent ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="custom-scrollbar">
          <div style={{ position: 'relative', marginBottom: '15px' }}>
            <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px', padding: '10px 10px 10px 35px', color: '#fff', fontSize: '12px', outline: 'none'
              }}
            />
          </div>

          <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '800', marginBottom: '10px' }}>DIRECT MESSAGES</p>
          {filteredParticipants.map(p => (
            <div 
              key={p.identity}
              onClick={() => handleSelectStudent(p)}
              style={{ 
                padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#a855f7" />
              </div>
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>{p.name || p.identity}</span>
              
              {unreadCounts[p.identity] > 0 && (
                <div style={{ 
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: '900',
                  minWidth: '20px', height: '20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)',
                  border: '2px solid rgba(15, 23, 42, 1)'
                }}>
                  {unreadCounts[p.identity]}
                </div>
              )}
            </div>
          ))}
          {filteredParticipants.length === 0 && <p style={{ textAlign: 'center', color: '#475569', marginTop: '40px', fontSize: '12px' }}>No matching students.</p>}
        </div>
      ) : (
        <>
          {selectedStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '10px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '12px' }}>
               <button onClick={() => setSelectedStudent(null)} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer' }}><ChevronLeft size={18}/></button>
               <span style={{ color: '#a855f7', fontSize: '12px', fontWeight: '900' }}>TO: {selectedStudent.name || selectedStudent.identity}</span>
            </div>
          )}

          {/* MESSAGES LIST */}
          <div 
            ref={scrollRef}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }} 
            className="custom-scrollbar"
          >
            {filteredMessages.map(msg => {
              const isMe = msg.sender === room.localParticipant.identity;
              const isFromStudent = msg.role === 'student';
              const hasFile = !!msg.file;
              const isImage = hasFile && msg.file?.type.startsWith('image/');
              
              return (
                <div 
                  key={msg.id} 
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {!isMe && (
                    <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: '900', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {(() => {
                        const p = participants.find(part => part.identity === msg.sender);
                        const displayName = p?.name || (msg.sender.length > 20 ? 'STUDENT' : msg.sender.split('_')[0]);
                        return displayName.toUpperCase();
                      })()}
                    </span>
                  )}
                  <div style={{
                    background: isMe ? '#6366f1' : 'rgba(255,255,255,0.05)',
                    padding: isImage ? '8px' : '12px 16px',
                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    color: '#fff',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    boxShadow: isMe ? '0 10px 25px rgba(99, 102, 241, 0.2)' : 'none',
                    border: !isMe ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {msg.text && <div style={{ marginBottom: hasFile ? '10px' : 0, padding: isImage ? '4px 8px' : 0 }}>{msg.text}</div>}
                    
                    {hasFile && (
                      isImage ? (
                        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
                          {msg.file?.data ? (
                            <>
                              <img 
                                src={msg.file.data} 
                                alt={msg.file.name} 
                                style={{ width: '100%', display: 'block', borderRadius: '12px', cursor: 'pointer' }} 
                                onClick={() => downloadFile(msg.id, msg.file)}
                              />
                              <div 
                                onClick={() => downloadFile(msg.id, msg.file)}
                                style={{ 
                                  position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.5)',
                                  padding: '5px', borderRadius: '8px', cursor: 'pointer'
                                }}
                              >
                                <Download size={14} color="#fff" />
                              </div>
                            </>
                          ) : (
                            <div 
                              onClick={() => downloadFile(msg.id, msg.file)}
                              style={{ padding: '30px 10px', textAlign: 'center', cursor: 'pointer', color: '#6366f1', fontSize: '12px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                            >
                              <div className="animate-pulse" style={{ fontSize: '24px' }}>🖼️</div>
                              <span>Load Image ({Math.round((msg.file?.size || 0) / 1024)} KB)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          onClick={() => downloadFile(msg.id, msg.file!)}
                          style={{ 
                            background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
                        >
                          <div style={{ width: '36px', height: '36px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#6366f1" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.file?.name}</p>
                            <p style={{ margin: 0, fontSize: '9px', opacity: 0.5 }}>{Math.round((msg.file?.size || 0) / 1024 / 1024 * 100) / 100} MB</p>
                          </div>
                          <Download size={16} color={msg.file?.data ? '#94a3b8' : '#6366f1'} />
                        </div>
                      )
                    )}
                  </div>
                  <span style={{ fontSize: '8px', color: '#475569', alignSelf: isMe ? 'flex-end' : 'flex-start', margin: '0 8px' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ATTACHMENT PREVIEW */}
          {selectedFile && (
            <div style={{ 
              background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '12px', padding: '10px 15px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <File size={16} color="#6366f1" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile.name}</span>
                <span style={{ color: '#6366f1', fontSize: '9px' }}>{Math.round(selectedFile.size / 1024 / 1024 * 100) / 100} MB / 25MB</span>
              </div>
              <button onClick={() => setSelectedFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16}/></button>
            </div>
          )}

          {/* INPUT AREA */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '45px', height: '45px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Paperclip size={20} />
            </button>

            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                placeholder={selectedStudent ? `Message ${selectedStudent.name}...` : "Broadcast to class..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '15px', padding: '15px 50px 15px 20px', color: '#fff', outline: 'none',
                  fontSize: '13px', transition: 'all 0.3s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button 
                type="submit"
                disabled={isSending}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  width: '34px', height: '34px', borderRadius: '10px', background: '#6366f1',
                  border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: isSending ? 0.5 : 1
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
          <p style={{ margin: '8px 0 0', fontSize: '9px', color: '#475569', textAlign: 'center' }}>
            Limits: 25MB Files | 300 Words | Ephemeral Chat
          </p>
        </>
      )}
    </div>
  );
};
