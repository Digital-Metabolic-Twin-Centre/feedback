import type { MDXComponents } from 'mdx/types';
import { useMDXComponents as getWikiComponents } from '@/app/wiki/components/mdx-components';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return getWikiComponents(components);
}
