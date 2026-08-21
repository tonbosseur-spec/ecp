/**
 * R Package Manager for Interactive Code R Activities
 * 
 * Centralizes package metadata, WebR compatibility, session-level caching,
 * automated installation, and loading into the WebR execution environment.
 * 
 * Integrates with the existing WebR engine singleton (webrEngine / webrPackages).
 */

import { webrEngine } from './webrEngine';
import {
  isPackageInstalled,
  installWebRPackage,
  PackageProgressEvent,
} from './webrPackages';

export interface RPackageDefinition {
  name: string;
  label: string;
  description: string;
  category?: 'Data Wrangling' | 'Graphiques' | 'Import / Export' | 'Statistiques / ML' | 'Dates / Texte' | 'Autre';
  recommended?: boolean;
}

/**
 * Extensible catalog of common and popular R packages.
 */
export const AVAILABLE_R_PACKAGES: RPackageDefinition[] = [
  {
    name: 'ggplot2',
    label: 'ggplot2',
    description: 'Visualisation graphique avancée (Grammar of Graphics)',
    category: 'Graphiques',
    recommended: true,
  },
  {
    name: 'dplyr',
    label: 'dplyr',
    description: 'Manipulation et transformation des données',
    category: 'Data Wrangling',
    recommended: true,
  },
  {
    name: 'tidyr',
    label: 'tidyr',
    description: 'Nettoyage et restructuration de tableaux (Tidy data)',
    category: 'Data Wrangling',
    recommended: true,
  },
  {
    name: 'readxl',
    label: 'readxl',
    description: 'Importation de fichiers Excel (.xlsx, .xls)',
    category: 'Import / Export',
  },
  {
    name: 'writexl',
    label: 'writexl',
    description: 'Exportation et écriture vers Excel',
    category: 'Import / Export',
  },
  {
    name: 'stringr',
    label: 'stringr',
    description: 'Manipulation de chaînes de caractères et regex',
    category: 'Dates / Texte',
  },
  {
    name: 'lubridate',
    label: 'lubridate',
    description: 'Gestion simplifiée des dates et heures',
    category: 'Dates / Texte',
  },
  {
    name: 'janitor',
    label: 'janitor',
    description: 'Nettoyage des noms de colonnes et tableaux de fréquence',
    category: 'Data Wrangling',
  },
  {
    name: 'tidymodels',
    label: 'tidymodels',
    description: 'Écosystème de modélisation et machine learning',
    category: 'Statistiques / ML',
  },
  {
    name: 'caret',
    label: 'caret',
    description: 'Classification and Regression Training',
    category: 'Statistiques / ML',
  },
  {
    name: 'scales',
    label: 'scales',
    description: 'Mise à l\'échelle et formatage des axes graphiques',
    category: 'Graphiques',
  },
  {
    name: 'corrplot',
    label: 'corrplot',
    description: 'Visualisation des matrices de corrélation',
    category: 'Graphiques',
  },
  {
    name: 'forcats',
    label: 'forcats',
    description: 'Gestion des variables qualitatives (facteurs)',
    category: 'Data Wrangling',
  },
  {
    name: 'purrr',
    label: 'purrr',
    description: 'Programmation fonctionnelle et itérations vectorisées',
    category: 'Data Wrangling',
  },
  {
    name: 'jsonlite',
    label: 'jsonlite',
    description: 'Lecture et sérialisation de données JSON',
    category: 'Import / Export',
  },
];

export interface PackagePreparationStep {
  name: string;
  status: 'pending' | 'checking' | 'installing' | 'loading' | 'ready' | 'error';
  message: string;
  error?: string;
}

export interface RPackagePreparationResult {
  success: boolean;
  packages: string[];
  preparedPackages: string[];
  failedPackages: string[];
  steps: PackagePreparationStep[];
  errorMessage?: string;
}

export type RPackagePrepListener = (steps: PackagePreparationStep[], currentMessage: string) => void;

/**
 * In-memory session cache of successfully loaded packages in the active WebR instance.
 * Prevents redundant installation and re-loading on multiple code runs.
 */
const loadedPackagesSessionCache = new Set<string>();

/**
 * Checks if a package is already loaded and ready in the current session.
 */
export function isPackageLoadedInSession(pkgName: string): boolean {
  if (!pkgName) return false;
  return loadedPackagesSessionCache.has(pkgName.trim().toLowerCase());
}

/**
 * Checks if all requested packages are already loaded in the current session.
 */
export function areAllPackagesLoadedInSession(packageNames: string[]): boolean {
  if (!packageNames || packageNames.length === 0) return true;
  return packageNames.every(p => isPackageLoadedInSession(p));
}

/**
 * Clears the session cache (useful upon full WebR reset).
 */
export function clearPackageSessionCache(): void {
  loadedPackagesSessionCache.clear();
}

/**
 * Normalizes an array of package names from activity configuration.
 */
export function normalizeActivityPackages(config: any): string[] {
  if (!config) return [];
  if (Array.isArray(config.packages)) {
    return config.packages
      .map((p: any) => String(p || '').trim())
      .filter((p: string) => p.length > 0 && /^[a-zA-Z.][a-zA-Z0-9._]*$/.test(p));
  }
  return [];
}

/**
 * Prepares and attaches a list of required R packages into WebR.
 * Workflow for each package:
 * 1. Check if already loaded in this session -> instant ready.
 * 2. Ensure WebR is initialized.
 * 3. Check if installed in WebR -> if not, install via WebR binary repository.
 * 4. Load package via library(pkg, quietly = TRUE) in WebR global environment.
 * 5. Mark as ready in session cache.
 */
