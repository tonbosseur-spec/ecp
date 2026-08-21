import { ExcelCellsMap } from './excelTypes';

export const STARTER_EXCEL_DATA: ExcelCellsMap = {
  A1: { value: "Article" },
  B1: { value: "Prix unitaire" },
  C1: { value: "Quantité" },
  D1: { value: "Total" },

  A2: { value: "Formation R" },
  B2: { value: "25000" },
  C2: { value: "4" },
  D2: { value: "=B2*C2" },

  A3: { value: "Manuel Statistique" },
  B3: { value: "15000" },
  C3: { value: "2" },
  D3: { value: "=B3*C3" },

  A4: { value: "Coaching Excel" },
  B4: { value: "35000" },
  C4: { value: "3" },
  D4: { value: "=B4*C4" },

  A5: { value: "Total Général" },
  D5: { value: "=SOMME(D2:D4)" }
};
