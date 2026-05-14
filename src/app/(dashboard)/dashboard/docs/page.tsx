import { docCategories, internalDocs } from '@/lib/docs/internal-docs';
import { DocsCenterClient } from './DocsCenterClient';

export default function DocsPage() {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#F1F7F7] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <DocsCenterClient docs={internalDocs} categories={docCategories} />
      </div>
    </div>
  );
}
