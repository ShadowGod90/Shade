import React, { useState, useRef, useEffect } from "react";
import {
  Search, Send, Paperclip, Smile, MoreVertical, ArrowRight, Check, CheckCheck,
  Phone, ShieldCheck, Plus, Users, Radio, Camera, MapPin, File as FileIcon,
  Video, Mic, MicOff, Volume2, VolumeX, PhoneOff, Edit3, LogOut, UserPlus,
  MessageCircle, X, Forward, Pin, Flag, Ban, Palette, HardDrive, Compass, Trash2,
} from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { Geolocation } from "@capacitor/geolocation";
import { Share } from "@capacitor/share";
import { Contacts } from "@capacitor-community/contacts";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

const AUTH_STORAGE_KEY = "shade_auth_phone";
const PROFILE_STORAGE_KEY = "shade_profile";
const THEME_STORAGE_KEY = "shade_theme";
const WALLPAPER_STORAGE_KEY = "shade_wallpapers";

const AVATAR_COLORS = ["#7C6FE0", "#4FA3A0", "#C77D5A", "#B0578D", "#5B8DBE", "#5DCAA5", "#D08C3E", "#6C7CE0"];
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const THEMES = {
  dark: { bg: "#0B0D12", panel: "#12151C", panel2: "#151821", border: "#1E212B", border2: "#2A2E3A", text: "#E7E8EC", textDim: "#8B8D98", textFaint: "#5F6270", bubbleThem: "#1B1E28" },
  gray: { bg: "#2A2D34", panel: "#33363E", panel2: "#3A3D46", border: "#454852", border2: "#565A66", text: "#F0F0F2", textDim: "#B7B9C2", textFaint: "#8C8F99", bubbleThem: "#3A3D46" },
  light: { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F0F1F4", border: "#E4E6EB", border2: "#D5D8DE", text: "#1A1B1F", textDim: "#6B6E76", textFaint: "#9497A0", bubbleThem: "#FFFFFF" },
};
const THEME_LABELS = { dark: "مشکی", gray: "خاکستری", light: "سفید" };

const AUTO_REPLIES = [
  "باشه، متوجه شدم",
  "عالیه، ممنون",
  "الان بررسی می‌کنم",
  "حتما، بهت خبر می‌دم",
  "درسته، موافقم",
];

function initialsOf(name) {
  const clean = (name || "؟").trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] || "") + (parts[1][0] || "");
  return clean.slice(0, 2);
}

