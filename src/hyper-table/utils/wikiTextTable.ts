import { ColumnsDefine } from '@visactor/vtable/es/ts-types';

interface ParsedNode {
  type: string;
  tag?: string;
  text?: string;
  children?: ParsedNode[];
}

export function parseWikiTextTable(input: string): undefined | { columns: ColumnsDefine; records: Array<Record<string, string>> } {
  const ast = $tw.wiki.parseText('text/vnd.tiddlywiki', input).tree as ParsedNode[] | undefined;
  if (!ast || ast.length === 0 || ast[0].type !== 'element' || ast[0].tag !== 'table') {
    return;
  }
  const tbody = ast[0].children?.find(element => element.type === 'element' && element.tag === 'tbody');
  const trElements = tbody?.children;
  if (!trElements) {
    return;
  }

  // Filtrar todo tr Elementos
  const trs = trElements.filter(tr => tr.type === 'element' && tr.tag === 'tr');
  if (trs.length === 0) {
    return;
  }

  // Funcion auxiliar para extraer texto de celda
  const extractText = (element: ParsedNode | undefined): string => {
    if (!element?.children) return '';

    // Extraiga todos los nodos de texto de forma recursiva.
    const extractTextFromChildren = (children: ParsedNode[]): string => {
      return children.map(child => {
        if (child.type === 'text') {
          return child.text ?? '';
        }
        if (child.children) {
          return extractTextFromChildren(child.children);
        }
        return '';
      }).join('');
    };

    return extractTextFromChildren(element.children).trim();
  };

  // Obtenga la fila del encabezado
  const headerRow = trs[0];
  const headerCells = (headerRow.children ?? []).filter(cell => cell.type === 'element' && (cell.tag === 'th' || cell.tag === 'td'));

  if (headerCells.length === 0) {
    return;
  }

  // Cree definiciones de columnas y asignacion de nombres de campos
  const columns: ColumnsDefine = [];
  const fieldNames: string[] = [];

  headerCells.forEach((cell, index) => {
    const title = extractText(cell);
    // Convertir titulo en nombre de campo
    let field = title
      ? title.trim().replaceAll(/[^\s\w]/g, '').replaceAll(/\s+/g, '').replace(/^(.)/, match => match.toLowerCase())
      : `column${index + 1}`;

    // Asegurese de que los nombres de los campos sean unicos
    if (fieldNames.includes(field)) {
      field = `${field}${index}`;
    }

    fieldNames.push(field);

    columns.push({
      field,
      title: title || `Column ${index + 1}`,
      width: 'auto',
      sort: true,
    });
  });

  // Cree registros de datos
  const records: Array<Record<string, string>> = [];

  // Comience a analizar los datos desde la segunda linea.
  for (let index = 1; index < trs.length; index++) {
    const dataRow = trs[index];
    const dataCells = (dataRow.children ?? []).filter(cell => cell.type === 'element' && (cell.tag === 'td' || cell.tag === 'th'));

    if (dataCells.length === 0) continue;

    const record: Record<string, string> = {};

    // Asociar el valor de cada celda con el campo de la columna correspondiente
    dataCells.forEach((cell, cellIndex) => {
      if (cellIndex < fieldNames.length) {
        const field = fieldNames[cellIndex];
        record[field] = extractText(cell);
      }
    });

    // Agregar solo cuando el registro tenga datos
    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  }

  return { records, columns };
}