export async function prepareActivityRPackages(
  packageNames: string[],
  onProgress?: RPackagePrepListener
): Promise<RPackagePreparationResult> {
  const cleanPackages = Array.from(
    new Set(
      (packageNames || [])
        .map(p => p.trim())
        .filter(p => p.length > 0 && /^[a-zA-Z.][a-zA-Z0-9._]*$/.test(p))
    )
  );

  // If no packages needed, return immediately
  if (cleanPackages.length === 0) {
    return {
      success: true,
      packages: [],
      preparedPackages: [],
      failedPackages: [],
      steps: [],
    };
  }

  // Initialize steps state
  const steps: PackagePreparationStep[] = cleanPackages.map(name => ({
    name,
    status: isPackageLoadedInSession(name) ? 'ready' : 'pending',
    message: isPackageLoadedInSession(name) ? `✓ ${name} prêt` : `En attente de ${name}...`,
  }));

  const notify = (msg: string) => {
    if (onProgress) {
      onProgress([...steps], msg);
    }
  };

  notify("📦 Initialisation de l'environnement R...");

  // 1. Ensure WebR engine is ready
  try {
    if (!webrEngine.isReady()) {
      await webrEngine.init();
    }
  } catch (initErr: any) {
    const errorMsg = initErr?.message || "Impossible d'initialiser WebR.";
    return {
      success: false,
      packages: cleanPackages,
      preparedPackages: [],
      failedPackages: cleanPackages,
      steps: steps.map(s => ({
        ...s,
        status: 'error',
        message: `Échec d'initialisation R`,
        error: errorMsg,
      })),
      errorMessage: `Erreur d'initialisation du moteur WebR : ${errorMsg}`,
    };
  }

  const webRInstance = (webrEngine as any).webRInstance;
  if (!webRInstance) {
    return {
      success: false,
      packages: cleanPackages,
      preparedPackages: [],
      failedPackages: cleanPackages,
      steps: steps.map(s => ({
        ...s,
        status: 'error',
        message: `Moteur R non disponible`,
      })),
      errorMessage: "Le moteur WebR n'est pas disponible.",
    };
  }

  const preparedPackages: string[] = [];
  const failedPackages: string[] = [];

  // 2. Process each package sequentially
  for (let i = 0; i < cleanPackages.length; i++) {
    const pkg = cleanPackages[i];
    const step = steps[i];

    // Check session cache first
    if (isPackageLoadedInSession(pkg)) {
      step.status = 'ready';
      step.message = `✓ ${pkg} prêt`;
      preparedPackages.push(pkg);
      notify(`✓ ${pkg} prêt`);
      continue;
    }

    step.status = 'checking';
    step.message = `Vérification de ${pkg}...`;
    notify(`Vérification de ${pkg}...`);

    try {
      // Step A: Check if installed in WebR
      const isInstalled = await isPackageInstalled(webRInstance, pkg);

      if (!isInstalled) {
        step.status = 'installing';
        step.message = `Installation de ${pkg} (WebAssembly)...`;
        notify(`Installation de ${pkg}...`);

        const installResult = await installWebRPackage(webRInstance, pkg, (evt: PackageProgressEvent) => {
          step.message = evt.message;
          notify(evt.message);
        });

        if (!installResult.success) {
          step.status = 'error';
          step.message = `❌ Impossible d'installer ${pkg}`;
          step.error = installResult.message || `Le package « ${pkg} » n'est pas disponible dans l'environnement WebR actuel.`;
          failedPackages.push(pkg);
          notify(step.message);
          continue;
        }
      }

      // Step B: Load package in WebR session
      step.status = 'loading';
      step.message = `Chargement de ${pkg}...`;
      notify(`Chargement de ${pkg}...`);

      const loadScript = `
        tryCatch({
          suppressPackageStartupMessages(library("${pkg}", character.only = TRUE, quietly = TRUE))
          TRUE
        }, error = function(e) {
          FALSE
        })
      `;

      const loadOk = await webRInstance.evalRBoolean(loadScript);

      if (loadOk) {
        step.status = 'ready';
        step.message = `✓ ${pkg} prêt`;
        loadedPackagesSessionCache.add(pkg.toLowerCase());
        preparedPackages.push(pkg);
        notify(`✓ ${pkg} prêt`);
      } else {
        step.status = 'error';
        step.message = `❌ Échec du chargement de ${pkg}`;
        step.error = `Le package ${pkg} n'a pas pu être chargé dans WebR. Cet exercice nécessite ce package pour fonctionner.`;
        failedPackages.push(pkg);
        notify(step.message);
      }
    } catch (err: any) {
      console.error(`Erreur préparation package ${pkg}:`, err);
      step.status = 'error';
      step.message = `❌ Erreur sur ${pkg}`;
      step.error = err?.message || `Le package « ${pkg} » n'est pas disponible dans l'environnement WebR actuel.`;
      failedPackages.push(pkg);
      notify(step.message);
    }
  }

  const isAllSuccess = failedPackages.length === 0;

  return {
    success: isAllSuccess,
    packages: cleanPackages,
    preparedPackages,
    failedPackages,
    steps,
    errorMessage: !isAllSuccess
      ? `Impossible de charger le(s) package(s) : ${failedPackages.join(', ')}. Cet exercice nécessite ce(s) package(s) pour fonctionner.`
      : undefined,
  };
}
