import { ExcelCellsMap } from './excelTypes';

export type ExcelCorrectionCriterionType =
  | 'value'              // Check evaluated computed value of cell (e.g. 1500 in C10)
  | 'formula'            // Check exact formula string (e.g. "=SOMME(B2:B5)")
  | 'required_function'  // Check if formula contains a function (e.g. "SOMME")
  | 'forbidden_function';// Check if forbidden (e.g. hardcoding without formula)

export interface ExcelCorrectionCriterion {
  id: string;
  type: ExcelCorrectionCriterionType;
  cell: string; // Coordinate of the cell to check, e.g. "C10", "D2"
  expected?: string | number | boolean;
  expected_formula?: string; // e.g. "=SOMME(B2:B5)"
  function_name?: string; // e.g. "SOMME", "MOYENNE"
  description: string; // User-facing feedback description (e.g. "Le total en C10 est égal à 1500")
  required?: boolean; // Default true
}

export interface ExcelChallengeConfig {
  initial_data: ExcelCellsMap; // Initial grid data (labels, headers, input numbers)
  target_cells: string[]; // Coordinates of cells the learner needs to complete, e.g. ["C5"]
  editable_cells?: string[]; // Optional specific editable whitelist (if omitted, target_cells are editable)
  criteria: ExcelCorrectionCriterion[]; // Validation criteria list
  grid_cols?: number; // Default: 6 (A-F)
  grid_rows?: number; // Default: 20 (1-20)
  allowed_functions?: string[]; // Recommended or highlighted Excel functions
}

/**
 * Starter template for a new Excel Challenge
 */
export const DEFAULT_EXCEL_CHALLENGE_CONFIG: ExcelChallengeConfig = {
  initial_data: {
    A1: { value: 'Produit' },
    B1: { value: 'Prix Unitaire' },
    C1: { value: 'Quantité' },
    D1: { value: 'Total' },
    A2: { value: 'Clavier Pro' },
    B2: { value: '45' },
    C2: { value: '2' },
    A3: { value: 'Souris Sans Fil' },
    B3: { value: '25' },
    C3: { value: '3' },
    A4: { value: 'Écran 27"' },
    B4: { value: '220' },
    C4: { value: '1' },
    A5: { value: 'TOTAL GÉNÉRAL' }
  },
  target_cells: ['D2', 'D3', 'D4', 'D5'],
  criteria: [
    {
      id: 'crit-1',
      type: 'value',
      cell: 'D2',
      expected: 90,
      description: 'Le total du premier produit (D2) est égal à 90',
      required: true
    },
    {
      id: 'crit-2',
      type: 'formula',
      cell: 'D2',
      expected_formula: '=B2*C2',
      description: 'La formule en D2 multiplie le prix par la quantité (=B2*C2)',
      required: true
    },
    {
      id: 'crit-3',
      type: 'required_function',
      cell: 'D5',
      function_name: 'SOMME',
      description: 'La cellule D5 utilise la fonction SOMME pour totaliser les montants',
      required: true
    },
    {
      id: 'crit-4',
      type: 'value',
      cell: 'D5',
      expected: 385,
      description: 'Le total général en D5 est égal à 385',
      required: true
    }
  ],
  grid_cols: 6,
  grid_rows: 20
};

export interface ExcelPresetTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  instructions: string;
  hint: string;
  config: ExcelChallengeConfig;
}

export const EXCEL_PRESET_TEMPLATES: ExcelPresetTemplate[] = [
  {
    id: 'sales_total',
    name: 'Total et Multiplication',
    description: 'Calculer des totaux de lignes puis une somme globale.',
    title: 'Calculer le montant total d’une commande',
    instructions: '1. Dans les cellules D2, D3 et D4, calculez le montant total de chaque produit en multipliant le prix unitaire par la quantité.\n2. Dans la cellule D5, calculez le total général de la commande à l’aide de la fonction SOMME.',
    hint: 'Pour multiplier deux cellules, utilisez le symbole * (ex: =B2*C2). Pour le total général, utilisez =SOMME(D2:D4).',
    config: DEFAULT_EXCEL_CHALLENGE_CONFIG
  },
  {
    id: 'average_grades',
    name: 'Moyenne des notes',
    description: 'Calculer la moyenne des notes d’un groupe d’élèves avec la fonction MOYENNE.',
    title: 'Calculer la moyenne générale',
    instructions: 'Dans la cellule B6, calculez la moyenne des notes de la classe à l’aide de la formule MOYENNE.',
    hint: 'Utilisez la fonction =MOYENNE(B2:B5).',
    config: {
      initial_data: {
        A1: { value: 'Étudiant' },
        B1: { value: 'Note / 20' },
        A2: { value: 'Alice' },
        B2: { value: '16' },
        A3: { value: 'Bob' },
        B3: { value: '14' },
        A4: { value: 'Claire' },
        B4: { value: '18' },
        A5: { value: 'David' },
        B5: { value: '12' },
        A6: { value: 'MOYENNE' }
      },
      target_cells: ['B6'],
      criteria: [
        {
          id: 'crit-avg-fn',
          type: 'required_function',
          cell: 'B6',
          function_name: 'MOYENNE',
          description: 'La cellule B6 utilise la formule MOYENNE',
          required: true
        },
        {
          id: 'crit-avg-val',
          type: 'value',
          cell: 'B6',
          expected: 15,
          description: 'La moyenne calculée en B6 est égale à 15',
          required: true
        }
      ],
      grid_cols: 6,
      grid_rows: 15
    }
  },
  {
    id: 'blank',
    name: 'Grille Vierge',
    description: 'Partir d’une grille Excel entièrement vide.',
    title: 'Défi Formule Excel',
    instructions: 'Saisissez vos instructions ici...',
    hint: 'Indice facultatif...',
    config: {
      initial_data: {},
      target_cells: ['B2'],
      criteria: [
        {
          id: 'crit-blank-1',
          type: 'value',
          cell: 'B2',
          expected: '',
          description: 'Vérification de la cellule B2',
          required: true
        }
      ],
      grid_cols: 6,
      grid_rows: 20
    }
  }
];
