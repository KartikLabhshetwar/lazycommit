export default function Page() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="tracking-tight">You&apos;re not suppose to be here!</h1>
        <button className="text-muted-foreground font-mono text-xs">
          cd ..
        </button>
      </div>
    </div>
  );
}
