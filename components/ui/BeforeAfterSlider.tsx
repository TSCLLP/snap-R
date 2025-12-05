"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  before: string;
  after: string;
}

export function BeforeAfterSlider({ before, after }: Props) {
  const [value, setValue] = useState(50);

  return (
    <div className="relative w-full h-80 overflow-hidden rounded-lg bg-black">
      <Image
        src={before}
        alt="Before"
        fill
        className="object-cover absolute inset-0"
      />

      <div
        className="absolute inset-0 overflow-hidden transition-all"
        style={{ width: `${value}%` }}
      >
        <Image
          src={after}
          alt="After"
          fill
          className="object-cover"
        />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="
          absolute bottom-2 left-1/2 -translate-x-1/2
          w-4/5 cursor-pointer
          accent-yellow-400
          opacity-90
        "
      />
    </div>
  );
}

