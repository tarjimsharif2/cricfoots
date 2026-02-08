interface FootballTimerProps {
  minute: number;
  seconds: number;
}

const FootballTimer = ({ minute, seconds }: FootballTimerProps) => {
  const minStr = minute.toString().padStart(2, '0');
  const secStr = seconds.toString().padStart(2, '0');

  return (
    <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-xs font-bold font-mono tabular-nums">
        {minStr}:{secStr}
      </span>
    </div>
  );
};

export default FootballTimer;
