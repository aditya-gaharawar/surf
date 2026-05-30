import Image, { type ImageProps } from "next/image";

export const WEBSPACEAI_LOGO_URL = "/img/logo.png";

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
