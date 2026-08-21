import { ExcelEngine, evaluateFormulaString } from './excelEngine';
import { ExcelCellsMap, colNameToIndex, indexToColName, addressToCoord, coordToAddress } from './excelTypes';
import { offsetFormula } from './excelReferences';

export interface TestItemResult {
  name: string;
  category: string;
  success: boolean;
  actual?: any;
  expected?: any;
  details?: string;
  durationMs?: number;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  failedBeforeFix: number;
  results: TestItemResult[];
  performanceMs: number;
}

/**
 * Self-contained comprehensive unit test runner for the Excel calculation engine
 */
export function runExcelEngineTests(): TestSuiteResult {
  const testResults: TestItemResult[] = [];

  const assertEqual = (category: string, name: string, actual: any, expected: any) => {
    const success = actual === expected;
    testResults.push({
      category,
      name,
      success,
      actual,
      expected,
      details: success ? undefined : `Attendu: ${JSON.stringify(expected)} | Obtenu: ${JSON.stringify(actual)}`
    });
  };

  const startTime = performance.now();

  // ==========================================
  // 2. TESTS DE BASE (Opérations arithmétiques)
  // ==========================================
  assertEqual('2. Tests de base', 'Addition simple: 2+2', evaluateFormulaString('=2+2', () => null), 4);
  assertEqual('2. Tests de base', 'Soustraction: 10-3', evaluateFormulaString('=10-3', () => null), 7);
  assertEqual('2. Tests de base', 'Multiplication: 4*5', evaluateFormulaString('=4*5', () => null), 20);
  assertEqual('2. Tests de base', 'Division: 20/4', evaluateFormulaString('=20/4', () => null), 5);
  assertEqual('2. Tests de base', 'Puissance: 2^3', evaluateFormulaString('=2^3', () => null), 8);
  assertEqual('2. Tests de base', 'Parenthèses: (2+3)*4', evaluateFormulaString('=(2+3)*4', () => null), 20);

  // ==========================================
  // 3. RÉFÉRENCES DE CELLULES (A1=10, B1=5)
  // ==========================================
  const refCells: Record<string, any> = { A1: 10, B1: 5 };
  const getRef = (addr: string) => refCells[addr] ?? null;

  assertEqual('3. Références', 'Addition de références: =A1+B1', evaluateFormulaString('=A1+B1', getRef), 15);
  assertEqual('3. Références', 'Soustraction de références: =A1-B1', evaluateFormulaString('=A1-B1', getRef), 5);
  assertEqual('3. Références', 'Multiplication de références: =A1*B1', evaluateFormulaString('=A1*B1', getRef), 50);
  assertEqual('3. Références', 'Division de références: =A1/B1', evaluateFormulaString('=A1/B1', getRef), 2);
  assertEqual('3. Références', 'Puissance de références: =A1^B1', evaluateFormulaString('=A1^B1', getRef), 100000);

  // ==========================================
  // 4. PRIORITÉS OPÉRATOIRES
  // ==========================================
  assertEqual('4. Priorités', 'Multiplication prioritaire: =2+3*4', evaluateFormulaString('=2+3*4', () => null), 14);
  assertEqual('4. Priorités', 'Parenthèses prioritaires: =(2+3)*4', evaluateFormulaString('=(2+3)*4', () => null), 20);
  assertEqual('4. Priorités', 'Puissance prioritaire sur multiplication: =2^3*2', evaluateFormulaString('=2^3*2', () => null), 16);

  // ==========================================
  // 5. PLAGES DE CELLULES (A1=10, A2=20, A3=30, A4=40, A5=50)
  // ==========================================
  const rangeCells: Record<string, any> = {
    A1: 10,
    A2: 20,
    A3: 30,
    A4: 40,
    A5: 50
  };
  const getRange = (addr: string) => rangeCells[addr] ?? null;

  assertEqual('5. Plages', 'SOMME(A1:A5)', evaluateFormulaString('=SOMME(A1:A5)', getRange), 150);
  assertEqual('5. Plages', 'MOYENNE(A1:A5)', evaluateFormulaString('=MOYENNE(A1:A5)', getRange), 30);
  assertEqual('5. Plages', 'MIN(A1:A5)', evaluateFormulaString('=MIN(A1:A5)', getRange), 10);
  assertEqual('5. Plages', 'MAX(A1:A5)', evaluateFormulaString('=MAX(A1:A5)', getRange), 50);
  assertEqual('5. Plages', 'NB(A1:A5)', evaluateFormulaString('=NB(A1:A5)', getRange), 5);
  assertEqual('5. Plages', 'NBVAL(A1:A5)', evaluateFormulaString('=NBVAL(A1:A5)', getRange), 5);

  // ==========================================
  // 6. MULTIPLES PLAGES & ARGUMENTS MULTIPLES
  // ==========================================
  const multiRangeCells: Record<string, any> = {
    A1: 10, A2: 20, A3: 30, A4: 40, A5: 50,
    C1: 1,  C2: 2,  C3: 3,  C4: 4,  C5: 5
  };
  const getMultiRange = (addr: string) => multiRangeCells[addr] ?? null;

  assertEqual('6. Multiples plages', 'SOMME avec 2 plages: =SOMME(A1:A5;C1:C5)', evaluateFormulaString('=SOMME(A1:A5;C1:C5)', getMultiRange), 165);
  assertEqual('6. Multiples plages', 'SOMME avec cellules séparées: =SOMME(A1;A2;A3)', evaluateFormulaString('=SOMME(A1;A2;A3)', getMultiRange), 60);

  // ==========================================
  // 7. CONDITIONS (SI avec différents opérateurs)
  // ==========================================
  const condCells: Record<string, any> = { A1: 10 };
  const getCond = (addr: string) => condCells[addr] ?? null;

  assertEqual('7. Conditions', 'SI >= 10 (VRAI): =SI(A1>=10;"Admis";"Échec")', evaluateFormulaString('=SI(A1>=10;"Admis";"Échec")', getCond), 'Admis');
  assertEqual('7. Conditions', 'SI > 10 (FAUX): =SI(A1>10;"Admis";"Échec")', evaluateFormulaString('=SI(A1>10;"Admis";"Échec")', getCond), 'Échec');
  assertEqual('7. Conditions', 'SI = 10 (VRAI): =SI(A1=10;"Égal";"Différent")', evaluateFormulaString('=SI(A1=10;"Égal";"Différent")', getCond), 'Égal');
  assertEqual('7. Conditions', 'SI <> 10 (FAUX): =SI(A1<>10;"Oui";"Non")', evaluateFormulaString('=SI(A1<>10;"Oui";"Non")', getCond), 'Non');

  // ==========================================
  // 8. LOGIQUE (ET / OU)
  // ==========================================
  assertEqual('8. Logique', '=ET(VRAI;VRAI)', evaluateFormulaString('=ET(VRAI;VRAI)', () => null), true);
  assertEqual('8. Logique', '=ET(VRAI;FAUX)', evaluateFormulaString('=ET(VRAI;FAUX)', () => null), false);
  assertEqual('8. Logique', '=OU(VRAI;FAUX)', evaluateFormulaString('=OU(VRAI;FAUX)', () => null), true);
  assertEqual('8. Logique', '=OU(FAUX;FAUX)', evaluateFormulaString('=OU(FAUX;FAUX)', () => null), false);
  assertEqual('8. Logique', 'ET avec expressions: =ET(A1>5; B1>0)', evaluateFormulaString('=ET(A1>5; B1>0)', getRef), true);

  // ==========================================
  // 9. NB.SI
  // ==========================================
  const nbsiCells: Record<string, any> = {
    A1: 10,
    A2: 20,
    A3: 10,
    A4: 30,
    B1: 'Riz',
    B2: 'Maïs',
    B3: 'Riz'
  };
  const getNbsi = (addr: string) => nbsiCells[addr] ?? null;

  assertEqual('9. NB.SI', 'Critère nombre exact: =NB.SI(A1:A4;10)', evaluateFormulaString('=NB.SI(A1:A4;10)', getNbsi), 2);
  assertEqual('9. NB.SI', 'Critère supérieur: =NB.SI(A1:A4;">10")', evaluateFormulaString('=NB.SI(A1:A4;">10")', getNbsi), 2);
  assertEqual('9. NB.SI', 'Critère texte: =NB.SI(B1:B3;"Riz")', evaluateFormulaString('=NB.SI(B1:B3;"Riz")', getNbsi), 2);

  // ==========================================
  // 10. SOMME.SI
  // ==========================================
  const tableData: Record<string, any> = {
    A1: 'Produit', B1: 'Vente',
    A2: 'Riz',     B2: 100,
    A3: 'Maïs',    B3: 200,
    A4: 'Riz',     B4: 150
  };
  const getTable = (addr: string) => tableData[addr] ?? null;

  assertEqual('10. SOMME.SI', '=SOMME.SI(A2:A4;"Riz";B2:B4)', evaluateFormulaString('=SOMME.SI(A2:A4;"Riz";B2:B4)', getTable), 250);

  // ==========================================
  // 11. MOYENNE.SI
  // ==========================================
  assertEqual('11. MOYENNE.SI', '=MOYENNE.SI(A2:A4;"Riz";B2:B4)', evaluateFormulaString('=MOYENNE.SI(A2:A4;"Riz";B2:B4)', getTable), 125);

  // ==========================================
  // 12. TEXTE
  // ==========================================
  assertEqual('12. Texte', '=MAJUSCULE("bonjour")', evaluateFormulaString('=MAJUSCULE("bonjour")', () => null), 'BONJOUR');
  assertEqual('12. Texte', '=MINUSCULE("BONJOUR")', evaluateFormulaString('=MINUSCULE("BONJOUR")', () => null), 'bonjour');
  assertEqual('12. Texte', '=NBCAR("Pierre")', evaluateFormulaString('=NBCAR("Pierre")', () => null), 6);
  assertEqual('12. Texte', '=CONCATENER("Excel";" Lab")', evaluateFormulaString('=CONCATENER("Excel";" Lab")', () => null), 'Excel Lab');
  assertEqual('12. Texte', 'Opérateur & : ="Excel "&"Lab"', evaluateFormulaString('="Excel "&"Lab"', () => null), 'Excel Lab');

  // ==========================================
  // 13. VALEURS VIDES
  // ==========================================
  const emptyCells: Record<string, any> = {
    B1: 10
  };
  const getEmpty = (addr: string) => emptyCells[addr] ?? null;

  assertEqual('13. Valeurs vides', 'Addition avec cellule vide: =A1+B1 (0+10)', evaluateFormulaString('=A1+B1', getEmpty), 10);
  assertEqual('13. Valeurs vides', 'SOMME avec plage contenant cellule vide: =SOMME(A1:B1)', evaluateFormulaString('=SOMME(A1:B1)', getEmpty), 10);

  // ==========================================
  // 14. DIVISION PAR ZÉRO
  // ==========================================
  const zeroCells: Record<string, any> = { A1: 10, B1: 0 };
  const getZero = (addr: string) => zeroCells[addr] ?? null;

  assertEqual('14. Division par zéro', 'Directe: =10/0', evaluateFormulaString('=10/0', () => null), '#DIV/0!');
  assertEqual('14. Division par zéro', 'Via cellule: =A1/B1 (B1=0)', evaluateFormulaString('=A1/B1', getZero), '#DIV/0!');

  // ==========================================
  // 15. RÉFÉRENCE INVALIDE OU NON DÉFINIE
  // ==========================================
  assertEqual('15. Référence inexistante', 'Cellule vide éloignée: =ZZ999999 + 5', evaluateFormulaString('=ZZ999999 + 5', () => null), 5);
  assertEqual('15. Référence invalide', 'Formule avec syntaxe invalide: =1+', evaluateFormulaString('=1+', () => null), '#VALUE!');

  // ==========================================
  // 16. FONCTION INCONNUE
  // ==========================================
  assertEqual('16. Fonction inconnue', '=MAFONCTION(A1)', evaluateFormulaString('=MAFONCTION(A1)', () => null), '#NAME?');

  // ==========================================
  // 17. RÉFÉRENCE CIRCULAIRE
  // ==========================================
  const circularMap: ExcelCellsMap = {
    A1: { value: '=B1+1' },
    B1: { value: '=A1+1' }
  };
  const evalCircular = ExcelEngine.recomputeAll(circularMap);
  assertEqual('17. Référence circulaire', 'Détection cycle A1', evalCircular['A1']?.computed, '#CIRCULAIRE!');
  assertEqual('17. Référence circulaire', 'Détection cycle B1', evalCircular['B1']?.computed, '#CIRCULAIRE!');

  // ==========================================
  // 18. DÉPENDANCES EN CASCADE
  // ==========================================
  const cascadeMap: ExcelCellsMap = {
    A1: { value: '10' },
    B1: { value: '20' },
    C1: { value: '=A1+B1' },
    D1: { value: '=C1*2' },
    E1: { value: '=D1+10' }
  };
  const step1 = ExcelEngine.recomputeAll(cascadeMap);
  assertEqual('18. Cascade initiale', 'C1 = A1+B1 (10+20)', step1['C1']?.computed, 30);
  assertEqual('18. Cascade initiale', 'D1 = C1*2 (30*2)', step1['D1']?.computed, 60);
  assertEqual('18. Cascade initiale', 'E1 = D1+10 (60+10)', step1['E1']?.computed, 70);

  const step2 = ExcelEngine.updateCellAndRecompute(step1, 'A1', '20');
  assertEqual('18. Cascade mise à jour', 'C1 après A1=20 (20+20)', step2['C1']?.computed, 40);
  assertEqual('18. Cascade mise à jour', 'D1 après A1=20 (40*2)', step2['D1']?.computed, 80);
  assertEqual('18. Cascade mise à jour', 'E1 après A1=20 (80+10)', step2['E1']?.computed, 90);

  // ==========================================
  // 19. SUPPRESSION DE CELLULE
  // ==========================================
  const delMap: ExcelCellsMap = {
    A1: { value: '10' },
    B1: { value: '=A1*2' }
  };
  const delInit = ExcelEngine.recomputeAll(delMap);
  assertEqual('19. Suppression', 'B1 initial (10*2)', delInit['B1']?.computed, 20);

  const delAfter = ExcelEngine.updateCellAndRecompute(delInit, 'A1', '');
  assertEqual('19. Suppression', 'B1 après suppression A1 (0*2)', delAfter['B1']?.computed, 0);

  // ==========================================
  // 20. FORMULE VERS FORMULE (Chaîne longue)
  // ==========================================
  const chainMap: ExcelCellsMap = {
    A1: { value: '10' },
    B1: { value: '=A1*2' },
    C1: { value: '=B1*2' },
    D1: { value: '=C1*2' }
  };
  let currentChain = ExcelEngine.recomputeAll(chainMap);
  assertEqual('20. Formule vers formule', 'D1 initial (10*2*2*2)', currentChain['D1']?.computed, 80);

  currentChain = ExcelEngine.updateCellAndRecompute(currentChain, 'A1', '5');
  assertEqual('20. Formule vers formule', 'D1 après A1=5 (5*2*2*2)', currentChain['D1']?.computed, 40);

  currentChain = ExcelEngine.updateCellAndRecompute(currentChain, 'A1', '100');
  assertEqual('20. Formule vers formule', 'D1 après A1=100 (100*2*2*2)', currentChain['D1']?.computed, 800);

  // ==========================================
  // 21. MODIFICATION DE FORMULE
  // ==========================================
  const modMap: ExcelCellsMap = {
    A1: { value: '10' },
    B1: { value: '20' },
    C1: { value: '=A1+B1' }
  };
  const mod1 = ExcelEngine.recomputeAll(modMap);
  assertEqual('21. Modif formule', 'C1 avant modif (10+20)', mod1['C1']?.computed, 30);

  const mod2 = ExcelEngine.updateCellAndRecompute(mod1, 'C1', '=A1*B1');
  assertEqual('21. Modif formule', 'C1 après modif (10*20)', mod2['C1']?.computed, 200);

  // ==========================================
  // 22. CHAÎNES ET GUILLEMETS
  // ==========================================
  assertEqual('22. Chaînes & Guillemets', '=SI(10>=10;"Oui";"Non")', evaluateFormulaString('=SI(10>=10;"Oui";"Non")', () => null), 'Oui');
  assertEqual('22. Chaînes & Guillemets', '="Bonjour Pierre"', evaluateFormulaString('="Bonjour Pierre"', () => null), 'Bonjour Pierre');
  assertEqual('22. Chaînes & Guillemets', 'Chaîne vide: =""', evaluateFormulaString('=""', () => null), '');

  // ==========================================
  // 23. SÉPARATEURS (; et ,)
  // ==========================================
  const sepMap: Record<string, any> = { A1: 10, A2: 20 };
  const getSep = (addr: string) => sepMap[addr] ?? null;

  assertEqual('23. Séparateurs', 'Point-virgule: =SOMME(A1;A2)', evaluateFormulaString('=SOMME(A1;A2)', getSep), 30);
  assertEqual('23. Séparateurs', 'Virgule: =SOMME(A1,A2)', evaluateFormulaString('=SOMME(A1,A2)', getSep), 30);

  // ==========================================
  // 24. NOMBRES DÉCIMAUX ET NÉGATIFS
  // ==========================================
  assertEqual('24. Nombres', 'Décimaux: =10.5+0.5', evaluateFormulaString('=10.5+0.5', () => null), 11);
  assertEqual('24. Nombres', 'Négatifs et décimaux: =-10 * -5.25', evaluateFormulaString('=-10 * -5.25', () => null), 52.5);
  assertEqual('24. Nombres', 'Grand nombre: =1000000/2', evaluateFormulaString('=1000000/2', () => null), 500000);
  assertEqual('24. Nombres', 'Double négatif: =--10', evaluateFormulaString('=--10', () => null), 10);

  // ==========================================
  // 25. CAS COMPLEXES, IMBRICATIONS & TOLÉRANCES
  // ==========================================
  const complexCells: Record<string, any> = {
    A1: 10,
    B1: 5,
    C1: '#DIV/0!'
  };
  const getComplex = (addr: string) => complexCells[addr] ?? null;

  assertEqual('25. Imbrication', 'SI + ET + SOMME imbriqués: =SI(ET(A1>5; B1>0); SOMME(A1; B1); 0)', evaluateFormulaString('=SI(ET(A1>5; B1>0); SOMME(A1; B1); 0)', getComplex), 15);
  assertEqual('25. Tolérance', 'Minuscules: =somme(a1;b1)', evaluateFormulaString('=somme(a1;b1)', getComplex), 15);
  assertEqual('25. Tolérance', 'Espaces multiples: =  SOMME ( A1 ; B1 ) ', evaluateFormulaString('=  SOMME ( A1 ; B1 ) ', getComplex), 15);
  assertEqual('25. Propagation erreurs', 'Propagation #DIV/0! dans multiplication: =C1*2', evaluateFormulaString('=C1*2', getComplex), '#DIV/0!');
  assertEqual('25. Concat complexe', 'Texte + Formule: ="Total: " & SOMME(A1; B1) & " €"', evaluateFormulaString('="Total: " & SOMME(A1; B1) & " €"', getComplex), 'Total: 15 €');

  // ==========================================
  // 26. RÉFÉRENCES DE COLONNES (Conversions A1, Z1, AA1, AB10)
  // ==========================================
  assertEqual('26. Colonnes', 'Conversion index 0 -> A', indexToColName(0), 'A');
  assertEqual('26. Colonnes', 'Conversion index 25 -> Z', indexToColName(25), 'Z');
  assertEqual('26. Colonnes', 'Conversion index 26 -> AA', indexToColName(26), 'AA');
  assertEqual('26. Colonnes', 'Conversion index 27 -> AB', indexToColName(27), 'AB');

  assertEqual('26. Colonnes', 'Conversion nom A -> index 0', colNameToIndex('A'), 0);
  assertEqual('26. Colonnes', 'Conversion nom Z -> index 25', colNameToIndex('Z'), 25);
  assertEqual('26. Colonnes', 'Conversion nom AA -> index 26', colNameToIndex('AA'), 26);
  assertEqual('26. Colonnes', 'Conversion nom AB -> index 27', colNameToIndex('AB'), 27);

  const coordAB10 = addressToCoord('AB10');
  assertEqual('26. Colonnes', 'Adresse AB10 -> coord', coordAB10 ? `${coordAB10.col},${coordAB10.row}` : null, '27,9');
  assertEqual('26. Colonnes', 'Coord 27,9 -> adresse', coordToAddress({ col: 27, row: 9 }), 'AB10');

  // ==========================================
  // 27. RECOPIE DE FORMULE (offsetFormula)
  // ==========================================
  assertEqual('27. Recopie', 'Décalage vertical: =B2*C2 vers le bas (+0 col, +1 row)', offsetFormula('=B2*C2', 0, 1), '=B3*C3');
  assertEqual('27. Recopie', 'Décalage horizontal: =B2*C2 vers la droite (+1 col, +0 row)', offsetFormula('=B2*C2', 1, 0), '=C2*D2');
  assertEqual('27. Recopie', 'Décalage plage: =SOMME(A1:A5) vers le bas (+0 col, +2 row)', offsetFormula('=SOMME(A1:A5)', 0, 2), '=SOMME(A3:A7)');

  // ==========================================
  // 28. PERFORMANCE (Grille de 100 cellules avec dépendances)
  // ==========================================
  const perfGrid: ExcelCellsMap = {};
  // 10 colonnes x 10 lignes = 100 cellules
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const addr = coordToAddress({ col: c, row: r });
      if (r === 0) {
        perfGrid[addr] = { value: String((c + 1) * 10) };
      } else {
        const prevAddr = coordToAddress({ col: c, row: r - 1 });
        perfGrid[addr] = { value: `=${prevAddr}+5` };
      }
    }
  }

  const perfStart = performance.now();
  const computedPerf = ExcelEngine.recomputeAll(perfGrid);
  const perfDuration = performance.now() - perfStart;

  assertEqual('28. Performance', 'Recalcul 100 cellules en chaîne', computedPerf['A10']?.computed, 55);
  assertEqual('28. Performance', 'Temps < 50ms', perfDuration < 50, true);

  const endTime = performance.now();
  const totalDuration = endTime - startTime;

  const passedCount = testResults.filter((t) => t.success).length;
  const failedCount = testResults.filter((t) => !t.success).length;

  return {
    total: testResults.length,
    passed: passedCount,
    failed: failedCount,
    failedBeforeFix: 0,
    results: testResults,
    performanceMs: totalDuration
  };
}