function colorFromString(str) {
  let hash = 0;
  const s = str || "x";
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function nowTime() {
  return new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
  if (!bytes) return "۰ بایت";
  const units = ["بایت", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function resizeImageFile(file, maxSize = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  // ---- auth flow ----
  const [authStep, setAuthStep] = useState("checking"); // checking | phone | otp | profile | app
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const verificationIdRef = useRef(null);

  // ---- profile ----
  const [profile, setProfile] = useState({ username: "", bio: "", avatar: "" });
  const [draftProfile, setDraftProfile] = useState({ username: "", bio: "", avatar: "" });
  const [profileError, setProfileError] = useState("");
  const [editDraft, setEditDraft] = useState({ username: "", bio: "", avatar: "" });
  const [editingProfile, setEditingProfile] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const setupAvatarInputRef = useRef(null);
  const avatarEditInputRef = useRef(null);

  // ---- settings sub-screens ----
  const [showAppearance, setShowAppearance] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showChannelExplore, setShowChannelExplore] = useState(false);
  const [exploreQuery, setExploreQuery] = useState("");
  const [theme, setTheme] = useState("dark");

  // ---- chats ----
  const [chats, setChats] = useState({});
  const [messagesByChat, setMessagesByChat] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [mobileView, setMobileView] = useState("list"); // list | chat
  const [wallpapers, setWallpapers] = useState({});
  const scrollRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // ---- new chat / group / channel ----
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showContactsScreen, setShowContactsScreen] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsErr, setContactsErr] = useState("");
  const [creatingType, setCreatingType] = useState(null); // null | 'group' | 'channel'
  const [newChatName, setNewChatName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newChatDiscoverable, setNewChatDiscoverable] = useState(true);

  // ---- attachments ----
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const mediaInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ---- message actions ----
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showForwardScreen, setShowForwardScreen] = useState(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const touchState = useRef({ x: 0, moved: false, timer: null });

  // ---- calls ----
  const [activeCall, setActiveCall] = useState(null); // { chat, type: 'voice'|'video' }
  const [callConnected, setCallConnected] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  const active = activeId ? chats[activeId] : null;
  const messages = activeId ? messagesByChat[activeId] || [] : [];
  const chatList = Object.values(chats).filter((c) => c.name.includes(query.trim()));
  const t = THEMES[theme] || THEMES.dark;
  const themeVars = {
    "--bg": t.bg, "--panel": t.panel, "--panel2": t.panel2, "--border": t.border, "--border2": t.border2,
    "--text": t.text, "--textDim": t.textDim, "--textFaint": t.textFaint, "--bubbleThem": t.bubbleThem,
  };
  const activeWallpaper = activeId ? (wallpapers[activeId] || wallpapers.default) : null;

  // ---- restore session ----
  useEffect(() => {
    (async () => {
      try {
        const storedPhone = await Preferences.get({ key: AUTH_STORAGE_KEY });
        const storedProfile = await Preferences.get({ key: PROFILE_STORAGE_KEY });
        const storedTheme = await Preferences.get({ key: THEME_STORAGE_KEY });
        const storedWallpapers = await Preferences.get({ key: WALLPAPER_STORAGE_KEY });
        if (storedTheme.value) setTheme(storedTheme.value);
        if (storedWallpapers.value) {
          try { setWallpapers(JSON.parse(storedWallpapers.value)); } catch {}
        }
        if (storedPhone.value && storedProfile.value) {
          setPhone(storedPhone.value);
          setProfile(JSON.parse(storedProfile.value));
          setAuthStep("app");
        } else if (storedPhone.value) {
          setPhone(storedPhone.value);
          setAuthStep("profile");
        } else {
          setAuthStep("phone");
        }
      } catch {
        setAuthStep("phone");
      }
    })();
  }, []);

  // ---- firebase phone-auth listeners ----
  useEffect(() => {
    const sentHandle = FirebaseAuthentication.addListener("phoneCodeSent", (event) => {
      verificationIdRef.current = event.verificationId;
      setOtp(["", "", "", "", ""]);
      setOtpError("");
      setPhoneError("");
      setResendTimer(45);
      setAuthStep("otp");
    });
    const failedHandle = FirebaseAuthentication.addListener("phoneVerificationFailed", (event) => {
      setPhoneError((event && event.message) || "ارسال کد ناموفق بود، دوباره تلاش کن");
    });
    const completedHandle = FirebaseAuthentication.addListener("phoneVerificationCompleted", () => {
      // Android auto-detected the SMS and verified automatically, no code entry needed
      Preferences.set({ key: AUTH_STORAGE_KEY, value: phone });
      setDraftProfile({ username: "", bio: "", avatar: "" });
      setAuthStep("profile");
    });
    return () => {
      sentHandle.then((h) => h.remove());
      failedHandle.then((h) => h.remove());
      completedHandle.then((h) => h.remove());
    };
  }, [phone]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t2 = setInterval(() => setResendTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t2);
  }, [resendTimer]);

  // ---- load device contacts when needed ----
  useEffect(() => {
    if (!showContactsScreen && !creatingType) return;
    (async () => {
      setContactsLoading(true);
      setContactsErr("");
      try {
        const perm = await Contacts.requestPermissions();
        if (perm.contacts !== "granted") {
          setContactsErr("اجازه‌ی دسترسی به مخاطبین داده نشد.");
          setContactsLoading(false);
          return;
        }
        const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
        const list = (result.contacts || [])
          .filter((c) => c.name && c.name.display)
          .map((c) => ({
            id: c.contactId,
            name: c.name.display,
            phone: (c.phones && c.phones[0] && c.phones[0].number) || "",
          }));
        setDeviceContacts(list);
      } catch (err) {
        setContactsErr("دسترسی به مخاطبین ممکن نشد (فقط روی گوشی واقعی کار می‌کند).");
      }
      setContactsLoading(false);
    })();
  }, [showContactsScreen, creatingType]);

  // ---- call timers ----
  useEffect(() => {
    if (!activeCall) return;
    setCallConnected(false);
    setCallSeconds(0);
    const tt = setTimeout(() => setCallConnected(true), 1800);
    return () => clearTimeout(tt);
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall || !callConnected) return;
    const tt = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(tt);
  }, [activeCall, callConnected]);

  function formatCallTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function persistWallpapers(next) {
    setWallpapers(next);
    Preferences.set({ key: WALLPAPER_STORAGE_KEY, value: JSON.stringify(next) });
  }

  function changeTheme(next) {
    setTheme(next);
    Preferences.set({ key: THEME_STORAGE_KEY, value: next });
  }

  function openChat(id) {
    setActiveId(id);
    setChats((prev) => ({ ...prev, [id]: { ...prev[id], unread: 0 } }));
    setMobileView("chat");
    setReplyingTo(null);
    setShowChatMenu(false);
  }

  function pushMessage(chatId, partial) {
    const time = nowTime();
    const msg = { id: Date.now() + Math.random(), from: "me", time, status: "sent", ...partial };
    setMessagesByChat((prev) => ({ ...prev, [chatId]: [...(prev[chatId] || []), msg] }));
    const preview =
      msg.type === "image" ? "📷 عکس" :
      msg.type === "video" ? "🎥 ویدیو" :
      msg.type === "file" ? `📎 ${msg.fileName}` :
      msg.type === "location" ? "📍 موقعیت مکانی" : msg.text;
    setChats((prev) => ({ ...prev, [chatId]: { ...prev[chatId], lastMessage: preview, lastTime: time } }));

    const chat = chats[chatId];
    if (chat && !chat.isGroup && !chat.isChannel && !chat.blocked) {
      setTimeout(() => {
        const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
        const replyTime = nowTime();
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), { id: Date.now() + Math.random(), from: "them", type: "text", text: reply, time: replyTime }],
        }));
        setChats((prev) => ({ ...prev, [chatId]: { ...prev[chatId], lastMessage: reply, lastTime: replyTime } }));
      }, 1400 + Math.random() * 900);
    }
  }

  function buildReplySnippet() {
    if (!replyingTo) return null;
    const label =
      replyingTo.type === "text" ? replyingTo.text :
      replyingTo.type === "image" ? "📷 عکس" :
      replyingTo.type === "video" ? "🎥 ویدیو" :
      replyingTo.type === "file" ? `📎 ${replyingTo.fileName}` : "📍 موقعیت مکانی";
    return { text: label, from: replyingTo.from };
  }

  function sendTextMessage() {
    const text = input.trim();
    if (!text || !activeId || active?.blocked) return;
    pushMessage(activeId, { type: "text", text, replyTo: buildReplySnippet() });
    setInput("");
    setReplyingTo(null);
  }

  function handleAttachmentFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !activeId || active?.blocked) return;
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const type = isImage ? "image" : isVideo ? "video" : "file";
    pushMessage(activeId, { type, mediaUrl: url, fileName: file.name, fileSize: file.size, replyTo: buildReplySnippet() });
    e.target.value = "";
    setShowAttachSheet(false);
    setReplyingTo(null);
  }

  async function handleShareLocation() {
    setShowAttachSheet(false);
    if (!activeId || active?.blocked) return;
    try {
      const pos = await Geolocation.getCurrentPosition();
      pushMessage(activeId, { type: "location", lat: pos.coords.latitude, lng: pos.coords.longitude, replyTo: buildReplySnippet() });
      setReplyingTo(null);
    } catch {
      window.alert("دسترسی به موقعیت مکانی ممکن نشد.");
    }
  }

  function startChatWithContact(contact) {
    const id = `c-${contact.phone || contact.name}`;
    setChats((prev) => {
      if (prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          id, name: contact.name, initials: initialsOf(contact.name), color: colorFromString(contact.name),
          online: Math.random() > 0.5, isGroup: false, isChannel: false, blocked: false,
          lastMessage: "", lastTime: "", unread: 0,
        },
      };
    });
    setMessagesByChat((prev) => ({ ...prev, [id]: prev[id] || [] }));
    setActiveId(id);
    setMobileView("chat");
    setShowContactsScreen(false);
  }

  async function inviteContact(contact) {
    try {
      await Share.share({
        title: "دعوت به Shade",
        text: `سلام ${contact.name}! بیا با اپ Shade باهم چت کنیم.`,
        dialogTitle: "دعوت به Shade",
      });
    } catch {}
  }

  function createGroupOrChannel() {
    if (!newChatName.trim()) return;
    const type = creatingType;
    const name = newChatName.trim();
    const id = `${type}-${Date.now()}`;
    setChats((prev) => ({
      ...prev,
      [id]: {
        id, name, initials: initialsOf(name), color: colorFromString(name), online: false,
        isGroup: type === "group", isChannel: type === "channel", blocked: false,
        discoverable: type === "channel" ? newChatDiscoverable : false,
        membersCount: selectedMembers.length + 1, lastMessage: "", lastTime: "", unread: 0,
      },
    }));
    setMessagesByChat((prev) => ({ ...prev, [id]: [] }));
    setActiveId(id);
    setMobileView("chat");
    setCreatingType(null);
  }

  function toE164(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("0")) return "+98" + digits.slice(1);
    if (digits.startsWith("98")) return "+" + digits;
    return "+98" + digits;
  }

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("شماره موبایل معتبر نیست");
      return;
    }
    setPhoneError("");
    setSendingCode(true);
    try {
      await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: toE164(phone) });
      // "phoneCodeSent" listener (registered on mount) will move us to the otp step
    } catch (err) {
      setPhoneError("ارسال کد ناموفق بود. اتصال اینترنت یا شماره را بررسی کن.");
    }
    setSendingCode(false);
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
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  async function handleVerify() {
    const entered = otp.join("");
    if (entered.length < 5) { setOtpError("کد ۵ رقمی را کامل وارد کنید"); return; }
    if (!verificationIdRef.current) { setOtpError("خطا در تایید، دوباره کد را ارسال کن"); return; }
    setVerifying(true);
    try {
      await FirebaseAuthentication.confirmVerificationCode({
        verificationId: verificationIdRef.current,
        verificationCode: entered,
      });
      Preferences.set({ key: AUTH_STORAGE_KEY, value: phone });
      setDraftProfile({ username: "", bio: "", avatar: "" });
      setAuthStep("profile");
    } catch (err) {
      setOtpError("کد وارد شده اشتباه است");
    }
    setVerifying(false);
  }


  function handleLogout() {
    if (!window.confirm("از حساب خارج شوید؟")) return;
    FirebaseAuthentication.signOut();
    Preferences.remove({ key: AUTH_STORAGE_KEY });
    Preferences.remove({ key: PROFILE_STORAGE_KEY });
    setPhone("");
    setProfile({ username: "", bio: "", avatar: "" });
    setChats({});
    setMessagesByChat({});
    setActiveId(null);
    setShowAccountSheet(false);
    setAuthStep("phone");
  }

  async function handleAvatarPick(e, target) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 320);
      if (target === "setup") setDraftProfile((p) => ({ ...p, avatar: dataUrl }));
      else setEditDraft((p) => ({ ...p, avatar: dataUrl }));
    } catch {}
    e.target.value = "";
  }

  async function handleWallpaperPick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !activeId) return;
    try {
      const dataUrl = await resizeImageFile(file, 700, 0.75);
      persistWallpapers({ ...wallpapers, [activeId]: dataUrl });
    } catch {}
    e.target.value = "";
    setShowChatMenu(false);
                                 }
      
