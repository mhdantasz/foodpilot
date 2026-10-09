/** UTF-8/BOM, separador pt-BR e proteção de fórmulas em campos de texto não confiáveis. */
export function csvCell(value: string | number | null | undefined) {
  let text = typeof value==='number' ? value.toLocaleString('pt-BR',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2}) : String(value??'');
  if(typeof value!=='number' && /^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function csvDocument(headers:string[],rows:(string|number|null|undefined)[][]) {
  return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
