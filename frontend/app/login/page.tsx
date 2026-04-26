"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) router.replace("/");
  }, [router]);

  return <LoginForm onSuccess={() => router.replace("/")} />;
}
