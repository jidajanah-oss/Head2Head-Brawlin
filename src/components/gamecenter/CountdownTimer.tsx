import { useEffect, useState } from "react";

interface CountdownTimerProps {
  kickoff: string;
  locked: boolean;
}

function getTimeRemaining(kickoff: string): string {
  const kickoffTime = new Date(kickoff).getTime();
  const lockTime = kickoffTime - 5 * 60 * 1000;
  const diff = lockTime - Date.now();

  if (diff <= 0) return "Locked";

  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;

  return `Locks in ${minutes}m`;
}

function CountdownTimer({ kickoff, locked }: CountdownTimerProps) {
  const [label, setLabel] = useState(() => getTimeRemaining(kickoff));

  useEffect(() => {
    setLabel(getTimeRemaining(kickoff));

    const timerId = window.setInterval(() => {
      setLabel(getTimeRemaining(kickoff));
    }, 30_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [kickoff]);

  return <span className="countdown-timer">{locked ? "Locked" : label}</span>;
}

export default CountdownTimer;