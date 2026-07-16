'use client';

import { useState, useCallback } from 'react';
import { LifeBuoy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputStyles, Label } from '@/components/ui/FormControls';
import { buttonStyles } from '@/components/ui/Button';
import { createSupportTicketAction } from '@/actions/customer-success/actions';
import { toast } from '@/components/ui/toast';

interface CreateTicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORIES = ['general', 'billing', 'technical', 'feature-request', 'account', 'other'];

export function CreateTicketForm({ isOpen, onClose, onCreated }: CreateTicketFormProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const result = await createSupportTicketAction({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        category,
      });
      if (result.ok) {
        toast.success('Ticket created', { description: 'Our team will review it shortly.' });
        setSubject('');
        setDescription('');
        setPriority('normal');
        setCategory('general');
        onClose();
        onCreated?.();
      } else {
        toast.error(result.error || 'Failed to create ticket');
      }
    } finally {
      setSubmitting(false);
    }
  }, [subject, description, priority, category, onClose, onCreated]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">New Support Ticket</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-foreground-muted/50 hover:bg-foreground-muted/10 hover:text-foreground-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <Label>Subject</Label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={160}
              className={cn(inputStyles(), 'w-full')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={cn(inputStyles(), 'w-full')}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={cn(inputStyles(), 'w-full')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={5}
              maxLength={5000}
              className={cn(inputStyles(), 'w-full resize-none')}
            />
            <p className="mt-1 text-right text-[10px] text-foreground-muted">{description.length}/5000</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-divider px-5 py-3">
          <button type="button" onClick={onClose} className={buttonStyles({ variant: 'ghost', size: 'sm' })}>Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !subject.trim() || !description.trim()}
            className={buttonStyles({ variant: 'primary', size: 'sm' })}
          >
            {submitting ? 'Creating...' : 'Create ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
