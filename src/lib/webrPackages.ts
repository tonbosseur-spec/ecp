import type { WebR } from 'webr';

/** Packages commonly used by ECP training exercises and available when
 * corresponding WebAssembly binaries exist in the configured webR repo. */
export const ECP_WEBR_PACKAGES = [
  'ggplot2',
  'dplyr',
  'tidyr',
  'readr',
  'readxl',
  'stringr',
  'lubridate',
  'janitor',
] as const;

export interface PackageInstallResult {
  success: boolean;
  installed: string[];
  failed: string[];
  error?: string;
}

export async function isPackageInstalled(webR: WebR, pkg: string): Promise<boolean> {
  try {
    return await webR.evalRBoolean(`requireNamespace(${JSON.stringify(pkg)}, quietly = TRUE)`);
  } catch {
    return false;
  }
}

/** Install precompiled WebAssembly R packages using webR's package repository. */
export async function installWebRPackages(
  webR: WebR,
  packages: string[],
  options: { quiet?: boolean; repos?: string | string[]; mount?: boolean } = {},
): Promise<PackageInstallResult> {
  const unique = [...new Set(packages.map(p => p.trim()).filter(Boolean))];
  const installed: string[] = [];
  const failed: string[] = [];

  for (const pkg of unique) {
    if (await isPackageInstalled(webR, pkg)) {
      installed.push(pkg);
      continue;
    }

    try {
      await webR.installPackages(pkg, {
        quiet: options.quiet ?? false,
        repos: options.repos,
        mount: options.mount ?? true,
      });
      if (await isPackageInstalled(webR, pkg)) installed.push(pkg);
      else failed.push(pkg);
    } catch (error) {
      console.warn(`[WebR] Installation failed for ${pkg}:`, error);
      failed.push(pkg);
    }
  }

  return {
    success: failed.length === 0,
    installed,
    failed,
    ...(failed.length ? { error: `Impossible d'installer : ${failed.join(', ')}` } : {}),
  };
}

/** Extract package names from library()/require() calls in student code. */
export function extractLibraryPackages(code: string): string[] {
  const packages = new Set<string>();
  const patterns = [
    /(?:library|require)\s*\(\s*["']?([A-Za-z][A-Za-z0-9._]*)["']?\s*\)/g,
    /(?:library|require)\s*\(\s*package\s*=\s*["']([A-Za-z][A-Za-z0-9._]*)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) packages.add(match[1]);
  }
  return [...packages];
}
