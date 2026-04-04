"use client";

import { useState } from "react";
import { StoryRow } from "@/lib/types";
import ProjectSection from "@/components/dashboard/ProjectSection";
import SettingsSection from "@/components/dashboard/SettingsSection";
import MaterialSection from "@/components/dashboard/MaterialSection";
import MapSection from "@/components/dashboard/MapSection";
import SettingSection from "@/components/dashboard/SettingSection";
import StorySection from "@/components/dashboard/StorySection";

export default function DashboardPage() {
  const [address, setAddress] = useState("");
  const [storyRows, setStoryRows] = useState<StoryRow[]>([]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-gray-400 mt-1">MIDAS GEN NX API Dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProjectSection onAddressChange={setAddress} storyRows={storyRows} />
        <div className="space-y-6">
          <SettingsSection />
          <MaterialSection storyRows={storyRows} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MapSection address={address} />
        <SettingSection />
        <StorySection onRowsChange={setStoryRows} />
      </div>
    </div>
  );
}
