/**
 * WebR Package Manager (Gestionnaire de packages WebR)
 * 
 * Manages WebAssembly-compatible R package installation, dependency resolution,
 * package status tracking, and concurrency locks for the ECP R environment.
 */

export type PackageStatus = 'not_installed' | 'checking' | 'installing' | 'installed' | 'unavailable' | 'error';

export interface PackageStatusInfo {
  name: string;
  status: PackageStatus;
  message?: string;
  error?: string;
  lastChecked?: number;
}

export interface PackageInstallResult {
  pkg: string;
  success: boolean;
  alreadyInstalled: boolean;
  message: string;
  errorType?: 'not_found' | 'network' | 'webr' | 'unknown';
}

export interface PackageProgressEvent {
  pkg: string;
  type: 'checking' | 'installing' | 'installed' | 'unavailable' | 'error';
  message: string;
}

export type PackageProgressListener = (event: PackageProgressEvent) => void;

/**
 * List of known packages tested and verified with WebR 0.6.0 on Wasm.
 */
export const WEBR_KNOWN_PACKAGES: Record<string, { title: string; category: string }> = {
  ggplot2: { title: 'Visualisation de données avancée (Grammar of Graphics)', category: 'Graphiques' },
  dplyr: { title: 'Manipulation et transformation de données', category: 'Data Wrangling' },
  tidyr: { title: 'Nettoyage et restructuration de tableaux (tidy data)', category: 'Data Wrangling' },
  readr: { title: 'Importation rapide de fichiers texte et CSV', category: 'Import / Export' },
  readxl: { title: 'Lecture de fichiers Excel (.xls, .xlsx)', category: 'Import / Export' },
  stringr: { title: 'Manipulation de chaînes de caractères et expressions régulières', category: 'Texte' },
  lubridate: { title: 'Gestion simplifiée des dates et heures', category: 'Dates' },
  janitor: { title: 'Nettoyage des noms de colonnes et tables croisées', category: 'Data Wrangling' },
  tibble: { title: 'Data frames modernes', category: 'Data Wrangling' },
  purrr: { title: 'Programmation fonctionnelle et itérations', category: 'Programmation' },
  forcats: { title: 'Gestion des variables qualitatives (facteurs)', category: 'Data Wrangling' },
  scales: { title: 'Formatage des axes et échelles graphiques', category: 'Graphiques' },
  jsonlite: { title: 'Lecture et écriture de données JSON', category: 'Import / Export' },
  corrplot: { title: 'Visualisation des matrices de corrélation', category: 'Statistiques' },
  glue: { title: 'Interpolation élégante de chaînes', category: 'Texte' },
};

/**
 * Global cache of package statuses to prevent redundant evaluations and installations.
 */
const packageStatusCache = new Map<string, PackageStatusInfo>();

/**
 * In-flight installation promises map to prevent concurrent race conditions
 * when multiple scripts request the same package simultaneously.
 */
const inFlightInstalls = new Map<string, Promise<PackageInstallResult>>();

/**
 * Listeners for package events.
 */
const progressListeners = new Set<PackageProgressListener>();

/**
 * Subscribe to package installation progress events.
 */
export function subscribePackageProgress(listener: PackageProgressListener): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

function notifyPackageProgress(event: PackageProgressEvent): void {
  progressListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.warn('Erreur dans le listener de progression package:', err);
    }
  });
}

/**
 * Safely parses R code to extract package references from:
 * - library(pkg) / library("pkg") / library('pkg')
 * - require(pkg) / require("pkg") / require('pkg')
 * - install.packages("pkg") / install.packages(c("pkg1", "pkg2"))
 * - pkg::function() calls
 * 
 * Respects R comments (# ...) and quoted strings to prevent false positives.
 */
