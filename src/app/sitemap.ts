import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const baseUrl = 'https://v2.netix.my.id';

  // Get all approved content
  const { data: contents } = await supabase
    .from('contents')
    .select('id, updated_at')
    .eq('status', 'approved');

  const contentUrls = (contents || []).map((content) => ({
    url: `${baseUrl}/watch/${content.id}`,
    lastModified: content.updated_at || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...contentUrls,
  ];
}
