import React, { useState, useRef, useEffect } from "react";
import { Search, Send, Paperclip, Smile, MoreVertical, ArrowRight, Check, CheckCheck, Phone, ShieldCheck } from "lucide-react";
import { Preferences } from "@capacitor/preferences";

const AUTH_STORAGE_KEY = "shade_auth_phone";

const CONTACTS = [
  { id: 1, name: "سارا احمدی", initials: "سا", online: true, color: "#7C6FE0" },
  { id: 2, name: "گروه طراحی", initials: "گط", online: false, color: "#4FA3A0", group: true },
  { id: 3, name: "علی رضایی", initials: "عر", online: true, color: "#C77D5A" },
  { id: 4, name: "مریم کریمی", initials: "مک", online: false, color: "#B0578D" },
  { id: 5, name: "پویا مرادی", initials: "پم", online: false, color: "#5B8DBE" },
];

const INITIAL_MESSAGES = {
  1: [
    { id: 1, from: "them", text: "سلام! فایل‌های جدید رو دیدی؟", time: "10:12" },
    { id: 2, from: "me", text: "سلام، آره الان دارم نگاه می‌کنم", time: "10:14", status: "read" },
    { id: 3, from: "them", text: "نظرت چیه؟ فکر می‌کنم رنگ‌بندی خوب شده", time: "10:15" },
  ],
  2: [
    { id: 1, from: "them", text: "جلسه فردا ساعت ۱۰ هست", time: "09:02" },
    { id: 2, from: "me", text: "باشه، یادداشت کردم", time: "09:05", status: "read" },
  ],
  3: [
    { id: 1, from: "them", text: "کد رو پوش کردم، می‌تونی ریویو کنی؟", time: "یدیروز" },
  ],
  4: [
    { id: 1, from: "me", text: "ممنون بابت کمکت", time: "دوشنبه", status: "delivered" },
  ],
  5: [
    { id: 1, from: "them", text: "عکس‌های سفر رو برات می‌فرستم", time: "شنبه" },
  ],
};

const LAST_PREVIEW = {
  1: "نظرت چیه؟ فکر می‌کنم رنگ‌بندی...",
  2: "باشه، یادداشت کردم",
  3: "کد رو پوش کردم، می‌تونی ریویو...",
  4: "ممنون بابت کمکت",
  5: "عکس‌های سفر رو برات می‌فرستم",
};

const LAST_TIME = { 1: "10:15", 2: "09:05", 3: "دیروز", 4: "دوشنبه", 5: "شنبه" };
const UNREAD = { 1: 0, 2: 2, 3: 1, 4: 0, 5: 0 };

const AUTO_REPLIES = [
  "باشه، متوجه شدم",
  "عالیه، ممنون",
  "الان بررسی می‌کنم",
  "حتما، بهت خبر می‌دم",
  "درسته، موافقم",
];

function Avatar({ name, initials, color, size = 44 }) {
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
    >
      {initials}
    </div>
  );
}

