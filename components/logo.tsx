import Image, { type ImageProps } from "next/image";

export const WEBSPACEAI_LOGO_URL =
  "img/b5556be9-1da8-4fdb-a6b9-969b73491798 (1).png";

export default function Logo({
  alt = "WEBSPACEAI",
  width = 150,
  height = 36,
  className,
  ...props
}: Omit<ImageProps, "src" | "alt"> & { alt?: string }) {
  return (
    <Image
      src={WEBSPACEAI_LOGO_URL}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority
      {...props}
    />
  );
}