export function extractPackageRequirements(rawCode: string): {
  requiredPackages: string[];
  explicitInstalls: string[];
  namespacePackages: string[];
} {
  if (!rawCode || typeof rawCode !== 'string') {
    return { requiredPackages: [], explicitInstalls: [], namespacePackages: [] };
  }

  const requiredPackages = new Set<string>();
  const explicitInstalls = new Set<string>();
  const namespacePackages = new Set<string>();

  // Strip R comments (# to end of line)
  const linesWithoutComments = rawCode
    .split('\n')
    .map(line => {
      // Find comment # that is not inside quotes
      let inQuote: string | null = null;
      let escape = false;
      let commentIdx = -1;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (inQuote) {
          if (char === inQuote) inQuote = null;
        } else {
          if (char === '"' || char === "'") {
            inQuote = char;
          } else if (char === '#') {
            commentIdx = i;
            break;
          }
        }
      }
      return commentIdx !== -1 ? line.substring(0, commentIdx) : line;
    })
    .join('\n');

  // 1. Match install.packages(...)
  // Examples:
  // install.packages("ggplot2")
  // install.packages('dplyr')
  // install.packages(c("ggplot2", "dplyr", "readxl"))
  const installRegex = /install\.packages\s*\(\s*(?:pkgs\s*=\s*)?(?:c\s*\(\s*([^)]+)\s*\)|["']([a-zA-Z0-9._]+)["'])/g;
  let match: RegExpExecArray | null;
  while ((match = installRegex.exec(linesWithoutComments)) !== null) {
    if (match[1]) {
      // Vector of packages: "pkg1", "pkg2"
      const innerTokens = match[1].match(/["']([a-zA-Z0-9._]+)["']/g);
      if (innerTokens) {
        innerTokens.forEach(t => {
          const clean = t.replace(/["']/g, '').trim();
          if (clean && isValidRIdentifier(clean)) {
            explicitInstalls.add(clean);
          }
        });
      }
    } else if (match[2]) {
      const clean = match[2].trim();
      if (clean && isValidRIdentifier(clean)) {
        explicitInstalls.add(clean);
      }
    }
  }

  // 2. Match library(...) and require(...)
  // Examples:
  // library(ggplot2)
  // library("ggplot2")
  // library(package = ggplot2)
  // require(dplyr)
  // require("dplyr", quietly = TRUE)
  const libRegex = /\b(?:library|require)\s*\(\s*(?:package\s*=\s*)?(?:["']([a-zA-Z0-9._]+)["']|([a-zA-Z0-9._]+))/g;
  while ((match = libRegex.exec(linesWithoutComments)) !== null) {
    const pkgName = match[1] || match[2];
    if (pkgName) {
      const clean = pkgName.trim();
      // Exclude standard R base/core packages that are already built into WebR
      if (clean && isValidRIdentifier(clean) && !isStandardBaseRPackage(clean)) {
        requiredPackages.add(clean);
      }
    }
  }

  // 3. Match namespace calls: pkg::function() or pkg:::function()
  const nsRegex = /\b([a-zA-Z0-9._]+):::?[a-zA-Z0-9._]+/g;
  while ((match = nsRegex.exec(linesWithoutComments)) !== null) {
    const pkgName = match[1];
    if (pkgName && isValidRIdentifier(pkgName) && !isStandardBaseRPackage(pkgName)) {
      namespacePackages.add(pkgName);
    }
  }

  return {
    requiredPackages: Array.from(requiredPackages),
    explicitInstalls: Array.from(explicitInstalls),
    namespacePackages: Array.from(namespacePackages),
  };
}

function isValidRIdentifier(name: string): boolean {
  return /^[a-zA-Z.][a-zA-Z0-9._]*$/.test(name);
}

/**
 * Returns true for R built-in packages that are always bundled in base R.
 */
function isStandardBaseRPackage(pkg: string): boolean {
  const basePackages = new Set([
    'base', 'stats', 'utils', 'graphics', 'grDevices', 'methods', 'datasets', 'tools', 'grid', 'splines', 'webr'
  ]);
  return basePackages.has(pkg.toLowerCase());
}

/**
 * Checks if a package is currently installed and loadable in the active WebR session.
 */
export async function isPackageInstalled(webrInstance: any, pkgName: string): Promise<boolean> {
  if (!webrInstance || !pkgName) return false;

  const cached = packageStatusCache.get(pkgName);
  if (cached && cached.status === 'installed') {
    return true;
  }

  try {
    // Check using requireNamespace without attaching to search path
    const isInstalled = await webrInstance.evalRBoolean(
      `isTRUE(requireNamespace("${pkgName}", quietly = TRUE))`
    );
    if (isInstalled) {
      packageStatusCache.set(pkgName, {
        name: pkgName,
        status: 'installed',
        lastChecked: Date.now(),
      });
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Installs a single R package using WebR's binary repository.
 * Guarantees mutex / concurrency locking so duplicate parallel calls return the same promise.
 */
export async function installWebRPackage(
  webrInstance: any,
  pkgName: string,
  onProgress?: (event: PackageProgressEvent) => void
): Promise<PackageInstallResult> {
  if (!webrInstance) {
    return {
      pkg: pkgName,
      success: false,
      alreadyInstalled: false,
      message: "Le moteur WebR n'est pas initialisé.",
      errorType: 'webr',
    };
  }

  const cleanPkg = pkgName.trim();
  if (!cleanPkg || !isValidRIdentifier(cleanPkg)) {
    return {
      pkg: cleanPkg,
      success: false,
      alreadyInstalled: false,
      message: `Nom de package invalide : "${cleanPkg}".`,
      errorType: 'not_found',
    };
  }

  // 1. Check if already installed
  const alreadyPresent = await isPackageInstalled(webrInstance, cleanPkg);
  if (alreadyPresent) {
    const event: PackageProgressEvent = {
      pkg: cleanPkg,
      type: 'installed',
      message: `✅ Le package « ${cleanPkg} » est déjà installé et prêt à l'emploi.`,
    };
    notifyPackageProgress(event);
    if (onProgress) onProgress(event);

    return {
      pkg: cleanPkg,
      success: true,
      alreadyInstalled: true,
      message: `Le package « ${cleanPkg} » est déjà disponible.`,
    };
  }

  // 2. Check if an installation is already running in-flight for this package
  if (inFlightInstalls.has(cleanPkg)) {
    return inFlightInstalls.get(cleanPkg)!;
  }

  // 3. Start installation
  const installPromise = (async (): Promise<PackageInstallResult> => {
    packageStatusCache.set(cleanPkg, {
      name: cleanPkg,
      status: 'installing',
      lastChecked: Date.now(),
    });

    const startEvent: PackageProgressEvent = {
      pkg: cleanPkg,
      type: 'installing',
      message: `📦 Installation du package R « ${cleanPkg} » (binaire WebAssembly)...`,
    };
    notifyPackageProgress(startEvent);
    if (onProgress) onProgress(startEvent);

    try {
      // Check online status in browser
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('NETWORK_OFFLINE');
      }

      // Call webR.installPackages with mount enabled
      await webrInstance.installPackages(cleanPkg, {
        mount: true,
        quiet: true,
      });

      // Verify that package is now genuinely loadable
      const verifyInstalled = await webrInstance.evalRBoolean(
        `isTRUE(requireNamespace("${cleanPkg}", quietly = TRUE))`
      );

      if (verifyInstalled) {
        packageStatusCache.set(cleanPkg, {
          name: cleanPkg,
          status: 'installed',
          lastChecked: Date.now(),
        });

        const successEvent: PackageProgressEvent = {
          pkg: cleanPkg,
          type: 'installed',
          message: `✅ Le package « ${cleanPkg} » a été installé avec succès et est prêt.`,
        };
        notifyPackageProgress(successEvent);
        if (onProgress) onProgress(successEvent);

        return {
          pkg: cleanPkg,
          success: true,
          alreadyInstalled: false,
          message: `Package « ${cleanPkg} » installé avec succès.`,
        };
      } else {
        // Installation completed without throwing, but package is not found/loadable in R
        packageStatusCache.set(cleanPkg, {
          name: cleanPkg,
          status: 'unavailable',
          error: `Package « ${cleanPkg} » introuvable dans le dépôt binaire WebR.`,
          lastChecked: Date.now(),
        });

        const unavailEvent: PackageProgressEvent = {
          pkg: cleanPkg,
          type: 'unavailable',
          message: `❌ Impossible d'utiliser « ${cleanPkg} » dans WebR : ce package n'est probablement pas disponible sous forme de binaire WebAssembly compatible.`,
        };
        notifyPackageProgress(unavailEvent);
        if (onProgress) onProgress(unavailEvent);

        return {
          pkg: cleanPkg,
          success: false,
          alreadyInstalled: false,
          message: `Le package « ${cleanPkg} » n'est pas disponible pour WebR (WebAssembly).`,
          errorType: 'not_found',
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err || '');

      let errorType: 'not_found' | 'network' | 'webr' | 'unknown' = 'unknown';
      let userFrenchMsg = `❌ Impossible d'installer le package « ${cleanPkg} ».`;

      if (errMsg.includes('NETWORK_OFFLINE') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        errorType = 'network';
        userFrenchMsg = `❌ Erreur réseau : impossible de télécharger « ${cleanPkg} ». Vérifiez votre connexion internet.`;
      } else if (errMsg.includes('not found in webR') || errMsg.includes('404') || errMsg.includes('not found')) {
        errorType = 'not_found';
        userFrenchMsg = `❌ Le package « ${cleanPkg} » n'est pas disponible sous forme de binaire WebAssembly pour WebR.`;
      } else {
        errorType = 'webr';
        userFrenchMsg = `❌ Erreur lors de l'installation de « ${cleanPkg} » : ${errMsg}`;
      }

      packageStatusCache.set(cleanPkg, {
        name: cleanPkg,
        status: 'error',
        error: userFrenchMsg,
        lastChecked: Date.now(),
      });

      const errEvent: PackageProgressEvent = {
        pkg: cleanPkg,
        type: 'error',
        message: userFrenchMsg,
      };
      notifyPackageProgress(errEvent);
      if (onProgress) onProgress(errEvent);

      return {
        pkg: cleanPkg,
        success: false,
        alreadyInstalled: false,
        message: userFrenchMsg,
        errorType,
      };
    } finally {
      inFlightInstalls.delete(cleanPkg);
    }
  })();

  inFlightInstalls.set(cleanPkg, installPromise);
  return installPromise;
}

/**
 * Prepares and ensures that all required packages for a given R code string are installed.
 * Handles auto-detection of library(), require(), and explicit install.packages().
 */
export async function ensurePackagesForCode(
  webrInstance: any,
  code: string,
  onProgress?: (event: PackageProgressEvent) => void
): Promise<{
  success: boolean;
  messages: string[];
  installedPackages: string[];
  failedPackages: string[];
}> {
  const { requiredPackages, explicitInstalls, namespacePackages } = extractPackageRequirements(code);
  
  // Combine all targets uniquely
  const allNeeded = Array.from(new Set([...explicitInstalls, ...requiredPackages, ...namespacePackages]));

  if (allNeeded.length === 0) {
    return {
      success: true,
      messages: [],
      installedPackages: [],
      failedPackages: [],
    };
  }

  const messages: string[] = [];
  const installedPackages: string[] = [];
  const failedPackages: string[] = [];

  for (const pkg of allNeeded) {
    const result = await installWebRPackage(webrInstance, pkg, onProgress);
    if (result.success) {
      if (!result.alreadyInstalled) {
        installedPackages.push(pkg);
        messages.push(`📦 [Package WebR] ${pkg} installé avec succès.`);
      }
    } else {
      failedPackages.push(pkg);
      messages.push(`❌ [Package WebR] ${result.message}`);
    }
  }

  return {
    success: failedPackages.length === 0,
    messages,
    installedPackages,
    failedPackages,
  };
}

/**
 * Returns current snapshot of all tracked packages in the application.
 */
export function getTrackedPackages(): PackageStatusInfo[] {
  return Array.from(packageStatusCache.values());
}
