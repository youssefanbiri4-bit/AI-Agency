'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  Star,
  Download,
  ArrowRight,
  Tag,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/FormControls';

interface MarketplaceAgent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  category: string;
  icon: string;
  accentColor: string;
  tags: string[];
  usageCount: number;
  shareSlug: string | null;
  averageRating: number;
  ratingCount: number;
  priceUsd: number;
  isFree: boolean;
  safetyLevel: string;
  featured: boolean;
}

interface MarketplaceGalleryProps {
  agents: MarketplaceAgent[];
  categories: Array<{ category: string; count: number }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onSearch?: (query: string) => void;
  onFilter?: (filters: { category?: string; priceType?: string; sortBy?: string }) => void;
  onPageChange?: (page: number) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  research: '🔍',
  content: '✍️',
  sales: '💼',
  development: '💻',
  analytics: '📊',
  marketing: '📣',
  operations: '⚙️',
};

export function MarketplaceGallery({
  agents,
  categories,
  total,
  page,
  pageSize: _pageSize,
  totalPages,
  onSearch,
  onFilter,
  onPageChange,
}: MarketplaceGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPriceType, setSelectedPriceType] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('popular');

  const handleSearch = () => {
    onSearch?.(searchQuery);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    onFilter?.({ category: category || undefined, priceType: selectedPriceType, sortBy: selectedSort });
  };

  const handlePriceTypeChange = (priceType: string) => {
    setSelectedPriceType(priceType);
    onFilter?.({ category: selectedCategory || undefined, priceType, sortBy: selectedSort });
  };

  const handleSortChange = (sortBy: string) => {
    setSelectedSort(sortBy);
    onFilter?.({ category: selectedCategory || undefined, priceType: selectedPriceType, sortBy });
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            placeholder="Search agents by name, role, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-foreground-muted" />
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category} ({cat.count})
              </option>
            ))}
          </select>
        </div>

        {/* Price Filter */}
        <select
          value={selectedPriceType}
          onChange={(e) => handlePriceTypeChange(e.target.value)}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground"
        >
          <option value="all">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        {/* Sort */}
        <select
          value={selectedSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-foreground"
        >
          <option value="popular">Most Popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest Rated</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>

        {/* Results count */}
        <span className="ml-auto text-sm text-foreground-muted">
          {total} agents found
        </span>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <MarketplaceAgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Empty State */}
      {agents.length === 0 && (
        <div className="py-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-foreground-muted" />
          <h3 className="mt-4 text-lg font-bold text-foreground">No agents found</h3>
          <p className="mt-2 text-sm text-foreground-muted">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Agent Card ─────────────────────────────────────────────────────

function MarketplaceAgentCard({ agent }: { agent: MarketplaceAgent }) {
  return (
    <Link
      href={`/dashboard/marketplace/${agent.shareSlug ?? agent.id}`}
      className="group block rounded-xl border border-border bg-surface-elevated p-5 transition-all hover:border-primary/30 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: agent.accentColor + '20', color: agent.accentColor }}
          >
            {CATEGORY_ICONS[agent.category] ?? '🤖'}
          </div>
          <div>
            <h3 className="font-bold text-foreground group-hover:text-primary">
              {agent.name}
            </h3>
            <p className="text-xs text-foreground-muted">{agent.role}</p>
          </div>
        </div>
        {agent.featured && (
          <Badge tone="primary" className="text-xs">
            <Sparkles className="h-3 w-3" />
            Featured
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-sm text-foreground-muted">
        {agent.description ?? 'No description'}
      </p>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="neutral" className="text-xs">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
          {agent.tags.length > 3 && (
            <Badge tone="neutral" className="text-xs">
              +{agent.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {agent.usageCount} installs
        </div>
        {agent.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {agent.averageRating.toFixed(1)}
            <span>({agent.ratingCount})</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {agent.safetyLevel}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-lg font-bold text-foreground">
          {agent.isFree ? 'Free' : `$${agent.priceUsd}`}
        </span>
        <Button variant="ghost" size="sm" className="group-hover:text-primary">
          View Details
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Link>
  );
}
