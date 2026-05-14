import {
  BarChart3,
  BookOpen,
  Bug,
  Code,
  Database,
  FileText,
  Headphones,
  Image,
  Lightbulb,
  Mail,
  Megaphone,
  MessageCircle,
  PieChart,
  PanelsTopLeft,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Target,
  TestTube,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAgentBrandColor } from '@/lib/brand';

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  Bug,
  Code,
  Database,
  FileText,
  Headphones,
  Image,
  Lightbulb,
  Mail,
  Megaphone,
  MessageCircle,
  PieChart,
  PanelsTopLeft,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Target,
  TestTube,
  UserCheck,
  UserPlus,
  Users,
};

interface AgentAvatarProps {
  icon: string;
  color: string;
  department?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: {
    box: 'h-10 w-10',
    icon: 'h-5 w-5',
  },
  md: {
    box: 'h-12 w-12',
    icon: 'h-5 w-5',
  },
  lg: {
    box: 'h-16 w-16',
    icon: 'h-7 w-7',
  },
};

export function AgentAvatar({ icon, color, department, size = 'md', className }: AgentAvatarProps) {
  const Icon = iconMap[icon] ?? BarChart3;
  const selectedSize = sizes[size];
  const brandColor = getAgentBrandColor({ color, department });

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-white shadow-sm',
        selectedSize.box,
        className
      )}
      style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
    >
      <Icon className={selectedSize.icon} />
    </div>
  );
}
