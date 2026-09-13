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
