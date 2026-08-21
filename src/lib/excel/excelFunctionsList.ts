import { ExcelFunctionItem } from './excelTypes';

export const EXCEL_FUNCTIONS: ExcelFunctionItem[] = [
  {
    name: 'SOMME',
    syntax: '=SOMME(nombre1; [nombre2]; ...)',
    category: 'Math',
    description: 'Calcule la somme de tous les nombres d\'une plage de cellules.',
    example: '=SOMME(B2:B10)'
  },
  {
    name: 'MOYENNE',
    syntax: '=MOYENNE(nombre1; [nombre2]; ...)',
    category: 'Statistiques',
    description: 'Renvoie la moyenne arithmétique des arguments donnés.',
    example: '=MOYENNE(C2:C15)'
  },
  {
    name: 'SI',
    syntax: '=SI(test_logique; valeur_si_vrai; [valeur_si_faux])',
    category: 'Logique',
    description: 'Effectue un test logique et renvoie une valeur selon que la condition est VRAIE ou FAUSSE.',
    example: '=SI(B2>=10; "Admis"; "Ajourné")'
  },
  {
    name: 'MIN',
    syntax: '=MIN(nombre1; [nombre2]; ...)',
    category: 'Statistiques',
    description: 'Renvoie le plus petit nombre parmi un ensemble de valeurs.',
    example: '=MIN(D2:D20)'
  },
  {
    name: 'MAX',
    syntax: '=MAX(nombre1; [nombre2]; ...)',
    category: 'Statistiques',
    description: 'Renvoie le plus grand nombre parmi un ensemble de valeurs.',
    example: '=MAX(D2:D20)'
  },
  {
    name: 'NB',
    syntax: '=NB(valeur1; [valeur2]; ...)',
    category: 'Statistiques',
    description: 'Compte le nombre de cellules contenant des nombres.',
    example: '=NB(A1:A50)'
  },
  {
    name: 'CONCATENER',
    syntax: '=CONCATENER(texte1; [texte2]; ...)',
    category: 'Texte',
    description: 'Assemble plusieurs chaînes de texte en une seule.',
    example: '=CONCATENER(A2; " "; B2)'
  },
  {
    name: 'RECHERCHEV',
    syntax: '=RECHERCHEV(valeur_cherchée; table_matrice; no_index_col; [valeur_proche])',
    category: 'Recherche',
    description: 'Cherche une valeur dans la première colonne d\'un tableau et renvoie une valeur dans la même ligne d\'une autre colonne.',
    example: '=RECHERCHEV(A2; G2:H10; 2; FAUX)'
  }
];
