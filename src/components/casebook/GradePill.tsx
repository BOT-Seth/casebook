const GRADE_STYLE: Record<string, string> = {
  again: 'bg-destructive/15 text-destructive',
  hard: 'bg-warning/15 text-warning',
  good: 'bg-success/15 text-success',
  easy: 'bg-info/15 text-info',
}

export function GradePill({ grade }: { grade: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADE_STYLE[grade] ?? 'bg-muted text-muted-foreground'}`}
    >
      {grade}
    </span>
  )
}
