import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm opacity-1 z-50">
      <Image
        className="z-[60]"
        src="/images/spinner.gif"
        height={50}
        width={50}
        style={{ width: 50, height: 50 }}
        alt="loading..."
        unoptimized
        priority={false}
      />
    </div>
  );
}
