import React, { useState, useEffect, useRef } from "react";
import { Send, Bitcoin, User, Plus } from "lucide-react";

// Hàm lấy thời gian hiện tại (dùng để timestamp tin nhắn)
const getCurrentTime = () => {
  const now = new Date();
  return (
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0")
  );
};

const ChatbotInterface = () => {
  // State quản lý danh sách tin nhắn
  const [messages, setMessages] = useState(() => {
    const storedMessages = localStorage.getItem("chatMessages");
    return storedMessages
      ? JSON.parse(storedMessages)
      : [
          {
            id: 1,
            text: "Chào mừng bạn đến với Crypto AI Insight — nơi mọi giấc mơ đều có thể pump hoặc dump trong chớp mắt.",
            sender: "bot",
            time: getCurrentTime(),
          },
        ];
  });

  // State input người dùng
  const [inputValue, setInputValue] = useState("");
  // State kiểm soát khi đang gửi request
  const [isTyping, setIsTyping] = useState(false);
  // State mở/đóng menu (Help, Reset)
  const [showMenu, setShowMenu] = useState(false);
  // Ref để scroll xuống cuối chat
  const messagesEndRef = useRef(null);
  // Kiểm tra input có hợp lệ không (tránh gửi chuỗi rỗng)
  const isInputValid = inputValue.trim().length > 0;
  // Tắt popup khi nhấn +
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".menu-container")) {
        setShowMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Lưu tin nhắn vào localStorage mỗi khi messages thay đổi
  useEffect(() => {
    scrollToBottom();
    localStorage.setItem("chatMessages", JSON.stringify(messages));
  }, [messages]);

  // Scroll tự động xuống dòng cuối cùng
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Hàm gửi tin nhắn
  const sendMessage = async (messageText = inputValue) => {
    const message = messageText.trim();
    if (!message) return;

    const userMessage = {
      id: Date.now(),
      text: message,
      sender: "user",
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true); // Bắt đầu chặn nhập và hiển thị "đang xử lý"

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Lỗi server");
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: "bot",
        time: getCurrentTime(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      // Nếu xảy ra lỗi trả về thông báo lỗi
      const errorMessage = {
        id: Date.now() + 2,
        text: "❌ Đã xảy ra lỗi khi xử lý. Vui lòng thử lại.",
        sender: "bot",
        time: getCurrentTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false); // Mở lại input sau khi xử lý xong
    }
  };

  // Load nội dung từ file help.txt (menu Help)
  const loadHelpMessage = async () => {
    try {
      const response = await fetch("/help.txt");
      const helpText = await response.text();
      const helpMessage = {
        id: Date.now(),
        text: helpText,
        sender: "bot",
        time: getCurrentTime(),
      };
      setMessages((prev) => [...prev, helpMessage]);
    } catch (error) {
      console.error("Lỗi khi load help.txt:", error);
    }
  };

  // Hiển thị hiệu ứng bot đang gõ (dấu chấm nhấp nháy)
  const TypingIndicator = () => (
    <div className="flex gap-1 p-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-teal-400 rounded-full animate-bounce shadow-lg shadow-teal-400/50"
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1.4s",
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 ">
      {/* Phần header trên cùng */}
      <div className="bg-slate-900 p-5 text-center">
        <h2 className="text-3xl font-bold text-white drop-shadow-2xl mb-1">
          Crypto AI Insight
        </h2>
        <div className="text-sm text-teal-400 mt-1">
          Chatbot có thể mắc lỗi. Hãy nhớ tiền là của bạn!
        </div>
      </div>

      {/* Nội dung phần chat chính */}
      <div className="flex-1 overflow-y-auto bg-[#0f172a] basis-0">
        <div className="px-5 py-5 space-y-4">
          {messages.map((message) => (
            <div
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
              key={message.id}
            >
              {/* Icon bot */}
              {message.sender === "bot" && (
                <div className="flex items-start mr-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-400/20 to-teal-600/20 rounded-full flex items-center justify-center border-2 border-teal-400/50 shadow-lg shadow-teal-400/30">
                    <Bitcoin
                      size={18}
                      className="text-teal-300 drop-shadow-sm"
                    />
                  </div>
                </div>
              )}

              {/* Nội dung tin nhắn */}
              <div
                className={`max-w-[80%] p-3 text-sm leading-relaxed ${
                  message.sender === "user"
                    ? "text-white shadow-lg rounded-2xl overflow-hidden"
                    : "bg-slate-700/80 text-slate-100 border border-teal-400/20 shadow-lg shadow-black/20 rounded-2xl"
                }`}
                style={
                  message.sender === "user"
                    ? {
                        background:
                          "linear-gradient(to right, #1CA897, #299D92)",
                      }
                    : {}
                }
              >
                <div style={{ whiteSpace: "pre-wrap" }}>{message.text}</div>
                <div className="text-xs opacity-60 mt-2">{message.time}</div>
              </div>

              {/* Icon user */}
              {message.sender === "user" && (
                <div className="flex items-start ml-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-slate-600/40 to-slate-500/40 rounded-full flex items-center justify-center border-2 border-slate-400/60 shadow-lg shadow-slate-400/20">
                    <User size={18} className="text-slate-200 drop-shadow-sm" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Hiển thị hiệu ứng khi đang xử lý */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-start mr-2">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-400/20 to-teal-600/20 rounded-full flex items-center justify-center border-2 border-teal-400/50 shadow-lg shadow-teal-400/30">
                  <Bitcoin size={18} className="text-teal-300 drop-shadow-sm" />
                </div>
              </div>
              <div className="max-w-[80%] p-3 text-sm leading-relaxed bg-slate-700/80 text-slate-100 border border-teal-400/20 shadow-lg shadow-black/20 rounded-2xl">
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer: gồm input, nút gửi và menu */}
      <div className="px-5 py-3 bg-[#0f172a] backdrop-blur-lg shrink-0">
        <div className="flex items-center bg-slate-800/50 border-2 border-slate-500/40 rounded-full px-4 py-3 transition-all duration-300 focus-within:border-teal-300">
          {/* Nút mở menu */}
          <div className="relative menu-container">
            <button
              onClick={() => !isTyping && setShowMenu(!showMenu)}
              disabled={isTyping}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all duration-300 ${
                isTyping
                  ? "bg-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-br from-slate-600 to-slate-800 hover:shadow-lg"
              }`}
            >
              <Plus size={20} />
            </button>

            {/* Menu Help & Reset */}
            {showMenu && (
              <div className="absolute bottom-12 left-0 bg-slate-700 border border-teal-400/30 rounded-xl shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => {
                    loadHelpMessage();
                    setShowMenu(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-teal-500/30"
                >
                  Help
                </button>
                <button
                  onClick={() => {
                    const resetMessage = {
                      id: Date.now(),
                      text: "Chào mừng bạn đến với Crypto AI Insight — nơi mọi giấc mơ đều có thể pump hoặc dump trong chớp mắt.",
                      sender: "bot",
                      time: getCurrentTime(),
                    };
                    setMessages([resetMessage]);
                    localStorage.removeItem("chatMessages");
                    setShowMenu(false);
                  }}
                  className="block w-full px-4 py-2 text-left text-slate-100 hover:bg-teal-500/30"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Input nhập tin nhắn */}
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onInput={(e) => {
              e.target.style.height = "auto";
              const maxHeight = 60;
              e.target.style.height =
                Math.min(e.target.scrollHeight, maxHeight) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isTyping ? "Đang xử lý..." : "Nhập tin nhắn..."}
            spellCheck={false}
            rows={1}
            disabled={isTyping}
            className={`flex-1 bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none px-3 py-2 break-words whitespace-pre-wrap leading-relaxed ${
              isTyping ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              resize: "none",
              overflow: "auto",
              minHeight: "40px",
              maxHeight: "72px",
            }}
          />

          {/* Nút gửi tin nhắn */}
          <button
            onClick={() => sendMessage()}
            disabled={!isInputValid || isTyping}
            className={`ml-3 w-10 h-10 rounded-full flex items-center justify-center text-white hover:shadow-lg transition-all duration-300 ${
              !isInputValid || isTyping
                ? "bg-slate-500 cursor-not-allowed"
                : "bg-gradient-to-br from-teal-400 to-teal-600"
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotInterface;
