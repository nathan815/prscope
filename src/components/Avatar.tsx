import { useState } from "react";

const sizes: Record<number, { container: string; text: string }> = {
  4: { container: "w-4 h-4", text: "text-[8px]" },
  5: { container: "w-5 h-5", text: "text-[9px]" },
  6: { container: "w-6 h-6", text: "text-[10px]" },
  8: { container: "w-8 h-8", text: "text-xs" },
  16: { container: "w-16 h-16", text: "text-2xl" },
};

export function Avatar({
  name,
  imageUrl,
  size = 6,
  hiRes = false,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
  hiRes?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const s = sizes[size] ?? sizes[6]!;

  if (imageUrl && !failed) {
    const src = hiRes ? `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}size=4` : imageUrl;
    return (
      <img
        src={src}
        alt={name}
        className={`${s.container} rounded-full flex-shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${s.container} rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center ${s.text} font-medium text-zinc-600 dark:text-zinc-300 flex-shrink-0`}
    >
      {name.charAt(0)}
    </div>
  );
}
