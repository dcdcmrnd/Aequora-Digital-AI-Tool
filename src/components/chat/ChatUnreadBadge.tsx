"use client";

import { useState, useEffect } from "react";

export function ChatUnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/chat/unread");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;

  return (
    <span className="ml-auto w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
      {count > 9 ? "9+" : count}
    </span>
  );
}