export default function ShadeApp() {
  const [authStep, setAuthStep] = useState("checking"); // checking | phone | otp | app
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);

  const [activeId, setActiveId] = useState(1);
  const [messagesByChat, setMessagesByChat] = useState(INITIAL_MESSAGES);
  const [previews, setPreviews] = useState(LAST_PREVIEW);
  const [times, setTimes] = useState(LAST_TIME);
  const [unread, setUnread] = useState(UNREAD);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [mobileView, setMobileView] = useState("list"); // list | chat
  const scrollRef = useRef(null);

  const active = CONTACTS.find((c) => c.id === activeId);
  const messages = messagesByChat[activeId] || [];

  useEffect(() => {
    (async () => {
      try {
        const stored = await Preferences.get({ key: AUTH_STORAGE_KEY });
        if (stored.value) {
          setPhone(stored.value);
          setAuthStep("app");
        } else {
          setAuthStep("phone");
        }
      } catch {
        setAuthStep("phone");
      }
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const filtered = CONTACTS.filter((c) => c.name.includes(query.trim()));

  function openChat(id) {
    setActiveId(id);
    setUnread((u) => ({ ...u, [id]: 0 }));
    setMobileView("chat");
  }

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const time = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    const newMsg = { id: Date.now(), from: "me", text, time, status: "sent" };
    setMessagesByChat((prev) => ({ ...prev, [activeId]: [...(prev[activeId] || []), newMsg] }));
    setPreviews((p) => ({ ...p, [activeId]: text }));
    setTimes((t) => ({ ...t, [activeId]: time }));
    setInput("");

    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      const replyTime = new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
      setMessagesByChat((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] || []), { id: Date.now() + 1, from: "them", text: reply, time: replyTime }],
      }));
      setPreviews((p) => ({ ...p, [activeId]: reply }));
      setTimes((t) => ({ ...t, [activeId]: replyTime }));
    }, 1400 + Math.random() * 900);
  }

  function handleSendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("شماره موبایل معتبر نیست");
      return;
    }
    setPhoneError("");
    const code = String(Math.floor(10000 + Math.random() * 90000));
    setSentCode(code);
    setOtp(["", "", "", "", ""]);
    setOtpError("");
    setResendTimer(45);
    setAuthStep("otp");
  }

  function handleOtpChange(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError("");
    if (digit && index < 4) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleVerify() {
    const entered = otp.join("");
    if (entered.length < 5) {
      setOtpError("کد ۵ رقمی را کامل وارد کنید");
      return;
    }
    if (entered !== sentCode) {
      setOtpError("کد وارد شده اشتباه است");
      return;
    }
    Preferences.set({ key: AUTH_STORAGE_KEY, value: phone });
    setAuthStep("app");
  }

  function handleLogout() {
    if (!window.confirm("از حساب خارج شوید؟")) return;
    Preferences.remove({ key: AUTH_STORAGE_KEY });
    setPhone("");
    setAuthStep("phone");
  }

  if (authStep === "checking") {
    return (
      <div
        className="w-full flex items-center justify-center bg-[#0B0D12]"
        style={{ height: "100dvh" }}
      >
        <img src="/favicon.png" alt="Shade" className="w-16 h-16 rounded-2xl object-cover" />
      </div>
    );
  }

  if (authStep === "phone" || authStep === "otp") {
    return (
      <div
        dir="rtl"
        className="w-full flex flex-col items-center justify-center bg-[#0B0D12] text-[#E7E8EC] px-6"
        style={{
          height: "100dvh",
          fontFamily: "system-ui, sans-serif",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="w-full max-w-[340px] flex flex-col items-center">
          <img src="/favicon.png" alt="Shade" className="w-16 h-16 rounded-2xl object-cover mb-5" />

          {authStep === "phone" ? (
            <>
              <h1 className="text-xl font-medium mb-1.5">شماره موبایل خود را وارد کنید</h1>
              <p className="text-sm text-[#8B8D98] text-center mb-6">
                کد تایید برای این شماره پیامک می‌شود
              </p>
              <div className="w-full flex items-center gap-2 bg-[#151821] rounded-xl px-4 py-3 mb-2">
                <Phone size={17} className="text-[#8B8D98] shrink-0" />
                <input
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  placeholder="09123456789"
                  className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC] text-left"
                />
              </div>
              {phoneError && <p className="text-xs text-[#E2807E] w-full text-right mb-2">{phoneError}</p>}
              <button
                onClick={handleSendCode}
                className="w-full mt-4 bg-[#7C6FE0] hover:bg-[#6C5FD0] transition-colors text-white text-sm font-medium rounded-xl py-3"
              >
                ارسال کد تایید
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1.5">کد تایید را وارد کنید</h1>
              <p className="text-sm text-[#8B8D98] text-center mb-1">
                کد ۵ رقمی به شماره
              </p>
              <p className="text-sm text-[#E7E8EC] mb-5" dir="ltr">{phone}</p>

              <div className="w-full bg-[#151821] border border-[#2A2E3A] rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#5DCAA5] shrink-0" />
                <span className="text-xs text-[#8B8D98]">
                  حالت شبیه‌سازی — کد شما: <span className="text-[#E7E8EC] font-medium" dir="ltr">{sentCode}</span>
                </span>
              </div>

              <div dir="ltr" className="flex items-center justify-center gap-2 mb-2">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    inputMode="numeric"
                    maxLength={1}
                    className="w-11 h-12 text-center text-lg bg-[#151821] rounded-lg outline-none text-[#E7E8EC] border border-[#2A2E3A] focus:border-[#7C6FE0]"
                  />
                ))}
              </div>
              {otpError && <p className="text-xs text-[#E2807E] w-full text-center mb-2">{otpError}</p>}

              <button
                onClick={handleVerify}
                className="w-full mt-4 bg-[#7C6FE0] hover:bg-[#6C5FD0] transition-colors text-white text-sm font-medium rounded-xl py-3"
              >
                تایید و ورود
              </button>

              <div className="flex items-center justify-between w-full mt-4">
                <button onClick={() => setAuthStep("phone")} className="text-xs text-[#8B8D98] hover:text-[#E7E8EC]">
                  ویرایش شماره
                </button>
                <button
                  onClick={() => resendTimer === 0 && handleSendCode()}
                  className={`text-xs ${resendTimer === 0 ? "text-[#7C6FE0]" : "text-[#5F6270]"}`}
                >
                  {resendTimer === 0 ? "ارسال مجدد کد" : `ارسال مجدد (${resendTimer})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="w-full flex bg-[#0B0D12] text-[#E7E8EC] overflow-hidden"
      style={{
        height: "100dvh",
        fontFamily: "system-ui, sans-serif",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Sidebar */}
      <div className={`w-full md:w-[320px] shrink-0 border-l border-[#1E212B] flex-col ${mobileView === "list" ? "flex" : "hidden md:flex"}`}>
        <div className="px-4 py-4 flex items-center justify-between border-b border-[#1E212B]">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Shade" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-lg font-medium tracking-tight">Shade</span>
          </div>
          <button onClick={handleLogout} aria-label="خروج از حساب">
            <MoreVertical size={18} className="text-[#8B8D98]" />
          </button>
        </div>
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 bg-[#151821] rounded-lg px-3 py-2">
            <Search size={16} className="text-[#8B8D98]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در گفتگوها"
              className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${
                activeId === c.id ? "bg-[#171A24]" : "hover:bg-[#12151C]"
              }`}
            >
              <div className="relative">
                <Avatar name={c.name} initials={c.initials} color={c.color} />
                {c.online && (
                  <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-[#5DCAA5] border-2 border-[#0B0D12]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{c.name}</span>
                  <span className="text-xs text-[#5F6270] shrink-0">{times[c.id]}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-[#8B8D98] truncate">{previews[c.id]}</span>
                  {unread[c.id] > 0 && (
                    <span className="bg-[#7C6FE0] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                      {unread[c.id]}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex-col min-w-0 ${mobileView === "chat" ? "flex" : "hidden md:flex"}`}>
        {active && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E212B]">
              <button className="md:hidden text-[#8B8D98]" onClick={() => setMobileView("list")}>
                <ArrowRight size={20} />
              </button>
              <Avatar name={active.name} initials={active.initials} color={active.color} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{active.name}</div>
                <div className="text-xs text-[#5F6270]">{active.online ? "آنلاین" : "آخرین بازدید اخیرا"}</div>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.from === "me" ? "bg-[#4A3FA0] text-white rounded-bl-md" : "bg-[#1B1E28] text-[#E7E8EC] rounded-br-md"
                    }`}
                  >
                    <div>{m.text}</div>
                    <div className={`flex items-center gap-1 mt-1 justify-end ${m.from === "me" ? "text-[#C9C4EE]" : "text-[#5F6270]"}`}>
                      <span className="text-[10px]">{m.time}</span>
                      {m.from === "me" && (m.status === "read" ? <CheckCheck size={13} /> : <Check size={13} />)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-3 py-3 border-t border-[#1E212B] flex items-center gap-2">
              <Paperclip size={19} className="text-[#8B8D98] shrink-0" />
              <div className="flex-1 bg-[#151821] rounded-full px-4 py-2 flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="پیام بنویس..."
                  className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC]"
                />
                <Smile size={18} className="text-[#8B8D98] shrink-0" />
              </div>
              <button
                onClick={sendMessage}
                className="w-9 h-9 rounded-full bg-[#7C6FE0] flex items-center justify-center shrink-0 hover:bg-[#6C5FD0] transition-colors"
              >
                <Send size={16} className="text-white" style={{ transform: "scaleX(-1)" }} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
   }
