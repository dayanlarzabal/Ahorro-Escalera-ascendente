import {
  Bean,
  Citrus,
  Flower2,
  GitBranch,
  Leaf,
  MoveVertical,
  Sprout,
  TreeDeciduous,
  Trees,
  Wheat,
  type LucideIcon,
} from "lucide-react";

const ICONS: LucideIcon[] = [
  Bean,
  Sprout,
  MoveVertical,
  GitBranch,
  Leaf,
  Flower2,
  Citrus,
  Wheat,
  TreeDeciduous,
  Trees,
];

export function LevelIcon({ id, className }: { id: number; className?: string }) {
  const Icon = ICONS[id - 1] ?? Bean;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
