"use client";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { ProgressBar, ProgressCircle } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { useJobs } from "./JobsContext";

/**
 * Global background-work indicator, always in the SAME toolbar slot. // HIG: progress-indicators "consistent location"
 * Active jobs → circular indicator + count. Click → popover (glass regular) with the job list.
 */
export function JobsIndicator() {
  const { jobs, activeCount } = useJobs();
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  if (activeCount === 0) return null;
  const overall = active.reduce((sum, j) => sum + (j.stage - 1 + (j.total ? j.progress / j.total : 0)) / 5, 0) / active.length;

  return (
    <Popover
      label="Arka plan işleri"
      trigger={(p) => (
        <button {...p} className="hit inline-flex items-center gap-1.5 px-2 rounded-control hover:bg-fill-tertiary t-footnote text-label">
          <ProgressCircle value={overall} label="Toplam işlem ilerlemesi" />
          <span aria-hidden>{activeCount}</span>
          <span className="sr-only">{activeCount} aktif iş</span>
        </button>
      )}
    >
      <Text variant="headline" as="h2" className="px-2 py-1">Arka Plan İşleri</Text>
      <ul className="max-h-80 overflow-auto">
        {active.map((j) => (
          <li key={j.id} className="px-2 py-2 space-y-1">
            <Text variant="body" truncate as="p">{j.title}</Text>
            <ProgressBar value={j.total ? (j.stage - 1 + j.progress / j.total) / 5 : null} label={`${j.title} ilerlemesi`} />
            <Text variant="footnote" color="secondary" as="p" className="inline-flex items-center gap-1">
              <Icon name="arrow.clockwise" scale="small" className="text-status-processing" />
              {j.stageName} · {j.stage}/5
            </Text>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
