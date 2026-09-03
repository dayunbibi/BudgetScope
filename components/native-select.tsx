import { cn } from "@/lib/utils";

// shadcn Select는 Base UI 기반 client 컴포넌트라 Server Action <form> 안에서 name 전송이 번거롭다.
// 네이티브 <select>를 shadcn Input과 같은 톤으로 스타일링해서 그대로 form에 넣는다.
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}
