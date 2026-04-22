"use client";

import Banner from "@/layout/Banner";
import HomePageIntro from "@/components/hub/HomePageIntro";
import BaseFormStaticPages from "@/layout/BaseFormStaticPages";

export default function Home() {
  return (
    <BaseFormStaticPages title="Home" subTitle="Simple feedback platform">
      <div className="space-y-4">
        <Banner />
        <HomePageIntro />
      </div>
    </BaseFormStaticPages>
  );
}
