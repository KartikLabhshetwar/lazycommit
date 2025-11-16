
import Image from "next/image";
import { cn } from "~/styles/utils";

export function Logo({ className, ...props }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="lazycommit logo"
      width={50}
      height={50}
      className={cn("w-6 h-6", className)}
      priority
      {...props}
    />
  );
}
