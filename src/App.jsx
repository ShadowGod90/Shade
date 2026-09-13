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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

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

  async function syncProfileToFirestore(uname, bio, avatar) {
    try {
      const current = await FirebaseAuthentication.getCurrentUser();
      const uid = current && current.user && current.user.uid;
      if (!uid) return;
      const e164 = toE164(phone);
      await setDoc(doc(db, "users", uid), {
        phone: e164,
        username: uname,
        bio: bio || "",
        avatar: avatar || "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, "phoneIndex", e164), { uid }, { merge: true });
    } catch (err) {
      console.error("Firestore profile sync failed", err);
    }
  }

  function handleFinishProfileSetup() {
    const uname = draftProfile.username.trim();
    if (!uname) { setProfileError("نام کاربری را وارد کنید"); return; }
    const finalProfile = { username: uname, bio: draftProfile.bio.trim(), avatar: draftProfile.avatar };
    Preferences.set({ key: PROFILE_STORAGE_KEY, value: JSON.stringify(finalProfile) });
    setProfile(finalProfile);
    syncProfileToFirestore(finalProfile.username, finalProfile.bio, finalProfile.avatar);
    setAuthStep("app");
  }

  function openEditProfile() {
    setEditDraft(profile);
    setEditingProfile(true);
    setShowAccountSheet(false);
  }

  function saveEditedProfile() {
    const uname = editDraft.username.trim();
    if (!uname) return;
    const updated = { username: uname, bio: editDraft.bio.trim(), avatar: editDraft.avatar };
    Preferences.set({ key: PROFILE_STORAGE_KEY, value: JSON.stringify(updated) });
    setProfile(updated);
    syncProfileToFirestore(updated.username, updated.bio, updated.avatar);
    setEditingProfile(false);
  }


  function startCall(chat, type) {
    setActiveCall({ chat, type });
    setMicMuted(false);
    setSpeakerOn(false);
  }

  // ---- chat menu actions ----
  function handleClearHistory() {
    if (!activeId) return;
    if (!window.confirm("تاریخچه‌ی این گفتگو پاک شود؟")) return;
    setMessagesByChat((prev) => ({ ...prev, [activeId]: [] }));
    setChats((prev) => ({ ...prev, [activeId]: { ...prev[activeId], lastMessage: "", lastTime: "" } }));
    setShowChatMenu(false);
  }

  function handleReportChat() {
    window.alert("گزارش شما ثبت شد (این بخش نمایشی است).");
    setShowChatMenu(false);
  }

  function handleToggleBlock() {
    if (!activeId) return;
    setChats((prev) => ({ ...prev, [activeId]: { ...prev[activeId], blocked: !prev[activeId].blocked } }));
    setShowChatMenu(false);
  }

  function handleLeaveChat() {
    if (!activeId) return;
    if (!window.confirm("از این گفتگو خارج شوید؟")) return;
    setChats((prev) => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });
    setMessagesByChat((prev) => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });
    setActiveId(null);
    setMobileView("list");
    setShowChatMenu(false);
  }

  // ---- message actions ----
  function reactToMessage(msg, emoji) {
    if (!activeId) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] || []).map((m) => (m.id === msg.id ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m)),
    }));
    setSelectedMessage(null);
  }

  function togglePinMessage(msg) {
    if (!activeId) return;
    setMessagesByChat((prev) => ({
      ...prev,
      [activeId]: (prev[activeId] || []).map((m) => (m.id === msg.id ? { ...m, pinned: !m.pinned } : m)),
    }));
    setSelectedMessage(null);
  }

  function forwardMessageTo(chatId) {
    const m = showForwardScreen;
    if (!m) return;
    pushMessage(chatId, { type: m.type, text: m.text, mediaUrl: m.mediaUrl, fileName: m.fileName, fileSize: m.fileSize, lat: m.lat, lng: m.lng, forwarded: true });
    setShowForwardScreen(null);
  }

  // ---- touch gestures on messages ----
  function handleMsgTouchStart(e, m) {
    touchState.current.x = e.touches[0].clientX;
    touchState.current.moved = false;
    touchState.current.timer = setTimeout(() => {
      if (!touchState.current.moved) setSelectedMessage(m);
    }, 450);
  }
  function handleMsgTouchMove(e) {
    const dx = e.touches[0].clientX - touchState.current.x;
    if (Math.abs(dx) > 12) {
      touchState.current.moved = true;
      clearTimeout(touchState.current.timer);
    }
  }
  function handleMsgTouchEnd(e, m) {
    clearTimeout(touchState.current.timer);
    if (m.from === "them" && touchState.current.moved) {
      const dx = e.changedTouches[0].clientX - touchState.current.x;
      if (Math.abs(dx) > 60) setReplyingTo(m);
    }
  }

  // ---- storage stats ----
  function computeStorageStats() {
    let totalBytes = 0;
    const perType = { image: 0, video: 0, file: 0 };
    Object.values(messagesByChat).forEach((msgs) => {
      msgs.forEach((m) => {
        if (m.fileSize) {
          totalBytes += m.fileSize;
          if (perType[m.type] !== undefined) perType[m.type] += m.fileSize;
        }
      });
    });
    return { totalBytes, perType };
  }

  // ================= AUTH SCREENS =================

  if (authStep === "checking") {
    return (
      <div className="w-full flex items-center justify-center bg-[#0B0D12]" style={{ height: "100dvh" }}>
        <img src="/favicon.png" alt="Shade" className="w-16 h-16 rounded-2xl object-cover" />
      </div>
    );
  }

  if (authStep === "phone" || authStep === "otp") {
    return (
      <div
        dir="rtl"
        className="w-full flex flex-col items-center justify-center bg-[#0B0D12] text-[#E7E8EC] px-6"
        style={{ height: "100dvh", fontFamily: "system-ui, sans-serif", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-full max-w-[340px] flex flex-col items-center">
          <img src="/favicon.png" alt="Shade" className="w-16 h-16 rounded-2xl object-cover mb-5" />
          {authStep === "phone" ? (
            <>
              <h1 className="text-xl font-medium mb-1.5">شماره موبایل خود را وارد کنید</h1>
              <p className="text-sm text-[#8B8D98] text-center mb-6">کد تایید برای این شماره پیامک می‌شود</p>
              <div className="w-full flex items-center gap-2 bg-[#151821] rounded-xl px-4 py-3 mb-2">
                <Phone size={17} className="text-[#8B8D98] shrink-0" />
                <input
                  type="tel" inputMode="numeric" dir="ltr" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  placeholder="09123456789"
                  className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC] text-left"
                />
              </div>
              {phoneError && <p className="text-xs text-[#E2807E] w-full text-right mb-2">{phoneError}</p>}
              <button onClick={handleSendCode} disabled={sendingCode} className="w-full mt-4 bg-[#7C6FE0] hover:bg-[#6C5FD0] transition-colors text-white text-sm font-medium rounded-xl py-3 disabled:opacity-60">
                {sendingCode ? "در حال ارسال..." : "ارسال کد تایید"}
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium mb-1.5">کد تایید را وارد کنید</h1>
              <p className="text-sm text-[#8B8D98] text-center mb-1">کد ۵ رقمی پیامک‌شده به شماره</p>
              <p className="text-sm text-[#E7E8EC] mb-5" dir="ltr">{phone}</p>
              <div dir="ltr" className="flex items-center justify-center gap-2 mb-2">
                {otp.map((d, i) => (
                  <input
                    key={i} ref={(el) => (otpRefs.current[i] = el)} value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    inputMode="numeric" maxLength={1}
                    className="w-11 h-12 text-center text-lg bg-[#151821] rounded-lg outline-none text-[#E7E8EC] border border-[#2A2E3A] focus:border-[#7C6FE0]"
                  />
                ))}
              </div>
              {otpError && <p className="text-xs text-[#E2807E] w-full text-center mb-2">{otpError}</p>}
              <button onClick={handleVerify} disabled={verifying} className="w-full mt-4 bg-[#7C6FE0] hover:bg-[#6C5FD0] transition-colors text-white text-sm font-medium rounded-xl py-3 disabled:opacity-60">
                {verifying ? "در حال تایید..." : "تایید و ورود"}
              </button>
              <div className="flex items-center justify-between w-full mt-4">
                <button onClick={() => setAuthStep("phone")} className="text-xs text-[#8B8D98] hover:text-[#E7E8EC]">ویرایش شماره</button>
                <button onClick={() => resendTimer === 0 && handleSendCode()} className={`text-xs ${resendTimer === 0 ? "text-[#7C6FE0]" : "text-[#5F6270]"}`}>
                  {resendTimer === 0 ? "ارسال مجدد کد" : `ارسال مجدد (${resendTimer})`}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    );
  }

  if (authStep === "profile") {
    return (
      <div
        dir="rtl"
        className="w-full flex flex-col items-center justify-center bg-[#0B0D12] text-[#E7E8EC] px-6"
        style={{ height: "100dvh", fontFamily: "system-ui, sans-serif", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="w-full max-w-[340px] flex flex-col items-center">
          <h1 className="text-xl font-medium mb-1.5">پروفایلت رو بساز</h1>
          <p className="text-sm text-[#8B8D98] text-center mb-6">یه نام کاربری و عکس انتخاب کن</p>

          <button onClick={() => setupAvatarInputRef.current && setupAvatarInputRef.current.click()} className="relative mb-5">
            {draftProfile.avatar ? (
              <img src={draftProfile.avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#151821] border border-[#2A2E3A] flex items-center justify-center">
                <Camera size={26} className="text-[#5F6270]" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 bg-[#7C6FE0] rounded-full p-1.5">
              <Camera size={14} className="text-white" />
            </span>
          </button>
          <input ref={setupAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarPick(e, "setup")} />

          <div className="w-full bg-[#151821] rounded-xl px-4 py-3 mb-2">
            <input
              value={draftProfile.username}
              onChange={(e) => setDraftProfile((p) => ({ ...p, username: e.target.value }))}
              placeholder="نام کاربری"
              className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC]"
            />
          </div>
          {profileError && <p className="text-xs text-[#E2807E] w-full text-right mb-2">{profileError}</p>}
          <div className="w-full bg-[#151821] rounded-xl px-4 py-3 mb-4">
            <textarea
              value={draftProfile.bio}
              onChange={(e) => setDraftProfile((p) => ({ ...p, bio: e.target.value }))}
              placeholder="بیوگرافی (اختیاری)"
              rows={2}
              className="bg-transparent outline-none text-sm w-full placeholder-[#5F6270] text-[#E7E8EC] resize-none"
            />
          </div>
          <button onClick={handleFinishProfileSetup} className="w-full bg-[#7C6FE0] hover:bg-[#6C5FD0] transition-colors text-white text-sm font-medium rounded-xl py-3">
            ادامه
          </button>
        </div>
      </div>
    );
  }

  // ================= MAIN APP =================

  return (
    <div
      dir="rtl"
      className="w-full flex bg-[var(--bg)] text-[var(--text)] overflow-hidden relative"
      style={{ ...themeVars, height: "100dvh", fontFamily: "system-ui, sans-serif", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Sidebar */}
      <div className={`w-full md:w-[320px] shrink-0 border-l border-[var(--border)] flex-col relative ${mobileView === "list" ? "flex" : "hidden md:flex"}`}>
        <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Shade" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-lg font-medium tracking-tight">Shade</span>
          </div>
          <button onClick={() => setShowAccountSheet(true)} aria-label="حساب کاربری">
            <MoreVertical size={18} className="text-[var(--textDim)]" />
          </button>
        </div>
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 bg-[var(--panel2)] rounded-lg px-3 py-2">
            <Search size={16} className="text-[var(--textDim)]" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در گفتگوها"
              className="bg-transparent outline-none text-sm w-full placeholder-[var(--textFaint)] text-[var(--text)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chatList.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              <p className="text-sm text-[var(--textFaint)]">هنوز گفتگویی نداری</p>
              <p className="text-xs text-[var(--textFaint)] mt-1">با دکمه‌ی + یه چت، گروه یا کانال جدید بساز</p>
            </div>
          )}
          {chatList.map((c) => (
            <button
              key={c.id} onClick={() => openChat(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${activeId === c.id ? "bg-[var(--panel)]" : "hover:bg-[var(--panel2)]"}`}
            >
              <div className="relative">
                <Avatar name={c.name} initials={c.initials} color={c.color} />
                {c.online && !c.isGroup && !c.isChannel && (
                  <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-[#5DCAA5] border-2 border-[var(--bg)]" />
                )}
                {(c.isGroup || c.isChannel) && (
                  <span className="absolute bottom-0 left-0 w-4 h-4 rounded-full bg-[var(--panel)] border border-[var(--bg)] flex items-center justify-center">
                    {c.isGroup ? <Users size={9} className="text-[var(--textDim)]" /> : <Radio size={9} className="text-[var(--textDim)]" />}
                  </span>
                )}
                {c.blocked && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#E2534E] flex items-center justify-center">
                    <Ban size={9} className="text-white" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{c.name}</span>
                  <span className="text-xs text-[var(--textFaint)] shrink-0">{c.lastTime}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-[var(--textDim)] truncate">{c.lastMessage || "چت جدید"}</span>
                  {c.unread > 0 && (
                    <span className="bg-[#7C6FE0] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">{c.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* FAB */}
        <div className="absolute bottom-6 left-6">
          {showNewMenu && (
            <div className="absolute bottom-16 left-0 bg-[var(--panel)] border border-[var(--border2)] rounded-xl overflow-hidden w-48 shadow-lg">
              <button onClick={() => { setShowNewMenu(false); setShowContactsScreen(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)]">
                <MessageCircle size={16} /> چت جدید
              </button>
              <button onClick={() => { setShowNewMenu(false); setCreatingType("group"); setNewChatName(""); setSelectedMembers([]); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)]">
                <Users size={16} /> گروه جدید
              </button>
              <button onClick={() => { setShowNewMenu(false); setCreatingType("channel"); setNewChatName(""); setSelectedMembers([]); setNewChatDiscoverable(true); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)]">
                <Radio size={16} /> کانال جدید
              </button>
            </div>
          )}
          <button onClick={() => setShowNewMenu((v) => !v)} className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7C6FE0] to-[#4FA3A0] flex items-center justify-center shadow-lg">
            <Plus size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex-col min-w-0 ${mobileView === "chat" ? "flex" : "hidden md:flex"}`}>
        {active && (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] relative">
              <button className="md:hidden text-[var(--textDim)]" onClick={() => setMobileView("list")}>
                <ArrowRight size={20} />
              </button>
              <Avatar name={active.name} initials={active.initials} color={active.color} size={36} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{active.name}</div>
                <div className="text-xs text-[var(--textFaint)]">
                  {active.blocked ? "مسدود شده" : active.isGroup || active.isChannel ? `${active.membersCount || 1} عضو` : active.online ? "آنلاین" : "آخرین بازدید اخیرا"}
                </div>
              </div>
              {!active.isChannel && (
                <>
                  <button onClick={() => startCall(active, "voice")} className="text-[var(--textDim)] hover:text-[var(--text)]"><Phone size={19} /></button>
                  <button onClick={() => startCall(active, "video")} className="text-[var(--textDim)] hover:text-[var(--text)]"><Video size={19} /></button>
                </>
              )}
              <button onClick={() => setShowChatMenu((v) => !v)} className="text-[var(--textDim)]"><MoreVertical size={19} /></button>

              {showChatMenu && (
                <div className="absolute left-4 top-14 z-40 bg-[var(--panel)] border border-[var(--border2)] rounded-xl overflow-hidden w-52 shadow-lg">
                  <button onClick={handleClearHistory} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)]">
                    <Trash2 size={16} /> پاک کردن تاریخچه
                  </button>
                  <button onClick={handleReportChat} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)]">
                    <Flag size={16} /> گزارش گفتگو
                  </button>
                  {active.isGroup || active.isChannel ? (
                    <button onClick={handleLeaveChat} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)] text-[#E2807E]">
                      <Ban size={16} /> ترک {active.isGroup ? "گروه" : "کانال"}
                    </button>
                  ) : (
                    <button onClick={handleToggleBlock} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)] text-[#E2807E]">
                      <Ban size={16} /> {active.blocked ? "رفع مسدودیت" : "مسدود کردن"}
                    </button>
                  )}
                  <button onClick={() => wallpaperInputRef.current && wallpaperInputRef.current.click()} className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--panel2)] border-t border-[var(--border)]">
                    <Camera size={16} /> تغییر پس‌زمینه
                  </button>
                </div>
              )}
              <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaperPick} />
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-cover bg-center"
              style={activeWallpaper ? { backgroundImage: `url(${activeWallpaper})` } : {}}
            >
              {active.blocked && (
                <div className="text-center text-xs text-[#E2807E] bg-[var(--panel)] border border-[var(--border2)] rounded-lg py-2 px-3 mx-auto">
                  این مخاطب مسدود شده — پیام جدید ارسال یا دریافت نمی‌شود
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.from === "me" ? "bg-gradient-to-br from-[#4A3FA0] to-[#3D6E86] text-white rounded-bl-md" : "bg-[var(--bubbleThem)] text-[var(--text)] rounded-br-md"}`}
                    onTouchStart={(e) => handleMsgTouchStart(e, m)}
                    onTouchMove={handleMsgTouchMove}
                    onTouchEnd={(e) => handleMsgTouchEnd(e, m)}
                  >
                    {m.pinned && <Pin size={11} className="absolute -top-1.5 -right-1.5 text-[#7C6FE0] bg-[var(--bg)] rounded-full p-0.5" />}
                    {m.forwarded && <div className="text-[10px] opacity-60 mb-1">بازارسال‌شده</div>}
                    {m.replyTo && (
                      <div className="border-r-2 border-white/40 pr-2 mb-1 text-xs opacity-70 truncate">{m.replyTo.text}</div>
                    )}
                    {m.type === "image" && <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full mb-1 max-h-64 object-cover" />}
                    {m.type === "video" && <video src={m.mediaUrl} controls className="rounded-lg max-w-full mb-1 max-h-64" />}
                    {m.type === "file" && (
                      <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-2 mb-1">
                        <FileIcon size={18} />
                        <span className="text-xs truncate">{m.fileName}</span>
                      </div>
                    )}
                    {m.type === "location" && (
                      <a href={`https://www.google.com/maps?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-2 mb-1">
                        <MapPin size={18} />
                        <span className="text-xs">مشاهده‌ی موقعیت مکانی</span>
                      </a>
                    )}
                    {m.type === "text" && <div>{m.text}</div>}
                    <div className={`flex items-center gap-1 mt-1 justify-end ${m.from === "me" ? "text-[#C9C4EE]" : "text-[var(--textFaint)]"}`}>
                      <span className="text-[10px]">{m.time}</span>
                      {m.from === "me" && (m.status === "read" ? <CheckCheck size={13} /> : <Check size={13} />)}
                    </div>
                    {m.reaction && (
                      <span className="absolute -bottom-2 -left-1 bg-[var(--panel)] border border-[var(--border2)] rounded-full text-xs px-1 leading-tight">{m.reaction}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {replyingTo && (
              <div className="px-4 pt-2 pb-1 flex items-center gap-2 bg-[var(--panel)] border-t border-[var(--border)]">
                <div className="flex-1 border-r-2 border-[#7C6FE0] pr-2 py-1 text-xs text-[var(--textDim)] truncate">
                  پاسخ به: {buildReplySnippet()?.text}
                </div>
                <button onClick={() => setReplyingTo(null)}><X size={14} className="text-[var(--textDim)]" /></button>
              </div>
            )}

            <div className="px-3 py-3 border-t border-[var(--border)] flex items-center gap-2 relative">
              {showAttachSheet && (
                <div className="absolute bottom-16 right-3 bg-[var(--panel)] border border-[var(--border2)] rounded-xl overflow-hidden w-52 shadow-lg">
                  <button onClick={() => mediaInputRef.current && mediaInputRef.current.click()} className="w-full flex items-center gap-2 px-4 py-3 text-sm 
